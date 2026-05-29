import { useState, useEffect } from 'react';

export interface CountdownResult {
  hours: string;
  minutes: string;
  seconds: string;
  isExpired: boolean;
}

/**
 * 局部高性能倒计时 Hook
 * @param targetTimestamp 目标截至时间戳（毫秒）
 */
export const useCountdown = (targetTimestamp: number): CountdownResult => {
  const [remainingMs, setRemainingMs] = useState(() => 
    Math.max(0, targetTimestamp - Date.now())
  );

  useEffect(() => {
    // 目标时间变化时，立即对齐一次
    setRemainingMs(Math.max(0, targetTimestamp - Date.now()));

    const timer = setInterval(() => {
      const diff = targetTimestamp - Date.now();
      if (diff <= 0) {
        setRemainingMs(0);
        clearInterval(timer);
      } else {
        setRemainingMs(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return {
    hours,
    minutes,
    seconds,
    isExpired: remainingMs <= 0,
  };
};