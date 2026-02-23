'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts } from '@/hooks/useAlerts';
import { ChainId } from '@/types/chain';
import { AuthModal } from '@/components/auth/AuthModal';
import { CreateAlertModal } from './CreateAlertModal';

interface AlertButtonProps {
  chainId: ChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  currentPrice: number;
}

export function AlertButton({
  chainId,
  tokenAddress,
  tokenSymbol,
  tokenName,
  currentPrice,
}: AlertButtonProps) {
  const { isAuthenticated } = useAuth();
  const { alerts } = useAlerts();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Count alerts for this specific token
  const tokenAlerts = alerts.filter(
    (a) =>
      a.chainId === chainId &&
      a.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
      !a.isTriggered
  );

  const handleClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setShowAlertModal(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
        title="Set price alert"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span className="text-sm">
          {tokenAlerts.length > 0 ? `${tokenAlerts.length} alert${tokenAlerts.length > 1 ? 's' : ''}` : 'alert'}
        </span>
      </button>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <CreateAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        chainId={chainId}
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        currentPrice={currentPrice}
      />
    </>
  );
}
