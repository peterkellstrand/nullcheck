'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from './AuthModal';

export function AuthButton() {
  const { user, isLoading, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (isLoading) {
    return (
      <span className="text-[var(--text-muted)] text-sm">...</span>
    );
  }

  if (user) {
    const displayEmail = user.email
      ? user.email.length > 20
        ? user.email.slice(0, 17) + '...'
        : user.email
      : 'user';

    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
        >
          {displayEmail}
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-2 border border-[var(--border-light)] bg-[var(--bg-primary)] z-50">
              <button
                onClick={async () => {
                  await signOut();
                  setShowMenu(false);
                }}
                className="block w-full px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left whitespace-nowrap"
              >
                sign out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors"
      >
        sign in
      </button>
      <AuthModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
