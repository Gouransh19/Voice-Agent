import React, { useState } from 'react';
import { LiveAgent } from './components/LiveAgent';
import { ChatBot } from './components/ChatBot';

type Mode = 'live' | 'chat';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('live');

  const header = (
    <header className="bg-black/50 backdrop-blur-md p-4 border-b border-cyan-500/20 sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.6364 5.36363C17.0757 3.80302 15.0114 2.92889 12.8284 2.92889C8.42001 2.92889 4.82843 6.52047 4.82843 10.9289C4.82843 13.1118 5.70256 15.1762 7.26317 16.7368L2.92944 21.0705L2 22L2.92944 21.0705L7.26317 16.7368C8.82378 18.2974 10.8882 19.1716 13.0711 19.1716C17.4795 19.1716 21.0711 15.58 21.0711 11.1716C21.0711 8.98866 20.1969 6.92433 18.6364 5.36363ZM13.0711 17.1716C9.48905 17.1716 6.59216 14.2747 6.59216 10.6926C6.59216 7.11051 9.48905 4.21362 13.0711 4.21362C16.6532 4.21362 19.5501 7.11051 19.5501 10.6926C19.5501 14.2747 16.6532 17.1716 13.0711 17.1716Z" fill="currentColor"/></svg>
            <h1 className="text-xl font-bold text-gray-100 glowing-text">ADAPTIVE AI AGENT</h1>
        </div>
        <nav className="flex items-center bg-gray-900/50 border border-gray-700 rounded-lg p-1 space-x-1">
          <button
            onClick={() => setMode('live')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
              mode === 'live' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            Live Agent
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
              mode === 'chat' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            Text Chat
          </button>
        </nav>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {header}
      <main className="flex-grow container mx-auto p-4 md:p-8 transition-opacity duration-500">
        {mode === 'live' ? <LiveAgent /> : <ChatBot />}
      </main>
    </div>
  );
};

export default App;