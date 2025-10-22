import React, { useState, useRef, useEffect } from 'react';
import { LiveAgent } from './components/LiveAgent';
import { ChatBot } from './components/ChatBot';

type Mode = 'live' | 'chat';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('live');
  const [activeMode, setActiveMode] = useState<Mode>('live');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsTransitioning(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setActiveMode(mode);
      setIsTransitioning(false);
    }, 300); // Match transition duration
  }, [mode]);

  const header = (
    <header className="bg-black/30 backdrop-blur-xl p-4 border-b border-cyan-500/10 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM12 4C16.418 4 20 7.582 20 12C20 16.418 16.418 20 12 20C7.582 20 4 16.418 4 12C4 7.582 7.582 4 12 4ZM9 9V15L15 12L9 9Z" fill="currentColor"/></svg>
          <h1 className="text-xl font-bold text-gray-100 glowing-text tracking-wider">AURA AGENT</h1>
        </div>
        <nav className="flex items-center p-1 space-x-2 relative">
          <button
            onClick={() => setMode('live')}
            className={`px-4 py-2 text-sm font-medium z-10 transition-colors duration-300 ${
              mode === 'live' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-2 text-sm font-medium z-10 transition-colors duration-300 ${
              mode === 'chat' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Chat
          </button>
          <div className={`absolute h-full top-0 rounded-lg bg-cyan-500/20 backdrop-blur-sm border border-cyan-500/20 transition-all duration-500 ease-in-out ${mode === 'live' ? 'w-[80px] left-[4px]' : 'w-[79px] left-[88px]'}`}></div>
        </nav>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {header}
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col">
        <div className={`flex-grow transition-opacity duration-300 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {activeMode === 'live' ? <LiveAgent /> : <ChatBot />}
        </div>
      </main>
    </div>
  );
};

export default App;