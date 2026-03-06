'use client';

import { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  placeholderMode?: boolean;
}

export function SplashScreen({ onComplete, placeholderMode = false }: SplashScreenProps) {
  const [displayText, setDisplayText] = useState('');
  const [taglineText, setTaglineText] = useState('');
  const [comingSoonText, setComingSoonText] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [showTaglineCursor, setShowTaglineCursor] = useState(false);
  const [showComingSoonCursor, setShowComingSoonCursor] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);
  const [taglineComplete, setTaglineComplete] = useState(false);

  const fullText = 'null//check';
  const tagline = 'know if you can sell before you buy.';
  const comingSoon = 'coming soon...';
  const cursorBlinkTime = 1200; // ms to show cursor after typing
  const fadeDuration = 600; // ms for fade out

  // Variable typing speed to mimic human typing
  const getTypingDelay = (index: number): number => {
    // "null" (indices 0-3) = faster
    // "//check" (indices 4-10) = slower, with slight pause before "//"
    if (index < 4) return 180; // "null" - fast
    if (index === 4) return 400; // pause before first "/"
    if (index === 5) return 250; // second "/"
    return 250; // "check" - slightly slower
  };

  // Tagline typing with natural variation
  const getTaglineDelay = (char: string): number => {
    if (char === ' ') return 120;
    if (char === '.') return 280;
    return 100 + Math.random() * 60;
  };

  // Coming soon typing
  const getComingSoonDelay = (char: string): number => {
    if (char === ' ') return 120;
    if (char === '.') return 220;
    return 120 + Math.random() * 50;
  };

  useEffect(() => {
    if (!placeholderMode && typeof window !== 'undefined' && sessionStorage.getItem('splashShown')) {
      setIsVisible(false);
      onComplete?.();
      return;
    }

    let currentIndex = 0;

    const typeComingSoon = () => {
      let comingSoonIndex = 0;
      setShowComingSoonCursor(true);

      const typeNextComingSoonChar = () => {
        if (comingSoonIndex < comingSoon.length) {
          setComingSoonText(comingSoon.slice(0, comingSoonIndex + 1));
          const delay = getComingSoonDelay(comingSoon[comingSoonIndex]);
          comingSoonIndex++;
          setTimeout(typeNextComingSoonChar, delay);
        } else {
          if (placeholderMode) {
            setTimeout(() => setShowComingSoonCursor(false), cursorBlinkTime);
          } else {
            setTimeout(() => {
              setShowComingSoonCursor(false);
              setTimeout(() => {
                setIsFading(true);
                setTimeout(() => {
                  setIsVisible(false);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('splashShown', 'true');
                  }
                  onComplete?.();
                }, fadeDuration);
              }, 200);
            }, cursorBlinkTime);
          }
        }
      };

      typeNextComingSoonChar();
    };

    const typeTagline = () => {
      let taglineIndex = 0;
      setShowTaglineCursor(true);

      const typeNextTaglineChar = () => {
        if (taglineIndex < tagline.length) {
          setTaglineText(tagline.slice(0, taglineIndex + 1));
          const delay = getTaglineDelay(tagline[taglineIndex]);
          taglineIndex++;
          setTimeout(typeNextTaglineChar, delay);
        } else {
          setTaglineComplete(true);
          setShowTaglineCursor(false);
          setTimeout(typeComingSoon, 300);
        }
      };

      typeNextTaglineChar();
    };

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex + 1));
        const delay = getTypingDelay(currentIndex);
        currentIndex++;
        setTimeout(typeNextChar, delay);
      } else {
        setTypingComplete(true);
        setShowCursor(false);
        setTimeout(typeTagline, 400);
      }
    };

    const startDelay = setTimeout(typeNextChar, 400);
    return () => clearTimeout(startDelay);
  }, [onComplete, placeholderMode]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${fadeDuration}ms` }}
    >
      <h1 className="text-5xl sm:text-7xl md:text-8xl text-white font-normal tracking-tight inline-flex items-center">
        {displayText}
        {showCursor && (
          <span
            className="inline-block ml-1 bg-white"
            style={{ width: '0.5em', height: '1em' }}
          />
        )}
      </h1>
      <p className="mt-2 text-sm sm:text-base font-mono font-light tracking-wide inline-flex items-center h-5" style={{ color: '#ffffff' }}>
        {taglineText}
        {showTaglineCursor && (
          <span
            className="inline-block ml-0.5"
            style={{ width: '0.35em', height: '0.9em', backgroundColor: '#ffffff' }}
          />
        )}
      </p>
      <p className="mt-1 text-sm sm:text-base font-mono font-light tracking-wide inline-flex items-center h-5" style={{ color: '#ffffff' }}>
        {comingSoonText}
        {showComingSoonCursor && (
          <span
            className="inline-block ml-0.5"
            style={{ width: '0.35em', height: '0.9em', backgroundColor: '#ffffff' }}
          />
        )}
      </p>
    </div>
  );
}
