'use client';

import { useState, useEffect, useContext } from 'react';
import { ChainId } from '@/types/chain';
import { AuthContext } from '@/components/Providers';
import { getFingerprint } from '@/lib/fingerprint';

interface SentimentVoteProps {
  chainId: ChainId;
  tokenAddress: string;
}

interface SentimentData {
  bullishCount: number;
  bearishCount: number;
  totalVotes: number;
  bullishPercent: number;
  userVote: 'bullish' | 'bearish' | null;
}

export function SentimentVote({ chainId, tokenAddress }: SentimentVoteProps) {
  const { user } = useContext(AuthContext);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    async function fetchSentiment() {
      try {
        const response = await fetch(`/api/sentiment/${chainId}/${tokenAddress}`);
        const data = await response.json();
        if (data.success) {
          setSentiment(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch sentiment:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSentiment();
  }, [chainId, tokenAddress]);

  const handleVote = async (vote: 'bullish' | 'bearish') => {
    if (isVoting) return;

    setIsVoting(true);
    try {
      const fingerprint = user ? undefined : await getFingerprint();

      const response = await fetch(`/api/sentiment/${chainId}/${tokenAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, fingerprint }),
      });

      const data = await response.json();
      if (data.success) {
        setSentiment(data.data);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-24 bg-neutral-800 animate-pulse rounded" />
        <div className="h-8 w-24 bg-neutral-800 animate-pulse rounded" />
      </div>
    );
  }

  const bullishPercent = sentiment?.bullishPercent || 50;
  const bearishPercent = 100 - bullishPercent;
  const totalVotes = sentiment?.totalVotes || 0;
  const userVote = sentiment?.userVote;

  return (
    <div className="space-y-2">
      {/* Vote Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleVote('bullish')}
          disabled={isVoting}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded ${
            userVote === 'bullish'
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'bg-neutral-800 text-neutral-400 hover:text-green-400 hover:bg-green-500/10 border border-transparent'
          }`}
        >
          <span>🟢</span>
          <span>Bullish</span>
          <span className="text-xs opacity-70">{sentiment?.bullishCount || 0}</span>
        </button>

        <button
          onClick={() => handleVote('bearish')}
          disabled={isVoting}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded ${
            userVote === 'bearish'
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-neutral-800 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent'
          }`}
        >
          <span>🔴</span>
          <span>Bearish</span>
          <span className="text-xs opacity-70">{sentiment?.bearishCount || 0}</span>
        </button>

        {totalVotes > 0 && (
          <span className="text-xs text-neutral-500 ml-2">
            {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Sentiment Bar */}
      {totalVotes > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
              style={{ width: `${bullishPercent}%` }}
            />
          </div>
          <span className="text-xs text-neutral-400 w-12 text-right">
            {bullishPercent.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
