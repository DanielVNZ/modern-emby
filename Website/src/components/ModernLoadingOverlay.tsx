import { useEffect, useState } from 'react';

export function ModernLoadingOverlay({ visible = true, message }: { visible?: boolean; message?: string }) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [anim, setAnim] = useState(visible ? 'opacity-100' : 'opacity-0');

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // next tick to ensure transition plays
      const id = requestAnimationFrame(() => setAnim('opacity-100'));
      return () => cancelAnimationFrame(id);
    } else {
      setAnim('opacity-0');
      const t = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${anim}`} aria-hidden>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950" />
      {/* Subtle animated grain */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.05) 0, rgba(255,255,255,0) 60%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0, rgba(255,255,255,0) 60%)'}} />

      {/* Center content */}
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-8">
          {/* Animated Play Orb */}
          <div className="relative w-28 h-28">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500/80 border-r-purple-500/80 animate-spin-slow" />
            {/* Inner glow */}
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 blur-sm opacity-60" />
            <div className="absolute inset-3 rounded-full bg-gray-900" />
            {/* Play icon pulse */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md animate-ping" />
                <svg className="relative w-10 h-10 text-white drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" viewBox="0 0 24 24" fill="currentColor" aria-label="Loading">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Message + shimmer bar */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-white/90 text-base sm:text-lg font-medium tracking-wide">
              {message || 'Preparing your experience...'}
            </div>
            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-shimmer" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 1.6s ease-in-out infinite;
        }
        .animate-spin-slow { animation: spin 2.4s linear infinite; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
