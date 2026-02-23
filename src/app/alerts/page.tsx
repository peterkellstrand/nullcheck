'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts } from '@/hooks/useAlerts';
import { useSubscription } from '@/hooks/useSubscription';
import { AuthModal } from '@/components/auth/AuthModal';
import { PriceAlert } from '@/types/alert';
import { CHAINS } from '@/types/chain';

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  }
  return `$${price.toExponential(4)}`;
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

function AlertRow({
  alert,
  onDelete,
}: {
  alert: PriceAlert;
  onDelete: (id: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const chain = CHAINS[alert.chainId];

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(alert.id);
    setIsDeleting(false);
  };

  const direction = alert.alertType === 'price_above' ? 'above' : 'below';
  const arrow = alert.alertType === 'price_above' ? '↑' : '↓';
  const color = alert.alertType === 'price_above' ? 'text-green-500' : 'text-red-500';

  return (
    <div className={`border-b border-neutral-800 p-4 ${alert.isTriggered ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Token info */}
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/token/${alert.chainId}/${alert.tokenAddress}`}
              className="text-white hover:text-neutral-300 font-medium"
            >
              {alert.tokenSymbol}
            </Link>
            <span className="text-xs text-neutral-600">{chain?.symbol || alert.chainId}</span>
            {alert.isTriggered && (
              <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400">triggered</span>
            )}
          </div>

          {/* Alert condition */}
          <div className="text-sm text-neutral-400">
            <span className={color}>{arrow}</span> {direction}{' '}
            <span className="font-mono text-neutral-300">{formatPrice(alert.targetPrice)}</span>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-neutral-600 mt-1">
            {alert.isTriggered ? (
              <>
                Triggered {formatTimeAgo(alert.triggeredAt!)} at{' '}
                <span className="font-mono">{formatPrice(alert.triggeredPrice!)}</span>
              </>
            ) : (
              <>
                Created {formatTimeAgo(alert.createdAt)} at{' '}
                <span className="font-mono">{formatPrice(alert.createdPrice)}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!alert.isTriggered && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-neutral-600 hover:text-red-500 transition-colors text-sm"
          >
            {isDeleting ? '...' : 'delete'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { alerts, isLoading, deleteAlert, activeAlertCount } = useAlerts();
  const { limits } = useSubscription();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const activeAlerts = alerts.filter((a) => !a.isTriggered);
  const triggeredAlerts = alerts.filter((a) => a.isTriggered);

  if (authLoading) {
    return (
      <div className="w-full max-w-4xl relative">
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-6">
          <div className="text-neutral-500">loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl relative">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-neutral-500 hover:text-white text-sm transition-colors"
          >
            &larr; back
          </button>
          <h1 className="text-3xl sm:text-4xl text-neutral-100">alerts</h1>
        </div>
        {isAuthenticated && (
          <div className="text-sm text-neutral-500">
            {activeAlertCount}/{limits.alerts === Infinity ? '∞' : limits.alerts} active
          </div>
        )}
      </div>

      {/* Main Terminal Window */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {!isAuthenticated ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 mb-4">sign in to manage your price alerts</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="border border-[var(--border)] px-4 py-2 text-sm text-white hover:bg-neutral-900 transition-colors"
            >
              sign in
            </button>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center">
            <div className="text-neutral-500">loading alerts...</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 mb-2">no alerts set</p>
            <p className="text-neutral-600 text-sm">
              click the bell icon on any token page to create an alert
            </p>
          </div>
        ) : (
          <div>
            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
              <div>
                <div className="px-4 py-2 border-b border-neutral-700 bg-neutral-800/30">
                  <span className="text-sm text-neutral-400">Active ({activeAlerts.length})</span>
                </div>
                {activeAlerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
                ))}
              </div>
            )}

            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
              <div>
                <div className="px-4 py-2 border-b border-neutral-700 bg-neutral-800/30">
                  <span className="text-sm text-neutral-400">Triggered ({triggeredAlerts.length})</span>
                </div>
                {triggeredAlerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help text */}
      {isAuthenticated && alerts.length > 0 && (
        <p className="mt-4 text-xs text-neutral-600 ml-1">
          Alerts are checked every 5 minutes. You&apos;ll receive an email when triggered.
        </p>
      )}
    </div>
  );
}
