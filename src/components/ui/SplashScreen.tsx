'use client';

import { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  placeholderMode?: boolean;
}

export function SplashScreen({ onComplete, placeholderMode = false }: SplashScreenProps) {
  const [displayText, setDisplayText] = useState('');
  const [taglineText, setTaglineText] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [showTaglineCursor, setShowTaglineCursor] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);

  const fullText = 'null//check';
  const tagline = 'Know if you can sell before you buy.';
  const cursorBlinkTime = 1200; // ms to show cursor after typing
  const fadeDuration = 600; // ms for fade out

  // Variable typing speed to mimic human typing
  const getTypingDelay = (index: number): number => {
    // "null" (indices 0-3) = faster
    // "//check" (indices 4-10) = slower, with slight pause before "//"
    if (index < 4) return 120; // "null" - fast
    if (index === 4) return 300; // pause before first "/"
    if (index === 5) return 180; // second "/"
    return 180; // "check" - slightly slower
  };

  // Tagline typing with natural variation
  const getTaglineDelay = (char: string, index: number): number => {
    if (char === ' ') return 80; // spaces are quick
    if (char === '.') return 200; // pause slightly on period
    // Add slight randomness for human feel
    return 60 + Math.random() * 40;
  };

  useEffect(() => {
    // In placeholder mode, always show the animation
    // Otherwise check if already shown this session
    if (!placeholderMode && typeof window !== 'undefined' && sessionStorage.getItem('splashShown')) {
      setIsVisible(false);
      onComplete?.();
      return;
    }

    let currentIndex = 0;

    const typeTagline = () => {
      let taglineIndex = 0;
      setShowTaglineCursor(true);

      const typeNextTaglineChar = () => {
        if (taglineIndex < tagline.length) {
          setTaglineText(tagline.slice(0, taglineIndex + 1));
          const delay = getTaglineDelay(tagline[taglineIndex], taglineIndex);
          taglineIndex++;
          setTimeout(typeNextTaglineChar, delay);
        } else {
          // Tagline complete
          if (placeholderMode) {
            setTimeout(() => {
              setShowTaglineCursor(false);
            }, cursorBlinkTime);
          } else {
            setTimeout(() => {
              setShowTaglineCursor(false);
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

      typeNextTaglineChar();
    };

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex + 1));
        const delay = getTypingDelay(currentIndex);
        currentIndex++;
        setTimeout(typeNextChar, delay);
      } else {
        // Main text complete, hide cursor and start tagline
        setTypingComplete(true);
        setShowCursor(false);
        setTimeout(typeTagline, 400); // Brief pause before tagline
      }
    };

    // Start typing after a brief delay
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
      <p className="mt-4 text-sm sm:text-base md:text-lg font-mono font-light tracking-wide inline-flex items-center h-6" style={{ color: '#ffffff' }}>
        {taglineText}
        {showTaglineCursor && (
          <span
            className="inline-block ml-0.5"
            style={{ width: '0.35em', height: '0.9em', backgroundColor: '#ffffff' }}
          />
        )}
      </p>
    </div>
  );
}
