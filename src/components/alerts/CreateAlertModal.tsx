'use client';

import { useState } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertType, CreateAlertRequest } from '@/types/alert';
import { ChainId } from '@/types/chain';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainId: ChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  currentPrice: number;
  onSuccess?: () => void;
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (price >= 0.0001) {
    return price.toFixed(6);
  }
  return price.toExponential(4);
}

export function CreateAlertModal({
  isOpen,
  onClose,
  chainId,
  tokenAddress,
  tokenSymbol,
  tokenName,
  currentPrice,
  onSuccess,
}: CreateAlertModalProps) {
  const { createAlert, activeAlertCount } = useAlerts();
  const { limits } = useSubscription();
  const [alertType, setAlertType] = useState<AlertType>('price_above');
  const [targetPrice, setTargetPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const target = parseFloat(targetPrice);
    if (isNaN(target) || target <= 0) {
      setError('Please enter a valid price');
      return;
    }

    // Validate target makes sense
    if (alertType === 'price_above' && target <= currentPrice) {
      setError('Target must be above current price');
      return;
    }
    if (alertType === 'price_below' && target >= currentPrice) {
      setError('Target must be below current price');
      return;
    }

    setIsSubmitting(true);

    const request: CreateAlertRequest = {
      chainId,
      tokenAddress,
      tokenSymbol,
      tokenName,
      alertType,
      targetPrice: target,
      currentPrice,
    };

    const result = await createAlert(request);

    setIsSubmitting(false);

    if (result.success) {
      onSuccess?.();
      onClose();
      setTargetPrice('');
    } else if (result.limitReached) {
      setShowUpgradePrompt(true);
    } else {
      setError(result.error || 'Failed to create alert');
    }
  };

  const percentChange = targetPrice
    ? (((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100).toFixed(1)
    : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80" onClick={onClose} />

        {/* Modal */}
        <div className="relative z-10 w-full max-w-md border-2 border-neutral-700 bg-neutral-900 p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-300"
          >
            [x]
          </button>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Create Price Alert</h2>
            <p className="mt-1 text-neutral-400">
              {tokenSymbol} {tokenName && `(${tokenName})`}
            </p>
          </div>

          {/* Current Price */}
          <div className="mb-6 border border-neutral-700 bg-neutral-800/50 p-4">
            <div className="text-sm text-neutral-500">Current Price</div>
            <div className="text-2xl font-mono text-white">${formatPrice(currentPrice)}</div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Alert Type */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-400 mb-2">Alert when price goes</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAlertType('price_above')}
                  className={`flex-1 py-2 px-4 border transition-colors ${
                    alertType === 'price_above'
                      ? 'border-green-500 bg-green-500/20 text-green-400'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  Above
                </button>
                <button
                  type="button"
                  onClick={() => setAlertType('price_below')}
                  className={`flex-1 py-2 px-4 border transition-colors ${
                    alertType === 'price_below'
                      ? 'border-red-500 bg-red-500/20 text-red-400'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  Below
                </button>
              </div>
            </div>

            {/* Target Price */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-400 mb-2">Target Price (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 pl-7 text-white font-mono focus:outline-none focus:border-neutral-500"
                />
              </div>
              {percentChange && !isNaN(parseFloat(percentChange)) && (
                <div className={`text-sm mt-1 ${parseFloat(percentChange) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {parseFloat(percentChange) >= 0 ? '+' : ''}{percentChange}% from current
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 text-sm text-red-400">{error}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !targetPrice}
              className="w-full py-3 bg-white text-black font-semibold hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-neutral-500">
            You&apos;ll receive an email when this alert triggers.
          </p>
        </div>
      </div>

      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="alerts"
        currentCount={activeAlertCount}
        limit={limits.alerts}
      />
    </>
  );
}
