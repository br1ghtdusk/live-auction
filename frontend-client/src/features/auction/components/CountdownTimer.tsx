import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { useCountdown } from '../hooks/useCountdown';

interface CountdownTimerProps {
  /** 倒计时截止目标时间戳（毫秒） */
  targetTime: number;
  /** 是否进入最后冲刺紧迫状态 */
  isUrgent: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = React.memo(({
  targetTime,
  isUrgent,
}) => {
  const { hours, minutes, seconds, isExpired } = useCountdown(targetTime);

  // 如果倒计时结束或目标时间无效，则不渲染任何 DOM
  if (isExpired || targetTime === 0) return null;

  return (
    <div className={cn('countdown-badge', isUrgent && 'countdown-urgent')}>
      <span className="time-display">
        <span className="icon">⏱️</span>
        <span className="time-numbers">
          {hours}:{minutes}:{seconds}
        </span>
      </span>
    </div>
  );
});

CountdownTimer.displayName = 'CountdownTimer';
