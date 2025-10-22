import React, { useState, useRef, useEffect, useCallback } from 'react';
import { connectLiveAgent } from '../services/geminiService';
// Fix: Remove LiveSession as it is not an exported member of @google/genai
import type { LiveServerMessage } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

type Status = 'idle' | 'listening' | 'connecting' | 'error' | 'speaking';

const MicrophoneIcon: React.FC<{ status: Status }> = ({ status }) => {
    const colorClass = status === 'error' ? 'text-red-500' : 'text-cyan-400 glowing-text';

    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 transition-colors duration-300 ${colorClass}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-12 0H3a7.001 7.001 0 006 6.93V17H7a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" />
        </svg>
    );
};

interface Transcription {
    speaker: 'user' | 'agent';
    text: string;
}

export const LiveAgent: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [transcript, setTranscript] = useState<Transcription[]>([]);

    // Fix: Use 'any' for the session promise type as LiveSession is not exported.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    // For audio playback
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);

    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);
    
    const stopPlayback = useCallback(() => {
        sourcesRef.current.forEach(source => {
          try {
            source.stop();
          } catch(e) {/* ignore */}
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setStatus(prev => prev === 'speaking' ? 'listening' : prev);
    }, []);

    const playAudio = useCallback(async (base64String: string) => {
        if (!outputAudioContextRef.current || !gainNodeRef.current) return;
        setStatus('speaking');
        
        await outputAudioContextRef.current.resume();
        const audioBytes = decode(base64String);
        const audioBuffer = await decodeAudioData(audioBytes, outputAudioContextRef.current, 24000, 1);
        
        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);

        const currentTime = outputAudioContextRef.current.currentTime;
        const startTime = Math.max(currentTime, nextStartTimeRef.current);

        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;
        sourcesRef.current.add(source);

        source.onended = () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) {
                setStatus('listening');
            }
        };
    }, []);

    const handleMessage = useCallback(async (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            currentOutputTranscription.current += text;
        } else if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            currentInputTranscription.current += text;
        }

        if (message.serverContent?.turnComplete) {
            const fullInput = currentInputTranscription.current.trim();
            const fullOutput = currentOutputTranscription.current.trim();
            
            setTranscript(prev => {
                let newTranscript = [...prev];
                if (fullInput) newTranscript.push({ speaker: 'user', text: fullInput });
                if (fullOutput) newTranscript.push({ speaker: 'agent', text: fullOutput });
                return newTranscript;
            });

            currentInputTranscription.current = '';
            currentOutputTranscription.current = '';
        }

        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            await playAudio(base64Audio);
        }

        if (message.serverContent?.interrupted) {
            stopPlayback();
        }
    }, [playAudio, stopPlayback]);

    const startConversation = async () => {
        setStatus('connecting');
        stopPlayback();
        setTranscript([]);
        
        try {
            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                gainNodeRef.current = outputAudioContextRef.current.createGain();
                gainNodeRef.current.connect(outputAudioContextRef.current.destination);
            }

            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            sessionPromiseRef.current = connectLiveAgent({
                onopen: () => {
                    setStatus('listening');
                    const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
                    scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                        
                        if(sessionPromiseRef.current) {
                            sessionPromiseRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        }
                    };
                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(audioContextRef.current.destination);
                },
                onmessage: handleMessage,
                onerror: (e) => {
                    console.error('Live session error:', e);
                    setStatus('error');
                    stopConversation();
                },
                onclose: () => {
                   //
                },
            });

        } catch (err) {
            console.error('Failed to start conversation:', err);
            setStatus('error');
        }
    };
    
    const stopConversation = useCallback(async () => {
        stopPlayback();

        if(sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }
        
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;

        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        audioContextRef.current?.close();
        audioContextRef.current = null;

        setStatus('idle');
    }, [stopPlayback]);

    const getStatusText = () => {
        switch (status) {
            case 'idle': return 'Tap the icon to start a conversation.';
            case 'connecting': return 'Establishing secure connection...';
            case 'listening': return 'Listening...';
            case 'speaking': return 'Agent is speaking...';
            case 'error': return 'Connection error. Tap to try again.';
        }
    };
    
    const pulseClass = status === 'listening' ? 'pulse-ring' : '';

    return (
        <div className="flex flex-col h-full text-center">
            {/* Transcript Area */}
            <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col justify-end relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 right-0 overflow-y-auto p-4 space-y-4">
                    {transcript.map((item, index) => (
                        <div key={index} className={`flex items-start gap-3 max-w-xl animate-slide-in ${item.speaker === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                             <div className={`w-6 h-6 rounded-full flex-shrink-0 mt-1 ${item.speaker === 'user' ? 'bg-gray-700' : 'bg-cyan-800'}`}></div>
                             <div className={`px-4 py-2 rounded-lg ${item.speaker === 'user' ? 'bg-cyan-900/50 text-cyan-100 text-left' : 'bg-gray-900/50 text-gray-200 text-left'}`}>
                                <p>{item.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={transcriptEndRef} />
                </div>
            </div>

            {/* Controller Area */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-8">
                 <button 
                    onClick={status === 'idle' || status === 'error' ? startConversation : stopConversation} 
                    className={`p-8 rounded-full bg-gray-900/50 border border-cyan-500/30 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 ${pulseClass}`}
                    aria-label={status === 'idle' ? 'Start conversation' : 'Stop conversation'}
                >
                    <MicrophoneIcon status={status} />
                </button>
                <p className="mt-6 text-lg text-gray-400 font-medium tracking-wider">{getStatusText()}</p>
            </div>
        </div>
    );
};