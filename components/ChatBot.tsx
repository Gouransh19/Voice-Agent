import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { sendMessageStream } from '../services/geminiService';
import { ChatMessage, GroundingSource } from '../types';

// SVG icon for the send button
const PaperPlaneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
);

// SVG icon for the spinner
const SpinnerIcon = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const Source: React.FC<{ source: GroundingSource; index: number }> = ({ source, index }) => (
    <a 
        href={source.uri} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="inline-block bg-cyan-900/50 hover:bg-cyan-800/50 text-cyan-200 text-xs px-2 py-1 rounded-full transition-colors duration-200 truncate"
        title={source.title}
    >
        <span className="font-bold">{index + 1}</span> {source.title}
    </a>
);

export const ChatBot: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const modelMessage: ChatMessage = { role: 'model', text: '', sources: [] };
        setMessages(prev => [...prev, modelMessage]);

        try {
            await sendMessageStream(
                input,
                (chunk) => {
                    setMessages(prev =>
                        prev.map((msg, index) =>
                            index === prev.length - 1 ? { ...msg, text: chunk } : msg
                        )
                    );
                },
                (sources) => {
                     setMessages(prev =>
                        prev.map((msg, index) =>
                            index === prev.length - 1 ? { ...msg, sources: sources } : msg
                        )
                    );
                }
            );
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev =>
                prev.map((msg, index) =>
                    index === prev.length - 1 ? { ...msg, text: 'Sorry, I encountered an error. Please try again.' } : msg
                )
            );
        } finally {
            setIsLoading(false);
        }
    };
    
    // Simple text renderer that respects newlines
    const renderText = (text: string) => {
        return text.split('\n').map((line, index, arr) => (
            <React.Fragment key={index}>
                {line}
                {index < arr.length - 1 && <br />}
            </React.Fragment>
        ));
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            {/* Chat History */}
            <div className="flex-grow overflow-y-auto pr-4 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 animate-slide-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-gray-700' : 'bg-cyan-800'}`}></div>
                        <div className={`px-4 py-3 rounded-lg max-w-xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-cyan-900/50 text-cyan-100' : 'bg-gray-900/50 text-gray-200'}`}>
                            <div>{msg.text || (msg.role === 'model' && isLoading && index === messages.length -1 ? '...' : '')}</div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {msg.sources.map((source, i) => (
                                        <Source key={i} source={source} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                 <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="flex-shrink-0 pt-6">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything..."
                        disabled={isLoading}
                        className="w-full pl-4 pr-14 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-cyan-400 hover:bg-cyan-500/20 disabled:text-gray-500 disabled:hover:bg-transparent transition-colors"
                        aria-label="Send message"
                    >
                        {isLoading ? <SpinnerIcon /> : <PaperPlaneIcon />}
                    </button>
                </form>
            </div>
        </div>
    );
};
