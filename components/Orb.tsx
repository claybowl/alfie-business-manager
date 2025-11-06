import React from 'react';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

interface OrbProps {
  userLevel: number;
  aiLevel: number;
  isConnected: boolean;
  connectionState: ConnectionState;
}

export const Orb: React.FC<OrbProps> = ({ userLevel, aiLevel, isConnected, connectionState }) => {
  const userGlowSize = 1 + userLevel * 1.5;
  const aiGlowSize = 1 + aiLevel * 2.5; // Slightly increased scale effect

  // Condition for the idle listening pulse
  const isIdleListening = isConnected && userLevel < 0.05 && aiLevel < 0.05;

  const statusRingStyles: Record<ConnectionState, string> = {
    idle: 'border-gray-700/50',
    connecting: 'border-amber-400 animate-pulse',
    connected: 'border-green-500',
    error: 'border-red-500',
    closed: 'border-gray-800'
  };

  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
      {/* Status Ring */}
      <div className={`absolute -inset-3 rounded-full border-2 transition-colors duration-500 ${statusRingStyles[connectionState]}`}></div>

      {/* Base Orb & Floating Animation */}
      <div className={`absolute w-full h-full rounded-full bg-gray-900 transition-all duration-500 ${isConnected ? 'animate-float' : ''} ${isIdleListening ? 'animate-pulse-listen' : ''}`}>
        
        {/* User Speaking Glow (Blue) */}
        <div
          className="absolute inset-0 rounded-full transition-transform duration-100"
          style={{
            transform: `scale(${userGlowSize})`,
            boxShadow: `0 0 ${userLevel * 60}px 10px rgba(59, 130, 246, ${userLevel * 0.5})`,
          }}
        />

        {/* AI Speaking Glow (Amber) - ENHANCED */}
        <div
          className="absolute inset-0 rounded-full transition-transform duration-100"
          style={{
            transform: `scale(${aiGlowSize})`,
            // More prominent glow: larger, wider, and slightly more opaque
            boxShadow: `0 0 ${aiLevel * 120}px 20px rgba(251, 191, 36, ${aiLevel * 0.7})`,
          }}
        />

        {/* Core Orb */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-800 to-black shadow-2xl shadow-black/50 overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
           {/* Inner texture */}
           <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
        </div>

        {/* AI Talking Core Light - ENHANCED */}
        <div
          className="absolute inset-4 rounded-full bg-amber-400/80 transition-opacity duration-200"
          style={{
            // Brighter and softer core light
            opacity: aiLevel * 0.9,
            filter: `blur(${aiLevel * 40}px)`,
          }}
        />

        {/* Fedora-style Hat */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-[70%] h-12 flex flex-col items-center">
            {/* Crown */}
            <div className="w-[65%] h-10 bg-gray-900/80 backdrop-blur-sm rounded-t-md border-t border-gray-700 relative z-10">
                {/* Band */}
                <div className="absolute bottom-1 left-0 w-full h-2.5 bg-gray-700/60"></div>
                {/* Dent */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-black/20 rounded-b-lg"></div>
            </div>
            {/* Brim */}
            <div className="w-full h-2 bg-gray-800/90 rounded-full -mt-1"></div>
        </div>

        {/* Subtle Glint */}
        <div className="absolute top-8 left-8 w-1/4 h-1/4 bg-white/10 rounded-full -rotate-45" style={{ filter: 'blur(15px)'}}></div>
      </div>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(-5px); }
          50% { transform: translateY(5px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        @keyframes pulse-listen {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.0);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 0 0 30px 5px rgba(251, 191, 36, 0.15);
          }
        }
        .animate-pulse-listen {
          animation: pulse-listen 4s ease-in-out infinite;
        }

        .bg-grid-white\\[\\[0\\.05\\]] {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>
    </div>
  );
};
