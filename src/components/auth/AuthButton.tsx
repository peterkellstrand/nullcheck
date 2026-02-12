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
      <span className="text-neutral-600 text-sm">...</span>
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
          className="text-neutral-400 hover:text-[#ffffff] text-sm transition-colors"
        >
          {displayEmail}
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-2 border border-neutral-700 bg-black z-50">
              <button
                onClick={async () => {
                  await signOut();
                  setShowMenu(false);
                }}
                className="block w-full px-4 py-2 text-sm text-neutral-400 hover:text-[#ffffff] hover:bg-neutral-900 transition-colors text-left whitespace-nowrap"
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
        className="text-neutral-500 hover:text-[#ffffff] text-sm transition-colors"
      >
        sign in
      </button>
      <AuthModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
