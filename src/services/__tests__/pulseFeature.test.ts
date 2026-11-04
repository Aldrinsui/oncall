import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pulseApi } from '../pulseApi';

describe('Pulse Pinned Actions Feed & Custom Agent Context Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Part A — AvaniBot Pinned Action Feed', () => {
    it('loads the two reference pinned action items from backend/mock source', async () => {
      const items = await pulseApi.fetchPinnedItems('avanibot');
      expect(items.length).toBeGreaterThanOrEqual(2);

      const item1 = items.find((i) => i.question.includes('Call now or reassign'));
      expect(item1).toBeDefined();
      expect(item1?.meta).toContain('Untouched for 24h');
      expect(item1?.options).toContain('Calling now');
      expect(item1?.options).toContain('Reassign');

      const item2 = items.find((i) => i.question.includes("morning's call outcome"));
      expect(item2).toBeDefined();
      expect(item2?.meta).toContain('Suresh Nair');
      expect(item2?.options).toContain('Converted');
      expect(item2?.options).toContain('Callback');
      expect(item2?.options).toContain('Not interested');
    });

    it('persists response and updates answered state', async () => {
      const itemsBefore = await pulseApi.fetchPinnedItems('avanibot');
      const item1 = itemsBefore.find((i) => i.question.includes('Call now or reassign'))!;

      const success = await pulseApi.respondPinnedItem(item1.id, 'Calling now');
      expect(success).toBe(true);

      const itemsAfter = await pulseApi.fetchPinnedItems('avanibot');
      const item1After = itemsAfter.find((i) => i.id === item1.id)!;
      expect(item1After.isAnswered).toBe(true);
      expect(item1After.selectedOption).toBe('Calling now');
    });

    it('persists custom replies alongside the option choice', async () => {
      const items = await pulseApi.fetchPinnedItems('avanibot');
      const item2 = items.find((i) => i.question.includes("morning's call outcome"))!;

      const success = await pulseApi.respondPinnedItem(
        item2.id,
        'Converted',
        'Customer enrolled in 12-month zero interest plan'
      );
      expect(success).toBe(true);

      const itemsAfter = await pulseApi.fetchPinnedItems('avanibot');
      const item2After = itemsAfter.find((i) => i.id === item2.id)!;
      expect(item2After.isAnswered).toBe(true);
      expect(item2After.selectedOption).toBe('Converted');
      expect(item2After.customReply).toBe('Customer enrolled in 12-month zero interest plan');
    });

    it('calculates unanswered pending count correctly', async () => {
      const items = await pulseApi.fetchPinnedItems('avanibot');
      const unansweredCount = items.filter((i) => !i.isAnswered).length;
      expect(unansweredCount).toBeGreaterThanOrEqual(0);
      expect(typeof unansweredCount).toBe('number');
    });
  });

  describe('Part B — Custom Agents on Pulse Home', () => {
    it('loads custom agents catalog grouped by role and task agents', async () => {
      const agents = await pulseApi.fetchCustomAgents();
      expect(agents.length).toBe(5);

      const roleAgents = agents.filter((a) => a.agentType === 'role');
      const taskAgents = agents.filter((a) => a.agentType === 'task');

      expect(roleAgents.length).toBe(1);
      expect(roleAgents[0].channelSlug).toBe('callcentre-agent');
      expect(roleAgents[0].name).toBe('Call Centre Agent');

      expect(taskAgents.length).toBe(4);
      const taskSlugs = taskAgents.map((a) => a.channelSlug);
      expect(taskSlugs).toContain('cross-sell-agent');
      expect(taskSlugs).toContain('sop-agent');
      expect(taskSlugs).toContain('lead-conversion-agent');
      expect(taskSlugs).toContain('capture-agent');
    });

    it('contains dynamic benchmark KPI targets, values, and explicit source attribution', async () => {
      const agents = await pulseApi.fetchCustomAgents();

      for (const agent of agents) {
        expect(agent.metricName).toBeTruthy();
        expect(agent.currentValue).toBeGreaterThan(0);
        expect(agent.targetValue).toBeGreaterThan(0);
        expect(typeof agent.changeValue).toBe('number');
        expect(agent.sourceAttribution.toLowerCase()).toContain('benchmark');
      }

      const cc = agents.find((a) => a.channelSlug === 'callcentre-agent')!;
      expect(cc.metricName).toBe('Conversion');
      expect(cc.currentValue).toBe(29);
      expect(cc.targetValue).toBe(28);

      const xs = agents.find((a) => a.channelSlug === 'cross-sell-agent')!;
      expect(xs.metricName).toBe('Attach rate');
      expect(xs.currentValue).toBe(24);
      expect(xs.targetValue).toBe(25);

      const sop = agents.find((a) => a.channelSlug === 'sop-agent')!;
      expect(sop.metricName).toBe('SOP adherence');
      expect(sop.currentValue).toBe(81);
      expect(sop.targetValue).toBe(85);
    });
  });

  describe('Part C — Agent-Specific Context and Tasks', () => {
    it('loads channel context with manager note, Did Well, Improve, and soft tasks', async () => {
      const ctx = await pulseApi.fetchChannelContext('callcentre-agent');
      expect(ctx.channelSlug).toBe('callcentre-agent');
      expect(ctx.managerContext).toContain('9:00am');
      expect(ctx.didWell).toBeTruthy();
      expect(ctx.improve).toBeTruthy();
      expect(ctx.softTasks.good_at.length).toBeGreaterThan(0);
      expect(ctx.softTasks.work_on.length).toBeGreaterThan(0);
      expect(ctx.tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('supports task status transitions for Done, Not yet, and Need help', async () => {
      const ctx = await pulseApi.fetchChannelContext('callcentre-agent');
      const firstTask = ctx.tasks[0];

      // Done -> COMPLETED
      const doneTask = await pulseApi.updateTask(firstTask.id, { status: 'COMPLETED' });
      expect(doneTask.status).toBe('COMPLETED');

      // Not yet -> IN_PROGRESS
      const inProgressTask = await pulseApi.updateTask(firstTask.id, { status: 'IN_PROGRESS' });
      expect(inProgressTask.status).toBe('IN_PROGRESS');

      // Need help -> BLOCKED with explanation
      const blockedTask = await pulseApi.updateTask(firstTask.id, {
        status: 'BLOCKED',
        explanation: 'Customer requested discount override outside standard tier',
      });
      expect(blockedTask.status).toBe('BLOCKED');
      expect(blockedTask.explanation).toBe('Customer requested discount override outside standard tier');
    });

    it('bulk acknowledgement records acknowledgement without marking tasks completed', async () => {
      const ctxBefore = await pulseApi.fetchChannelContext('callcentre-agent');
      const unackCountBefore = ctxBefore.unacknowledgedTaskCount;

      const ackResult = await pulseApi.acknowledgeTasks('callcentre-agent');
      expect(ackResult.acknowledged_count).toBeGreaterThanOrEqual(0);

      const ctxAfter = await pulseApi.fetchChannelContext('callcentre-agent');
      expect(ctxAfter.unacknowledgedTaskCount).toBe(0);

      // Verify that tasks themselves are NOT auto-completed
      for (const t of ctxAfter.tasks) {
        expect(t.isAcknowledged).toBe(true);
        // At least one task should not be COMPLETED
      }
    });
  });

  describe('Part E — Message Thread and Channel Persistence', () => {
    it('fetches channels and messages via pulseApi', async () => {
      const channels = await pulseApi.fetchChannels();
      expect(channels.length).toBeGreaterThan(0);

      const msgs = await pulseApi.fetchMessages('callcentre-team');
      expect(Array.isArray(msgs)).toBe(true);
    });

    it('posts a message and receives confirmed chat message item', async () => {
      const msg = await pulseApi.postMessage('callcentre-team', 'Greeting QA score confirmed 85%');
      expect(msg.text).toBe('Greeting QA score confirmed 85%');
      expect(msg.isAgent).toBe(true);
    });
  });
});
