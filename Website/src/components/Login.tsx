import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTVNavigation } from '../hooks/useTVNavigation';
import type { LoginCredentials } from '../types/emby.types';

export function Login() {
  const { login } = useAuth();
  // Enable D-Pad navigation between form fields on TV
  useTVNavigation();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    serverUrl: localStorage.getItem('emby_server_url') || '',
    username: localStorage.getItem('emby_username') || '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Save server URL and username for next time
      localStorage.setItem('emby_server_url', credentials.serverUrl);
      localStorage.setItem('emby_username', credentials.username);

      await login(credentials);
    } catch (err) {
      setError('Login failed. Please check your credentials and server URL.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="max-w-md w-full">
        <div className="bg-dark-card rounded-lg shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <img src="/Logo.png" alt="Aether" className="h-32 object-contain rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Emby Web Client
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Sign in to your Emby server
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="serverUrl" className="block text-sm font-medium text-gray-300 mb-2">
                Server URL
              </label>
              <input
                id="serverUrl"
                type="text"
                placeholder="http://192.168.1.100:8096"
                value={credentials.serverUrl}
                onChange={(e) => setCredentials({ ...credentials, serverUrl: e.target.value })}
                className="w-full px-4 py-3 bg-dark-bg border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Include http:// or https:// and port number
              </p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full px-4 py-3 bg-dark-bg border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-4 py-3 bg-dark-bg border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
