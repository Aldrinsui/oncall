import type { RecentCall, ChartDataPoint } from '../types';

export interface ShiftProgress {
  callsCompleted: number;
  callsTotal: number;
  completedPct: number;
  visualPct: number;
  callsRemaining: number;
  isComplete: boolean;
}

export interface ConversionMetrics {
  conversionsCount: number;
  totalCalls: number;
  conversionRate: string;
  ratePct: number;
}

export interface ShiftPace {
  label: string;
  isPositive: boolean;
  color: string;
}

export interface EarningsBreakdown {
  totalEarnings: number;
  baseEarnings: number;
  bonusEarnings: number;
  todayEarnings: number;
  nextMilestone: number;
  milestoneProgressPct: number;
  conversionsTowardsMilestone: number;
}

// ─── 1. Duration Parsing & Formatting ─────────────────────────────

export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr || durationStr === '—' || durationStr.trim() === '') return 0;

  // Handle format like "6m 42s" or "3m 18s"
  const mMatch = durationStr.match(/(\d+)\s*m/);
  const sMatch = durationStr.match(/(\d+)\s*s/);

  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  const seconds = sMatch ? parseInt(sMatch[1], 10) : 0;

  if (mMatch || sMatch) {
    return minutes * 60 + seconds;
  }

  // Handle format like "04:22" or "4:22"
  const colonMatch = durationStr.match(/(\d+):(\d+)/);
  if (colonMatch) {
    return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  }

  return 0;
}

export function formatSecondsToDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '0m 00s';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

// ─── 2. Shift Progress Calculation ────────────────────────────────

export function calculateShiftProgress(completed: number, total: number = 18): ShiftProgress {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.max(0, completed);

  if (safeTotal === 0) {
    return {
      callsCompleted: safeCompleted,
      callsTotal: 0,
      completedPct: 0,
      visualPct: 0,
      callsRemaining: 0,
      isComplete: true,
    };
  }

  const rawPct = Math.round((safeCompleted / safeTotal) * 100);
  const visualPct = Math.min(100, Math.max(0, rawPct));
  const callsRemaining = Math.max(0, safeTotal - safeCompleted);

  return {
    callsCompleted: safeCompleted,
    callsTotal: safeTotal,
    completedPct: rawPct,
    visualPct,
    callsRemaining,
    isComplete: safeCompleted >= safeTotal,
  };
}

// ─── 3. Shift Pace Calculation ────────────────────────────────────

export function calculateShiftPace(
  completed: number,
  target: number = 18,
  currentTime?: Date
): ShiftPace {
  const now = currentTime || new Date();
  const hours = now.getHours() + now.getMinutes() / 60;

  // Shift is 10:00 AM to 7:00 PM (9 hours, ~2 calls/hr)
  const shiftStart = 10;
  const shiftEnd = 19;
  const shiftDuration = shiftEnd - shiftStart; // 9 hours
  const callRatePerHour = target / shiftDuration; // 2 calls/hr

  let expectedCalls: number;
  if (hours <= shiftStart) {
    expectedCalls = 1;
  } else if (hours >= shiftEnd) {
    expectedCalls = target;
  } else {
    expectedCalls = Math.round((hours - shiftStart) * callRatePerHour);
  }

  if (completed >= expectedCalls + 2) {
    return { label: 'Ahead of Pace ★', isPositive: true, color: '#0f6e56' };
  } else if (completed >= expectedCalls) {
    return { label: 'On Pace ✓', isPositive: true, color: '#1d9e75' };
  } else {
    return { label: 'Behind Pace ⚠️', isPositive: false, color: '#c8860a' };
  }
}

// ─── 4. Average Talk Time Calculation ─────────────────────────────

export function calculateAverageTalkTime(calls: RecentCall[], baselineCallsCount: number = 14): string {
  // Baseline demo average: 14 completed calls with avg duration ~ 262 seconds (4m 22s)
  const baselineTotalSeconds = 14 * 262; // 3,668 seconds total talk time

  let dynamicSeconds = 0;
  let dynamicCount = 0;

  // Only count calls that were completed (not missed or idle)
  calls.forEach((c) => {
    if (c.outcome !== 'Missed' && c.duration && c.duration !== '—') {
      const sec = parseDurationToSeconds(c.duration);
      if (sec > 0) {
        dynamicSeconds += sec;
        dynamicCount++;
      }
    }
  });

  if (dynamicCount === 0 && baselineCallsCount === 0) {
    return '0m 00s';
  }

  // Combined weighted average
  const totalSecs = baselineTotalSeconds + dynamicSeconds;
  const totalCount = baselineCallsCount + dynamicCount;
  const avgSecs = totalCount > 0 ? Math.round(totalSecs / totalCount) : 0;

  return formatSecondsToDuration(avgSecs);
}

// ─── 5. Conversion Metrics ────────────────────────────────────────

export function isQualifyingConversion(outcome?: string): boolean {
  if (!outcome) return false;
  const normalized = outcome.toLowerCase().trim();
  if (normalized.includes('not interested') || normalized.includes('uninterested')) {
    return false;
  }
  return (
    normalized.includes('interested') ||
    normalized.includes('resolved') ||
    normalized.includes('closed') ||
    normalized.includes('sale')
  );
}

export function calculateConversionMetrics(
  calls: RecentCall[],
  baselineConversions: number = 11,
  baselineCalls: number = 14
): ConversionMetrics {
  let newConversions = 0;
  let newValidCalls = 0;

  calls.forEach((c) => {
    if (c.outcome !== 'Missed') {
      newValidCalls++;
      if (isQualifyingConversion(c.outcome)) {
        newConversions++;
      }
    }
  });

  const totalConversions = baselineConversions + newConversions;
  const totalCalls = baselineCalls + newValidCalls;
  const ratePct = totalCalls > 0 ? Math.round((totalConversions / totalCalls) * 100) : 0;

  return {
    conversionsCount: totalConversions,
    totalCalls,
    conversionRate: `${ratePct}%`,
    ratePct,
  };
}

// ─── 6. Earnings & Incentive Calculation ──────────────────────────

export function calculateEarnings(newConversionsCount: number = 0): EarningsBreakdown {
  const baseEarnings = 3400; // Shift base salary
  const baselineBonuses = 1800; // Baseline 10-11 conversions achieved
  const bonusPerConversion = 180; // Explicit ₹180 incentive per closed sale
  const baselineTodayEarnings = 850;
  const nextMilestone = 6000;
  const targetConversions = 20;

  const additionalBonus = newConversionsCount * bonusPerConversion;
  const totalBonusEarnings = baselineBonuses + additionalBonus;
  const totalEarnings = baseEarnings + totalBonusEarnings;
  const todayEarnings = baselineTodayEarnings + additionalBonus;

  const milestoneProgressPct = Math.min(100, Math.round((totalEarnings / nextMilestone) * 100));
  const conversionsTowardsMilestone = 10 + newConversionsCount;

  return {
    totalEarnings,
    baseEarnings,
    bonusEarnings: totalBonusEarnings,
    todayEarnings,
    nextMilestone,
    milestoneProgressPct,
    conversionsTowardsMilestone,
  };
}

// ─── 7. 7-Day Chart Bucket Aggregation ────────────────────────────

export function aggregateWeeklyChartData(
  baseChartData: ChartDataPoint[],
  newCallsToday: RecentCall[]
): ChartDataPoint[] {
  // Determine current day key ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDayName = daysOfWeek[new Date().getDay()];

  let additionalCalls = 0;
  let additionalTalkMin = 0;
  let additionalConversions = 0;

  newCallsToday.forEach((c) => {
    if (c.outcome !== 'Missed') {
      additionalCalls++;
      additionalTalkMin += Math.round(parseDurationToSeconds(c.duration) / 60);
      if (isQualifyingConversion(c.outcome)) {
        additionalConversions++;
      }
    }
  });

  // Determine target day: match today's day of week, or fallback to 'Tue' (default demo active shift day)
  const targetDay = baseChartData.some((p) => p.day === todayDayName) ? todayDayName : 'Tue';

  return baseChartData.map((point) => {
    if (point.day === targetDay) {
      return {
        ...point,
        calls: point.calls + additionalCalls,
        talkTime: point.talkTime + additionalTalkMin,
        conversions: point.conversions + additionalConversions,
      };
    }
    return point;
  });
}
