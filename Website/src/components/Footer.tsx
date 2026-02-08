import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlayerUi } from '../context/PlayerUiContext';

export function Footer() {
  const location = useLocation();
  const isPlayerPage = location.pathname.startsWith('/player');
  const isSettingsPage = location.pathname === '/settings';
  const { isCollapsed, activeId } = usePlayerUi();
  const isMiniPlayerOpen = Boolean(activeId) && isCollapsed;
  const isPlayerOpen = Boolean(activeId);

  useEffect(() => {
    // Don't load Ko-fi widget on player page or when player is open
    if (isPlayerPage || isSettingsPage || isMiniPlayerOpen || isPlayerOpen) {
      const kofiWidget = document.querySelector('.floatingchat-container-wrap');
      if (kofiWidget) {
        kofiWidget.remove();
      }
      return;
    }

    const drawKofi = () => {
      if (window.kofiWidgetOverlay) {
        window.kofiWidgetOverlay.draw('danielvnz', {
          'type': 'floating-chat',
          'floating-chat.donateButton.text': 'Support Me',
          'floating-chat.donateButton.background-color': '#00b9fe',
          'floating-chat.donateButton.text-color': '#fff',
          'floating-chat.donateButton.position': 'right'
        });
      }
    };

    const existingScript = document.querySelector('script[data-kofi-widget="overlay"]') as HTMLScriptElement | null;
    if (existingScript) {
      drawKofi();
      return () => {
        const kofiWidget = document.querySelector('.floatingchat-container-wrap');
        if (kofiWidget) {
          kofiWidget.remove();
        }
      };
    }

    // Load Ko-fi widget script once
    const script = document.createElement('script');
    script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
    script.async = true;
    script.dataset.kofiWidget = 'overlay';
    script.onload = drawKofi;
    document.body.appendChild(script);

    return () => {
      // Remove Ko-fi widget elements
      const kofiWidget = document.querySelector('.floatingchat-container-wrap');
      if (kofiWidget) {
        kofiWidget.remove();
      }
    };
  }, [isMiniPlayerOpen, isPlayerOpen, isPlayerPage, isSettingsPage]);

  return (
    <footer className="relative z-10 border-t border-white/5 mt-16 py-8 px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>© 2026 Aether</p>
            <p className="text-gray-600 text-xs">
              Not affiliated with Emby or TMDB.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <p className="text-center sm:text-left">
              Support me if you'd like to keep this project alive!
            </p>
            <a
              href="https://github.com/DanielVNZ/Aether"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-500 hover:text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

declare global {
  interface Window {
    kofiWidgetOverlay: {
      draw: (username: string, options: Record<string, string>) => void;
    };
  }
}
