import React, { useState, useEffect, useRef } from 'react';
import type { Chat } from "@google/genai";
import { sendMessage, createChatSession, textToSpeech } from '../services/geminiService';
import type { ChatMessage } from '../types';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const IconUser = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

const IconAgent = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400 glowing-text" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.121 7.121a.75.75 0 011.06 0L10 10.939l3.819-3.818a.75.75 0 111.06 1.06L11.061 12l3.818 3.819a.75.75 0 11-1.06 1.06L10 13.061l-3.819 3.818a.75.75 0 11-1.06-1.06L8.939 12 5.121 8.181a.75.75 0 010-1.06z" />
    </svg>
);

export const ChatBot: React.FC = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useGoogleSearch, setUseGoogleSearch] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { playBase64, isPlaying } = useAudioPlayer(24000);

    useEffect(() => {
        // Load chat history from localStorage and initialize chat session
        const storedMessages = localStorage.getItem('chatHistory');
        const initialMessages = storedMessages ? JSON.parse(storedMessages) : [];
        setMessages(initialMessages);
        
        const historyForApi = initialMessages.map((msg: ChatMessage) => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));
        setChat(createChatSession(historyForApi));
    }, []);

    useEffect(() => {
        // Save chat history to localStorage whenever it changes
        if(messages.length > 0) {
            localStorage.setItem('chatHistory', JSON.stringify(messages));
        }
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!input.trim() || !chat || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const { response, sources } = await sendMessage(chat, input, useGoogleSearch);
            const modelResponse: ChatMessage = { role: 'model', text: response.text, sources };
            setMessages(prev => [...prev, modelResponse]);
            
            if (response.text) {
                const audioData = await textToSpeech(response.text);
                if (audioData) {
                    await playBase64(audioData);
                }
            }

        } catch (error) {
            console.error("Failed to send message:", error);
            const errorMessage: ChatMessage = { role: 'model', text: 'Sorry, I encountered an error. Please try again.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto bg-black rounded-lg border border-cyan-500/20 glowing-border">
            <div className="flex-grow p-6 overflow-y-auto space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-4 animate-fade-in ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <IconAgent />}
                        <div className={`p-4 rounded-lg max-w-xl ${msg.role === 'user' ? 'bg-cyan-900/50 text-cyan-100 rounded-br-none' : 'bg-gray-900 text-gray-200 rounded-bl-none'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-700">
                                    <h4 className="text-xs font-semibold text-gray-500 mb-2">SOURCES:</h4>
                                    <div className="flex flex-col space-y-1">
                                        {msg.sources.map((source, i) => (
                                            <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline truncate hover:text-cyan-300">
                                                {source.title || source.uri}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && <IconUser />}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-4 animate-fade-in">
                        <IconAgent />
                        <div className="p-4 rounded-lg bg-gray-900">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-0"></div>
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-200"></div>
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-400"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-cyan-500/20">
                 <div className="flex items-center justify-center mb-3">
                    <label htmlFor="google-search-toggle" className="flex items-center cursor-pointer">
                        <span className="mr-3 text-sm text-gray-400">Enable Google Search for real-time information</span>
                        <div className="relative">
                            <input type="checkbox" id="google-search-toggle" className="sr-only" checked={useGoogleSearch} onChange={() => setUseGoogleSearch(!useGoogleSearch)} />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${useGoogleSearch ? 'bg-cyan-500' : 'bg-gray-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useGoogleSearch ? 'translate-x-full' : ''}`}></div>
                        </div>
                    </label>
                </div>
                <div className="flex items-center bg-gray-900 rounded-lg p-2 border border-gray-700 focus-within:border-cyan-500 transition-colors">
                    <input
                        type="text"
                        className="flex-grow bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none px-2"
                        placeholder={isPlaying ? 'Agent is speaking...' : 'Message your agent...'}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading || isPlaying}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim() || isPlaying}
                        className="bg-cyan-600 text-white rounded-md p-2 disabled:bg-gray-700 disabled:cursor-not-allowed hover:bg-cyan-500 transition-all duration-200 disabled:hover:scale-100 hover:scale-110"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};