'use client';

import { useState, useEffect, useRef } from 'react';

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

  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // ASCII wave animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const densityChars = " .'`^,:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
    const charSize = 14;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };

    const simpleNoise = (x: number, y: number, t: number): number => {
      return Math.sin(x * 0.03 + t) * Math.cos(y * 0.03 + t)
        + Math.sin(x * 0.01 - t * 0.5) * Math.cos(y * 0.08) * 0.5;
    };

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cols = Math.ceil(width / charSize);
      const rows = Math.ceil(height / charSize);

      ctx.clearRect(0, 0, width, height);
      ctx.font = `${charSize}px "SF Mono", SFMono-Regular, ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let y = 0; y < rows; y++) {
        // Only render in bottom portion
        if (y < rows * 0.3) continue;

        for (let x = 0; x < cols; x++) {
          const posX = x * charSize;
          const posY = y * charSize;

          const normalizedY = (rows - y) / rows;
          const noiseVal = simpleNoise(x, y, time * 0.5);
          const waveHeight = 0.25 + (Math.sin(x * 0.04 + time * 0.15) * 0.08) + (Math.cos(x * 0.15) * 0.04);

          if (normalizedY < waveHeight + (noiseVal * 0.08)) {
            const index = Math.floor(Math.abs(noiseVal) * densityChars.length);
            const char = densityChars[index % densityChars.length];
            const alpha = (1 - (normalizedY * 2.5)) * 0.35; // 35% max opacity

            ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, alpha)})`;
            ctx.fillText(char, posX + (charSize / 2), posY + (charSize / 2));
          }
        }
      }

      time += 0.008;
      animationId = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

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
      {/* ASCII wave background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
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
