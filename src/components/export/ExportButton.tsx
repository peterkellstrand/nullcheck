'use client';

import { useState, useRef, useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';

interface ExportButtonProps {
  type: 'watchlist' | 'tokens';
  className?: string;
}

export function ExportButton({ type, className }: ExportButtonProps) {
  const { limits } = useSubscription();
  const hasExport = limits.hasExport;
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      const response = await fetch(`/api/export?type=${type}&format=${format}`);

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'EXPORT_REQUIRES_PRO') {
          alert('Export requires a PRO subscription');
          return;
        }
        throw new Error(data.error || 'Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `export.${format}`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasExport) {
    return (
      <Link
        href="/pricing"
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-700 text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors ${className}`}
        title="Export requires PRO"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>export</span>
        <span className="text-[10px] px-1 py-0.5 bg-emerald-500/20 text-emerald-500">PRO</span>
      </Link>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{isExporting ? 'exporting...' : 'export'}</span>
        {!isExporting && <span className="text-xs">▼</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 min-w-[120px] border border-neutral-700 bg-neutral-900 shadow-lg z-50">
          <button
            onClick={() => handleExport('csv')}
            className="block w-full px-4 py-2 text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="block w-full px-4 py-2 text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
