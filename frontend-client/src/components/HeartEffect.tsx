import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Heart {
  id: number;
  x: number;
  y: number;
}

export const HeartEffect: React.FC<{ containerRef: React.RefObject<HTMLElement> }> = ({ containerRef }) => {
  const [hearts, setHearts] = useState<Heart[]>([]);

  const addHeart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const newHeart = { id: Date.now(), x, y };
    setHearts(prev => [...prev, newHeart]);
    
    // Auto-remove heart after animation
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 1000);
  }, [containerRef]);

  // We'll expose this via a global click listener on the container
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handleClick = (e: MouseEvent | TouchEvent) => {
      // Only trigger if clicking on the background, not on buttons
      if ((e.target as HTMLElement).classList.contains('video-background') || 
          (e.target as HTMLElement).classList.contains('auction-page-container')) {
        addHeart(e as any);
      }
    };
    
    el.addEventListener('mousedown', handleClick);
    el.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      el.removeEventListener('mousedown', handleClick);
      el.removeEventListener('touchstart', handleClick);
    };
  }, [containerRef, addHeart]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <AnimatePresence>
        {hearts.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 1, scale: 0.5, y: heart.y, x: heart.x }}
            animate={{ 
              opacity: 0, 
              scale: 1.5, 
              y: heart.y - 120,
              x: heart.x + (Math.random() * 40 - 20)
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute text-accent select-none"
            style={{ left: 0, top: 0 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
