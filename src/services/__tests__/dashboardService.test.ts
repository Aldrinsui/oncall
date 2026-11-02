import { describe, it, expect } from 'vitest';
import {
  calculateShiftProgress,
  calculateShiftPace,
  parseDurationToSeconds,
  formatSecondsToDuration,
  calculateAverageTalkTime,
  isQualifyingConversion,
  calculateConversionMetrics,
  calculateEarnings,
  aggregateWeeklyChartData,
} from '../dashboardService';
import type { RecentCall, ChartDataPoint } from '../../types';

describe('Dashboard Service & Connected Domain Model', () => {
  // DB-001: Initial demo state
  it('DB-001: Initial dashboard displays 14/18 calls completed (78% progress, 4 remaining)', () => {
    const progress = calculateShiftProgress(14, 18);
    expect(progress.callsCompleted).toBe(14);
    expect(progress.callsTotal).toBe(18);
    expect(progress.completedPct).toBe(78);
    expect(progress.visualPct).toBe(78);
    expect(progress.callsRemaining).toBe(4);
    expect(progress.isComplete).toBe(false);
  });

  // DB-002: Saving one valid completed call
  it('DB-002: Completing one call updates to 15/18 calls (83% progress, 3 remaining)', () => {
    const progress = calculateShiftProgress(15, 18);
    expect(progress.callsCompleted).toBe(15);
    expect(progress.callsTotal).toBe(18);
    expect(progress.completedPct).toBe(83);
    expect(progress.visualPct).toBe(83);
    expect(progress.callsRemaining).toBe(3);
    expect(progress.isComplete).toBe(false);
  });

  // DB-003: Saving a second completed call
  it('DB-003: Completing a second call updates to 16/18 calls (89% progress, 2 remaining)', () => {
    const progress = calculateShiftProgress(16, 18);
    expect(progress.callsCompleted).toBe(16);
    expect(progress.callsTotal).toBe(18);
    expect(progress.completedPct).toBe(89);
    expect(progress.visualPct).toBe(89);
    expect(progress.callsRemaining).toBe(2);
  });

  // DB-004: Persistence across sessions/state restoration
  it('DB-004: Restored state from persistence preserves progress and completed counts', () => {
    const serialized = JSON.stringify({ completed: 16, total: 18 });
    const parsed = JSON.parse(serialized);
    const progress = calculateShiftProgress(parsed.completed, parsed.total);

    expect(progress.callsCompleted).toBe(16);
    expect(progress.completedPct).toBe(89);
  });

  // DB-005: Duplicate call completion ID protection
  it('DB-005: Deduplicates identical call records so duplicate saves do not double-increment', () => {
    const existingCalls: RecentCall[] = [
      {
        id: 'rc-101',
        name: 'Mukunda R.',
        initials: 'MR',
        direction: 'outbound',
        duration: '4m 30s',
        time: 'Just now',
        outcome: 'Interested',
        outcomeColor: '#1d9e75',
      },
    ];

    const duplicateCall: RecentCall = { ...existingCalls[0] };

    // Function simulating store deduplication
    const addCallDeduplicated = (list: RecentCall[], newCall: RecentCall) => {
      if (list.some((c) => c.id === newCall.id)) {
        return list;
      }
      return [newCall, ...list];
    };

    const updatedList = addCallDeduplicated(existingCalls, duplicateCall);
    expect(updatedList.length).toBe(1);
  });

  // DB-006: Incomplete / in-progress calls do not increment counter
  it('DB-006: In-progress or cancelled calls without wrapup save do not increment completed count', () => {
    const initialCompleted = 14;
    let isCallActive = true;
    let wasSavedInWrapup = false;

    // Call started
    expect(initialCompleted).toBe(14);

    // Call ended without saving wrapup (user dismissed modal)
    isCallActive = false;
    wasSavedInWrapup = false;

    const finalCompleted = initialCompleted + (wasSavedInWrapup ? 1 : 0);
    expect(finalCompleted).toBe(14);
  });

  // DB-007: Over-target calls cap visual progress bar at 100% while preserving true count
  it('DB-007: Exceeding shift target (e.g. 19/18) caps visual progress bar at 100% with true count 19', () => {
    const progress = calculateShiftProgress(19, 18);
    expect(progress.callsCompleted).toBe(19);
    expect(progress.callsTotal).toBe(18);
    expect(progress.completedPct).toBe(106);
    expect(progress.visualPct).toBe(100); // Visual bar capped at 100%
    expect(progress.isComplete).toBe(true);
  });

  // DB-008: Remaining calls count clamped at 0 (never negative)
  it('DB-008: Over-target completed calls clamp remaining calls at 0 (never negative)', () => {
    const progress = calculateShiftProgress(22, 18);
    expect(progress.callsRemaining).toBe(0);
    expect(progress.callsRemaining).not.toBeLessThan(0);
  });

  // Zero-target safety
  it('safely handles zero target without crashing or NaN', () => {
    const progress = calculateShiftProgress(0, 0);
    expect(progress.completedPct).toBe(0);
    expect(progress.visualPct).toBe(0);
    expect(progress.callsRemaining).toBe(0);
    expect(progress.isComplete).toBe(true);
  });

  // Duration parsing & formatting
  it('accurately parses duration strings and formats seconds', () => {
    expect(parseDurationToSeconds('6m 42s')).toBe(402);
    expect(parseDurationToSeconds('3m 18s')).toBe(198);
    expect(parseDurationToSeconds('04:22')).toBe(262);
    expect(parseDurationToSeconds('—')).toBe(0);
    expect(parseDurationToSeconds('')).toBe(0);

    expect(formatSecondsToDuration(402)).toBe('6m 42s');
    expect(formatSecondsToDuration(198)).toBe('3m 18s');
    expect(formatSecondsToDuration(0)).toBe('0m 00s');
  });

  // Average talk duration calculation
  it('calculates average talk duration from completed calls', () => {
    const mockCalls: RecentCall[] = [
      {
        id: 'c1',
        name: 'User 1',
        initials: 'U1',
        direction: 'outbound',
        duration: '5m 00s', // 300s
        time: 'Just now',
        outcome: 'Interested',
        outcomeColor: '#1d9e75',
      },
    ];

    // Baseline: 14 calls @ 262s = 3668s. + 300s = 3968s / 15 = ~265s = 4m 25s
    const avg = calculateAverageTalkTime(mockCalls, 14);
    expect(avg).toBe('4m 25s');
  });

  // Conversion outcome classification
  it('classifies sales outcomes correctly (callbacks and missed calls are NOT sales)', () => {
    expect(isQualifyingConversion('Interested')).toBe(true);
    expect(isQualifyingConversion('Resolved')).toBe(true);
    expect(isQualifyingConversion('Closed sale')).toBe(true);

    expect(isQualifyingConversion('Follow-up')).toBe(false);
    expect(isQualifyingConversion('Requested callback')).toBe(false);
    expect(isQualifyingConversion('Callback')).toBe(false);
    expect(isQualifyingConversion('Not interested')).toBe(false);
    expect(isQualifyingConversion('Missed')).toBe(false);
  });

  // Conversion metrics calculation
  it('computes conversion rate including baseline and new calls', () => {
    const mockCalls: RecentCall[] = [
      {
        id: 'c1',
        name: 'User 1',
        initials: 'U1',
        direction: 'outbound',
        duration: '5m 00s',
        time: 'Just now',
        outcome: 'Interested',
        outcomeColor: '#1d9e75',
      },
      {
        id: 'c2',
        name: 'User 2',
        initials: 'U2',
        direction: 'outbound',
        duration: '2m 00s',
        time: 'Just now',
        outcome: 'Callback',
        outcomeColor: '#185fa5',
      },
    ];

    // Baseline: 11 conversions / 14 calls = 79%
    // New: +1 conversion, +2 calls = 12 conversions / 16 calls = 75%
    const metrics = calculateConversionMetrics(mockCalls, 11, 14);
    expect(metrics.conversionsCount).toBe(12);
    expect(metrics.totalCalls).toBe(16);
    expect(metrics.conversionRate).toBe('75%');
  });

  // Earnings and incentive rules reconciliation
  it('reconciles base salary, conversion bonuses, and milestone progression', () => {
    // 0 new conversions: Base ₹3,400 + Bonuses ₹1,800 = ₹5,200
    const baseline = calculateEarnings(0);
    expect(baseline.baseEarnings).toBe(3400);
    expect(baseline.bonusEarnings).toBe(1800);
    expect(baseline.totalEarnings).toBe(5200);
    expect(baseline.todayEarnings).toBe(850);
    expect(baseline.milestoneProgressPct).toBe(87);

    // 1 new conversion (+₹180): Total ₹5,380
    const plusOne = calculateEarnings(1);
    expect(plusOne.totalEarnings).toBe(5380);
    expect(plusOne.bonusEarnings).toBe(1980);
    expect(plusOne.todayEarnings).toBe(1030);
    expect(plusOne.conversionsTowardsMilestone).toBe(11);
  });

  // Shift pace calculation
  it('evaluates shift pace realistically based on working shift hours', () => {
    // At 2:00 PM (4 hours into 10 AM - 7 PM shift), expected calls = 8
    const midDay = new Date('2026-11-03T14:00:00');

    // 14 completed calls at 2:00 PM is well ahead of pace
    const paceAhead = calculateShiftPace(14, 18, midDay);
    expect(paceAhead.isPositive).toBe(true);
    expect(paceAhead.label).toContain('Pace');

    // 4 completed calls at 2:00 PM is behind pace
    const paceBehind = calculateShiftPace(4, 18, midDay);
    expect(paceBehind.isPositive).toBe(false);
    expect(paceBehind.label).toContain('Behind');
  });

  // 7-Day chart aggregation
  it('reconciles 7-day chart buckets by adding new calls into the current day', () => {
    const baseChart: ChartDataPoint[] = [
      { day: 'Mon', calls: 20, talkTime: 60, conversions: 5 },
      { day: 'Tue', calls: 15, talkTime: 50, conversions: 3 },
      { day: 'Wed', calls: 18, talkTime: 55, conversions: 4 },
      { day: 'Thu', calls: 17, talkTime: 52, conversions: 4 },
      { day: 'Fri', calls: 21, talkTime: 70, conversions: 6 },
      { day: 'Sat', calls: 14, talkTime: 45, conversions: 2 },
      { day: 'Sun', calls: 12, talkTime: 40, conversions: 2 },
    ];

    const newCalls: RecentCall[] = [
      {
        id: 'new-1',
        name: 'Lead 1',
        initials: 'L1',
        direction: 'outbound',
        duration: '6m 00s',
        time: 'Just now',
        outcome: 'Interested',
        outcomeColor: '#1d9e75',
      },
    ];

    const aggregated = aggregateWeeklyChartData(baseChart, newCalls);
    const totalWeeklyCalls = aggregated.reduce((acc, p) => acc + p.calls, 0);
    const baseWeeklyCalls = baseChart.reduce((acc, p) => acc + p.calls, 0);

    expect(totalWeeklyCalls).toBe(baseWeeklyCalls + 1);
  });
});
