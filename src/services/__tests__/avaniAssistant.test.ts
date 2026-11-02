import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  answerQuery,
  formatProgressResponse,
  formatLeadPrioritization,
  formatCallbacksResponse,
  formatEscalationResponse,
  formatTasksResponse,
  formatStockUnavailableResponse,
  formatUnknownResponse,
  handleWalkoutRecovery,
  handlePitchCoach,
  handleAsmAgent,
  handleTelecallerQueue,
  type AvaniContext,
} from '../avaniAssistant';
import {
  LEADS,
  RECENT_CALLS,
  DAILY_TASKS,
  CALL_QUEUE,
  PULSE_THREADS,
} from '../../data/mockData';
import { calculateShiftProgress } from '../dashboardService';

describe('AvaniBot Shift Assistant Service', () => {
  const mockContext: AvaniContext = {
    shiftProgress: calculateShiftProgress(14, 18),
    leads: LEADS,
    recentCalls: RECENT_CALLS,
    dailyTasks: DAILY_TASKS,
    pulseMessages: {
      escalations: [...PULSE_THREADS['escalations'].messages],
    },
    callQueue: CALL_QUEUE,
  };

  describe('Intent Detection', () => {
    it('detects progress and completed calls intent correctly', () => {
      expect(detectIntent('How is my calling progress?')).toBe('progress');
      expect(detectIntent('Which calls have I completed?')).toBe('progress');
      expect(detectIntent('how many calls remain today')).toBe('progress');
    });

    it('detects lead prioritization intent correctly', () => {
      expect(detectIntent('Which leads should I prioritize today?')).toBe('prioritize_leads');
      expect(detectIntent('who has the highest intent')).toBe('prioritize_leads');
      expect(detectIntent('top lead to call first')).toBe('prioritize_leads');
    });

    it('detects pending callbacks intent correctly', () => {
      expect(detectIntent('What callbacks are pending?')).toBe('callbacks');
      expect(detectIntent('any pending follow-up calls')).toBe('callbacks');
    });

    it('detects escalation intent correctly', () => {
      expect(detectIntent("What's our latest escalation?")).toBe('escalations');
      expect(detectIntent('billing dispute with priya iyer')).toBe('escalations');
    });

    it('detects shift tasks intent correctly', () => {
      expect(detectIntent('Which tasks remain?')).toBe('tasks');
      expect(detectIntent('show my pending checklist tasks')).toBe('tasks');
    });

    it('detects honest boundary for store stock / inventory queries', () => {
      expect(detectIntent('Check store stock for SmartGRID')).toBe('stock_unavailable');
      expect(detectIntent('how many units left in warehouse inventory')).toBe('stock_unavailable');
    });

    it('detects unknown queries accurately', () => {
      expect(detectIntent('what is the weather in Bangalore today?')).toBe('unknown');
    });
  });

  describe('Grounded Query Handlers', () => {
    it('answers calling progress grounded in shift targets and completed calls', async () => {
      const response = await answerQuery('How is my calling progress?', mockContext);
      expect(response.intent).toBe('progress');
      expect(response.isAvailable).toBe(true);
      expect(response.text).toContain('You have completed 14 of 18 target calls');
      expect(response.text).toContain('Progress: 78%');
      expect(response.text).toContain('4 calls remain');
      expect(response.text).toContain('Mukunda R.');
      expect(response.actions?.[0].type).toBe('NAVIGATE_VIEW');
    });

    it('ranks and prioritizes leads based on actual attractiveness scores', async () => {
      const response = await answerQuery('Which leads should I prioritize today?', mockContext);
      expect(response.intent).toBe('prioritize_leads');
      expect(response.isAvailable).toBe(true);
      expect(response.text).toContain('Mukunda R. — 90');
      expect(response.text).toContain('Rohan P. — 88');
      expect(response.text).toContain('Ritu S. — 85');
      expect(response.text).toContain('Mukunda R. has the highest current propensity score');
      expect(response.actions?.some((a) => a.type === 'START_CALL')).toBe(true);
    });

    it('identifies due callbacks from recent call logs and scheduled status', async () => {
      const response = await answerQuery('What callbacks are pending?', mockContext);
      expect(response.intent).toBe('callbacks');
      expect(response.isAvailable).toBe(true);
      expect(response.text).toContain('Kavita M.');
      expect(response.text).toContain('Callback');
      expect(response.text).toContain('Ritu S.');
    });

    it('surfaces latest store escalations and manager directives from #escalations channel', async () => {
      const response = await answerQuery("What's our latest escalation?", mockContext);
      expect(response.intent).toBe('escalations');
      expect(response.isAvailable).toBe(true);
      expect(response.text).toContain('Priya Iyer');
      expect(response.text).toContain('₹22,000');
      expect(response.text).toContain('Sunita Rao');
      expect(response.text).toContain('please don\'t call back until I\'ve reviewed the account');
      expect(response.actions?.[0].payload.channelId).toBe('escalations');
    });

    it('identifies remaining shift tasks from checklist', async () => {
      const response = await answerQuery('Which tasks remain?', mockContext);
      expect(response.intent).toBe('tasks');
      expect(response.isAvailable).toBe(true);
      expect(response.text).toContain('3 of 5 shift tasks remain pending');
      expect(response.text).toContain('Follow up with Mukunda R.');
      expect(response.text).toContain('Call back Ritu S.');
      expect(response.text).toContain('Confirm Friday coaching with Sunita');
      expect(response.text).toContain('2 tasks already completed');
    });

    it('provides honest boundary explanation when asked about store stock without hallucinating numbers', async () => {
      const response = await answerQuery('What is the current stock of mattresses?', mockContext);
      expect(response.intent).toBe('stock_unavailable');
      expect(response.isAvailable).toBe(false);
      expect(response.text).toContain('Inventory lookup is currently unavailable');
      expect(response.text).toContain('not yet connected');
    });

    it('handles unrecognized questions gracefully with a guide of supported shift topics', async () => {
      const response = await answerQuery('Random unsupported question', mockContext);
      expect(response.intent).toBe('unknown');
      expect(response.isAvailable).toBe(false);
      expect(response.text).toContain("I don't have access to that information in our current shift data");
      expect(response.text).toContain('Calling progress');
      expect(response.text).toContain('Lead prioritization');
    });
  });

  describe('Edge Cases & Empty Datasets', () => {
    it('handles empty leads dataset gracefully', () => {
      const res = formatLeadPrioritization([]);
      expect(res.text).toBe('No lead records are currently available in the system.');
    });

    it('handles all tasks completed state cleanly', () => {
      const completedTasks = DAILY_TASKS.map((t) => ({ ...t, done: true }));
      const res = formatTasksResponse(completedTasks);
      expect(res.text).toContain('All 5 shift tasks are currently complete! Great job');
    });

    it('handles empty escalations gracefully', () => {
      const res = formatEscalationResponse({});
      expect(res.text).toBe('No active escalations recorded for today’s shift in the #escalations channel.');
    });

    it('handles empty callbacks gracefully', () => {
      const res = formatCallbacksResponse([], []);
      expect(res.text).toBe('No pending callbacks or scheduled follow-ups found in your current records.');
    });
  });

  describe('Specialized Shift Agent Workflow Handlers', () => {
    it('Walk-out Recovery agent filters and prioritizes store walk-in leads', () => {
      const res = handleWalkoutRecovery(LEADS);
      expect(res.text).toContain('Walk-out Recovery Workflow Activated');
      expect(res.text).toContain('Mukunda R.');
      expect(res.actions?.some((a) => a.type === 'START_CALL')).toBe(true);
      expect(res.actions?.find((a) => a.type === 'NAVIGATE_VIEW')?.payload.tab).toBe('outgoing');
    });

    it('Pitch Coach agent activates roleplay practice scenario', () => {
      const res = handlePitchCoach();
      expect(res.text).toContain('Pitch Coach Activated');
      expect(res.text).toContain('Warranty & Pricing Objections');
      expect(res.actions?.[0].payload.tab).toBe('practise');
    });

    it('ASM Agent surfaces escalation hold directive', () => {
      const res = handleAsmAgent({ escalations: [...PULSE_THREADS['escalations'].messages] });
      expect(res.text).toContain('ASM Oversight Summary');
      expect(res.text).toContain('Priya Iyer');
      expect(res.text).toContain('Sunita Rao');
    });

    it('Tele-caller agent prepares outbound call queue', () => {
      const res = handleTelecallerQueue(CALL_QUEUE);
      expect(res.text).toContain('Tele-caller Outbound Queue Prepared');
      expect(res.text).toContain('Priya Iyer');
      expect(res.actions?.[0].type).toBe('OPEN_QUEUE');
    });

    it('dynamically adapts to different escalation records rather than hardcoding', () => {
      const customEscalationMsg = [
        {
          id: 'es-custom',
          who: 'System',
          initials: '🚨',
          bg: '#fdecec',
          color: '#e24b4a',
          text: '🔴 <b>ESCALATION:</b> Rajesh Sharma delivery delay on SmartGRID Luxe. Order #9910. Needs logistics escalation.',
          time: '3:30 PM',
        },
        {
          id: 'es-manager',
          who: 'Ravi Kumar',
          initials: 'RK',
          bg: '#faeeda',
          color: '#854f0b',
          text: 'I spoke with warehouse — dispatching replacement unit tomorrow morning.',
          time: '3:45 PM',
        },
      ];

      const res = formatEscalationResponse({ escalations: customEscalationMsg });
      expect(res.text).toContain('Rajesh Sharma delivery delay on SmartGRID Luxe');
      expect(res.text).toContain('Order #9910');
      expect(res.text).toContain('Ravi Kumar (3:45 PM)');
      expect(res.text).not.toContain('Priya Iyer');
    });

    it('dynamically recommends highest-scoring lead in Walk-out Recovery, not hardcoded Mukunda', () => {
      const customLeads = [
        {
          ...LEADS[1], // Ritu S.
          source: 'Walk-in → Store Indiranagar',
          attractivenessScore: 95,
          emiNote: 'Pre-approved HDFC loan card',
        },
      ];

      const res = handleWalkoutRecovery(customLeads);
      expect(res.text).toContain('Call Ritu S. first (Score: 95/100)');
      expect(res.text).toContain('Pre-approved HDFC loan card');
      expect(res.text).not.toContain('Mukunda R.');
    });

    it('handles empty walk-in leads gracefully', () => {
      const res = handleWalkoutRecovery([]);
      expect(res.text).toContain('No store walk-in leads found in current records');
    });
  });

  describe('Central AvaniBot Pulse Thread & Pinned Action Items', () => {
    it('defines dedicated avanibot channel with two pinned action items', () => {
      const avaniThread = PULSE_THREADS['avanibot'];
      expect(avaniThread).toBeDefined();
      expect(avaniThread.pinnedItems?.length).toBe(2);

      const [progressCard, escalationCard] = avaniThread.pinnedItems!;
      expect(progressCard.id).toBe('pin-progress');
      expect(progressCard.options).toContain('Check Calling Progress');
      expect(progressCard.options).toContain('Prioritize Top Leads');

      expect(escalationCard.id).toBe('pin-escalation');
      expect(escalationCard.options).toContain('Review Escalation');
      expect(escalationCard.options).toContain('View #escalations');
    });
  });
});
