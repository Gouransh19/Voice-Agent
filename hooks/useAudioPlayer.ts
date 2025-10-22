
import { useState, useRef, useCallback, useEffect } from 'react';
import { decode, decodeAudioData } from '../utils/audioUtils';

// Audio playback hook
export const useAudioPlayer = (sampleRate: number) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    // Initialize AudioContext
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.connect(audioContextRef.current.destination);
        } catch(e) {
            console.error("Web Audio API is not supported in this browser.", e);
        }
    }

    return () => {
      // Cleanup on unmount
      stopAll();
      audioContextRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRate]);

  const playBase64 = useCallback(async (base64String: string) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    await audioContextRef.current.resume();
    
    const audioBytes = decode(base64String);
    const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, sampleRate, 1);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNodeRef.current);
    
    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextStartTimeRef.current);

    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
    sourcesRef.current.add(source);
    setIsPlaying(true);

    source.onended = () => {
      sourcesRef.current.delete(source);
      if (sourcesRef.current.size === 0) {
        setIsPlaying(false);
      }
    };
  }, [sampleRate]);

  const stopAll = useCallback(() => {
    sourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors from stopping already stopped sources
      }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  return { playBase64, stopAll, isPlaying };
};
