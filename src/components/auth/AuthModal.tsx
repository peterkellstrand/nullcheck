'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await signInWithMagicLink(email);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send magic link');
    }
  };

  const handleClose = () => {
    setEmail('');
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative border-2 border-[#ffffff] bg-black p-6 w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg text-[#ffffff]">sign in</h2>
          <button
            onClick={handleClose}
            className="text-neutral-500 hover:text-[#ffffff] transition-colors"
          >
            x
          </button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-4">
            <p className="text-green-500 mb-2">check your email</p>
            <p className="text-neutral-500 text-sm">
              we sent a magic link to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                className="w-full bg-neutral-900 border border-neutral-700 text-[#ffffff] px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#ffffff] transition-colors"
                disabled={status === 'loading'}
                autoFocus
              />
            </div>

            {status === 'error' && (
              <p className="text-red-500 text-sm mb-4">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="w-full border border-[#ffffff] bg-black text-[#ffffff] py-2 text-sm hover:bg-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'sending...' : 'send magic link'}
            </button>

            <p className="text-neutral-600 text-xs mt-4 text-center">
              no password needed. we'll email you a link.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
