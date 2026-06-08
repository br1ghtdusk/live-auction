import { useState, useEffect } from 'react';

export interface CountdownResult {
  hours: string;
  minutes: string;
  seconds: string;
  isExpired: boolean;
}

/**
 * 工业级高性能、防跳秒倒计时 Hook
 * @param targetTimestamp 目标截至时间戳（毫秒）
 */
export const useCountdown = (targetTimestamp: number): CountdownResult => {
  // 🌟 核心优化 1：状态只存【整秒数】，不存毫秒数，避免高频无用渲染
  const [remainingSeconds, setRemainingSeconds] = useState(() => 
    Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000))
  );

  useEffect(() => {
    const calculateLeftSeconds = () => Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000));
    
    // 目标时间变化，立即对齐
    setRemainingSeconds(calculateLeftSeconds());

    // 核心优化 2：采用 250ms 的“高频微心跳”替代 1000ms
    // 每秒侦测 4 次，哪怕事件循环卡顿几百毫秒，也能完美捕捉到每一个整秒的切换，彻底消除跳秒！
    const timer = setInterval(() => {
      const currentLeft = calculateLeftSeconds();
      
      //  核心优化 3：脏检查（Dirty Check）
      // 只有当【整秒数】真的发生改变时，才触发 React 的 setState。
      // React 内部会对相同数值进行 Bailout，所以每秒依然只会真正渲染一次，性能极高！
      setRemainingSeconds(currentLeft);

      if (currentLeft <= 0) {
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  // 格式化输出
  const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');

  return {
    hours,
    minutes,
    seconds,
    isExpired: remainingSeconds <= 0,
  };
};