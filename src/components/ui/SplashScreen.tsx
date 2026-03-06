'use client';

import { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  placeholderMode?: boolean;
}

export function SplashScreen({ onComplete, placeholderMode = false }: SplashScreenProps) {
  const [displayText, setDisplayText] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [typingComplete, setTypingComplete] = useState(false);

  const fullText = 'null//check';
  const typingSpeed = 150; // ms per character
  const cursorBlinkTime = 1200; // ms to show cursor after typing
  const fadeDuration = 600; // ms for fade out

  useEffect(() => {
    // In placeholder mode, always show the animation
    // Otherwise check if already shown this session
    if (!placeholderMode && typeof window !== 'undefined' && sessionStorage.getItem('splashShown')) {
      setIsVisible(false);
      onComplete?.();
      return;
    }

    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeNextChar, typingSpeed);
      } else {
        // Typing complete
        setTypingComplete(true);

        if (placeholderMode) {
          // In placeholder mode, just hide cursor and stay
          setTimeout(() => {
            setShowCursor(false);
          }, cursorBlinkTime);
        } else {
          // Normal mode: hide cursor then fade out
          setTimeout(() => {
            setShowCursor(false);
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

    // Start typing after a brief delay
    const startDelay = setTimeout(typeNextChar, 400);

    return () => clearTimeout(startDelay);
  }, [onComplete, placeholderMode]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity ${
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
    </div>
  );
}
