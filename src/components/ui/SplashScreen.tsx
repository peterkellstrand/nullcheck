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
  const [cursorBlinking, setCursorBlinking] = useState(true);
  const [showTaglineCursor, setShowTaglineCursor] = useState(false);
  const [showComingSoonCursor, setShowComingSoonCursor] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);
  const [taglineComplete, setTaglineComplete] = useState(false);
  const [allComplete, setAllComplete] = useState(false);

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
            // Keep cursor visible and start blinking
            setAllComplete(true);
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

    const startDelay = setTimeout(() => {
      setCursorBlinking(false);
      typeNextChar();
    }, 4000);
    return () => clearTimeout(startDelay);
  }, [onComplete, placeholderMode]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${fadeDuration}ms`, backgroundColor: '#EDEBE6' }}
    >
      {/* Geometric wave pattern background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg
          className="absolute w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke="#000000"
                strokeWidth="0.5"
                opacity="0.04"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Animated wave lines */}
          {[...Array(8)].map((_, i) => (
            <path
              key={i}
              d={`M -100 ${150 + i * 80} Q ${200 + i * 20} ${100 + i * 80}, 400 ${150 + i * 80} T 900 ${150 + i * 80} T 1400 ${150 + i * 80} T 1900 ${150 + i * 80} T 2400 ${150 + i * 80}`}
              fill="none"
              stroke="#000000"
              strokeWidth="0.5"
              opacity="0.06"
              className="animate-wave"
              style={{
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </svg>
      </div>
      <h1 className="text-5xl sm:text-7xl md:text-8xl font-normal tracking-tight inline-flex items-center relative z-10" style={{ color: '#000000' }}>
        {displayText}
        {showCursor && (
          <span
            className={`inline-block ml-1 ${cursorBlinking ? 'animate-cursor-blink-light' : ''}`}
            style={{ width: '0.5em', height: '1em', backgroundColor: '#000000' }}
          />
        )}
      </h1>
      <p className="mt-2 text-sm sm:text-base font-mono font-light tracking-wide inline-flex items-center h-5 relative z-10" style={{ color: '#000000' }}>
        {taglineText}
        {showTaglineCursor && (
          <span
            className="inline-block ml-0.5"
            style={{ width: '0.35em', height: '0.9em', backgroundColor: '#000000' }}
          />
        )}
      </p>
      <p className="mt-1 text-sm sm:text-base font-mono font-light tracking-wide inline-flex items-center h-5 relative z-10" style={{ color: '#000000' }}>
        {comingSoonText}
        {showComingSoonCursor && (
          <span
            className={`inline-block ml-0.5 ${allComplete ? 'animate-cursor-blink-light' : ''}`}
            style={{
              width: '0.35em',
              height: '0.9em',
              backgroundColor: '#000000'
            }}
          />
        )}
      </p>
    </div>
  );
}
