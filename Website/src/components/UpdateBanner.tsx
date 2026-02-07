import { useState, useEffect } from 'react';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';

export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    checkForUpdates();
  }, []);

  const safeCheckForUpdates = async () => {
    if (!isTauri()) {
      return { update: null as Awaited<ReturnType<typeof check>> | null, error: 'Updates are only available in the desktop app.' };
    }
    try {
      const update = await check();
      return { update, error: null as string | null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("reading 'available'")) {
        return {
          update: null,
          error: 'Updater returned no data. Verify updater permissions and endpoint.',
        };
      }
      return { update: null, error: errorMessage };
    }
  };

  const checkForUpdates = async () => {
    try {
      const { update, error } = await safeCheckForUpdates();
      
      if (error) {
        console.error('Error checking for updates:', error);
        return;
      }

      if (update) {
        console.log(
          `Update available: ${update.version}, current version: ${update.currentVersion}`
        );
        setUpdateAvailable(true);
        setUpdateVersion(update.version);
      }
    } catch (err) {
      console.error('Error checking for updates:', err);
      // Silently fail in browser environment
    }
  };

  const downloadAndInstall = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      
      const { update, error } = await safeCheckForUpdates();
      
      if (error) {
        setError(`Update failed: ${error}`);
        setIsDownloading(false);
        return;
      }

      if (!update) {
        setError('No update found.');
        setIsDownloading(false);
        return;
      }
      
      console.log('Starting update download:', update);
      
      let bytesDownloaded = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        console.log('Update event:', event);
        switch (event.event) {
          case 'Started':
            bytesDownloaded = 0;
            setDownloadProgress(0);
            console.log('Update download started');
            break;
          case 'Progress':
            bytesDownloaded += event.data?.chunkLength ?? 0;
            const animatedProgress = Math.min(90, (bytesDownloaded / (1024 * 1024 * 50)) * 100);
            setDownloadProgress(animatedProgress);
            console.log(`Downloaded: ${(bytesDownloaded / (1024 * 1024)).toFixed(1)} MB`);
            break;
          case 'Finished':
            setDownloadProgress(100);
            console.log('Update download finished');
            break;
        }
      });

      console.log('Relaunching application...');
      await relaunch();
    } catch (err) {
      console.error('Error downloading update:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Update failed: ${errorMessage}`);
      setIsDownloading(false);
    }
  };

  // Don't show banner if dismissed or no update available
  if (isDismissed || !updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 shadow-lg">
      <div className="max-w-[1800px] mx-auto px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold">
              {isDownloading ? 'Downloading Update...' : `New version ${updateVersion} available!`}
            </p>
            {error ? (
              <p className="text-red-200 text-sm">{error}</p>
            ) : isDownloading ? (
              <div className="flex items-center gap-2">
                <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <span className="text-white/90 text-xs font-medium">
                  {downloadProgress.toFixed(0)}%
                </span>
              </div>
            ) : (
              <p className="text-white/80 text-sm">Click to download and install</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isDownloading && (
            <>
              <button
                onClick={downloadAndInstall}
                className="px-4 py-2 bg-white text-blue-700 font-semibold rounded-lg hover:bg-white/90 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Update Now
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors duration-200"
                aria-label="Dismiss update notification"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
