import type {
  Lead,
  RecentCall,
  DailyTask,
  QueuedCaller,
  PulseMessage,
} from '../types';
import type { ShiftProgress } from './dashboardService';

export type AvaniQueryIntent =
  | 'progress'
  | 'prioritize_leads'
  | 'callbacks'
  | 'escalations'
  | 'tasks'
  | 'stock_unavailable'
  | 'qa_unavailable'
  | 'walkout_recovery'
  | 'pitch_coach'
  | 'telecaller_queue'
  | 'unknown';

export interface AvaniAction {
  label: string;
  type: 'NAVIGATE_VIEW' | 'OPEN_CHANNEL' | 'START_CALL' | 'OPEN_LEAD_MODAL' | 'OPEN_QUEUE';
  payload?: any;
}

export interface AvaniResponse {
  id: string;
  query: string;
  intent: AvaniQueryIntent;
  text: string;
  timestamp: string;
  actions?: AvaniAction[];
  isAvailable: boolean;
}

export interface AvaniContext {
  shiftProgress: ShiftProgress;
  leads: Lead[];
  recentCalls: RecentCall[];
  dailyTasks: DailyTask[];
  pulseMessages: Record<string, PulseMessage[]>;
  callQueue: QueuedCaller[];
}

/**
 * Normalizes query string for intent matching.
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/[?!.,;:]/g, '');
}

/**
 * Detects the user's intent deterministically from natural variations.
 */
export function detectIntent(rawQuery: string): AvaniQueryIntent {
  const q = normalizeQuery(rawQuery);

  // Store Stock / Inventory (Honest boundary)
  if (
    q.includes('stock') ||
    q.includes('inventory') ||
    q.includes('units left') ||
    q.includes('quantity') ||
    q.includes('how many mattresses')
  ) {
    return 'stock_unavailable';
  }

  // Real-time QA evaluation
  if (
    q.includes('qa evaluation') ||
    q.includes('evaluate my call') ||
    q.includes('check qa score')
  ) {
    return 'qa_unavailable';
  }

  // Shift progress & completed calls
  if (
    q.includes('progress') ||
    q.includes('completed call') ||
    q.includes('calls have i completed') ||
    q.includes('calls completed') ||
    q.includes('how many calls') ||
    q.includes('shift target') ||
    q.includes('calls remain') ||
    q.includes('my calls')
  ) {
    return 'progress';
  }

  // Lead Prioritization
  if (
    q.includes('prioritize') ||
    q.includes('which lead') ||
    q.includes('highest intent') ||
    q.includes('top lead') ||
    q.includes('lead score') ||
    q.includes('call first') ||
    q.includes('best lead') ||
    q.includes('who should i call')
  ) {
    return 'prioritize_leads';
  }

  // Pending Callbacks
  if (
    q.includes('callback') ||
    q.includes('follow-up') ||
    q.includes('follow up') ||
    q.includes('pending call') ||
    q.includes('due call')
  ) {
    return 'callbacks';
  }

  // Escalations & Manager Issues
  if (
    q.includes('escalation') ||
    q.includes('billing dispute') ||
    q.includes('dispute') ||
    q.includes('manager review') ||
    q.includes('manager decision') ||
    q.includes('priya iyer')
  ) {
    return 'escalations';
  }

  // Shift Tasks
  if (
    q.includes('task') ||
    q.includes('todo') ||
    q.includes('what remain') ||
    q.includes('pending work') ||
    q.includes('checklist')
  ) {
    return 'tasks';
  }

  return 'unknown';
}

/**
 * Formats shift progress and completed calls summary.
 */
export function formatProgressResponse(
  progress: ShiftProgress,
  recentCalls: RecentCall[]
): AvaniResponse {
  const completed = progress.callsCompleted;
  const total = progress.callsTotal;
  const percentage = progress.completedPct;
  const remaining = progress.callsRemaining;

  const validRecent = (recentCalls || []).filter((c) => c.outcome !== 'Missed');
  const recentSummary = validRecent.length > 0
    ? `\n\nRecent completed calls:\n` +
      validRecent
        .slice(0, 3)
        .map((c) => `• ${c.name} — ${c.outcome} (${c.duration}, SOP: ${c.sopScore}%)`)
        .join('\n')
    : '';

  const text =
    `You have completed ${completed} of ${total} target calls.\n` +
    `Progress: ${percentage}%. ${remaining} call${remaining === 1 ? '' : 's'} remain.` +
    recentSummary;

  return {
    id: `avani-${Date.now()}`,
    query: 'How is my calling progress?',
    intent: 'progress',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'View Dashboard Metrics', type: 'NAVIGATE_VIEW', payload: { view: 'dashboard' } },
    ],
  };
}

/**
 * Formats lead prioritization ranked by attractiveness score.
 */
export function formatLeadPrioritization(leads: Lead[]): AvaniResponse {
  if (!leads || leads.length === 0) {
    return {
      id: `avani-${Date.now()}`,
      query: 'Which leads should I prioritize?',
      intent: 'prioritize_leads',
      text: 'No lead records are currently available in the system.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
    };
  }

  const sorted = [...leads].sort((a, b) => b.attractivenessScore - a.attractivenessScore);
  const top = sorted.slice(0, 3);
  const highest = top[0];

  const lines = top.map((l) => `• ${l.name} — ${l.attractivenessScore} (${l.product})`);

  const text =
    `Based on the current lead scores, prioritize:\n` +
    lines.join('\n') +
    `\n\n${highest.name} has the highest current propensity score (${highest.attractivenessScore}/100) with strong buying signals.`;

  return {
    id: `avani-${Date.now()}`,
    query: 'Which leads should I prioritize today?',
    intent: 'prioritize_leads',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: `Call ${highest.name}`, type: 'START_CALL', payload: { leadId: highest.id } },
      { label: 'View All Outgoing Leads', type: 'NAVIGATE_VIEW', payload: { view: 'plan', tab: 'outgoing' } },
    ],
  };
}

/**
 * Formats pending callbacks from recent calls and lead status.
 */
export function formatCallbacksResponse(
  recentCalls: RecentCall[],
  leads: Lead[]
): AvaniResponse {
  const callbacksFromCalls = (recentCalls || []).filter(
    (c) => c.outcome === 'Callback' || c.outcome === 'Follow-up'
  );

  const followUpLeads = (leads || []).filter(
    (l) => l.statusLabel === 'Follow-up' || l.badge.includes('h left') || l.badge === 'Today'
  );

  if (callbacksFromCalls.length === 0 && followUpLeads.length === 0) {
    return {
      id: `avani-${Date.now()}`,
      query: 'What callbacks are pending?',
      intent: 'callbacks',
      text: 'No pending callbacks or scheduled follow-ups found in your current records.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
    };
  }

  const items: string[] = [];

  callbacksFromCalls.forEach((c) => {
    const detail = c.outcome === 'Callback'
      ? 'Callback secured (tomorrow 11:00 AM)'
      : 'Showroom follow-up demo needed';
    items.push(`• ${c.name} — ${c.outcome} (${c.time}) · ${detail}`);
  });

  followUpLeads.forEach((l) => {
    if (!callbacksFromCalls.some((c) => c.name.toLowerCase().includes(l.name.toLowerCase()))) {
      items.push(`• ${l.name} — Scheduled lead follow-up (${l.badge}) · ${l.product}`);
    }
  });

  const text =
    `Pending callbacks and follow-ups identified from shift records:\n` +
    items.slice(0, 4).join('\n') +
    `\n\nEnsure to review customer notes and objection history before placing callback.`;

  return {
    id: `avani-${Date.now()}`,
    query: 'What callbacks are pending?',
    intent: 'callbacks',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'Open Outgoing Plan', type: 'NAVIGATE_VIEW', payload: { view: 'plan', tab: 'outgoing' } },
    ],
  };
}

/**
 * Formats latest escalation summaries from Pulse threads (#escalations).
 */
export function formatEscalationResponse(
  pulseMessages: Record<string, PulseMessage[]>
): AvaniResponse {
  const escalations = pulseMessages?.['escalations'] || [];

  if (escalations.length === 0) {
    return {
      id: `avani-${Date.now()}`,
      query: "What's our latest escalation?",
      intent: 'escalations',
      text: 'No active escalations recorded for today’s shift in the #escalations channel.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
    };
  }

  // Dynamically extract details from messages in #escalations
  const cleaned = escalations.map((m) => ({
    who: m.who,
    time: m.time,
    rawText: m.text.replace(/<[^>]+>/g, '').trim(),
  }));

  const systemIssue = cleaned.find(
    (m) => m.who.toLowerCase() === 'system' || m.rawText.toLowerCase().includes('escalation')
  ) || cleaned[0];

  const followUpNotes = cleaned.filter((m) => m !== systemIssue);
  const issueDescription = systemIssue.rawText.replace(/^[🔴🚨\s]*ESCALATION:\s*/i, '');

  let text = `Latest store escalation (${systemIssue.time}):\n• ${issueDescription}`;

  if (followUpNotes.length > 0) {
    const notesSummary = followUpNotes
      .map((n) => `"${n.rawText}" — ${n.who} (${n.time})`)
      .join('\n');
    text += `\n\nManager Directives & Review Status:\n${notesSummary}`;
  } else {
    text += `\n\nStatus: Pending review in #escalations channel.`;
  }

  return {
    id: `avani-${Date.now()}`,
    query: "What's our latest escalation?",
    intent: 'escalations',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'Open #escalations Channel', type: 'OPEN_CHANNEL', payload: { channelId: 'escalations' } },
    ],
  };
}

/**
 * Formats pending shift tasks from central store.
 */
export function formatTasksResponse(dailyTasks: DailyTask[]): AvaniResponse {
  if (!dailyTasks || dailyTasks.length === 0) {
    return {
      id: `avani-${Date.now()}`,
      query: 'Which tasks remain?',
      intent: 'tasks',
      text: 'No shift tasks found in the task checklist.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
    };
  }

  const pending = dailyTasks.filter((t) => !t.done);
  const completed = dailyTasks.filter((t) => t.done);

  if (pending.length === 0) {
    return {
      id: `avani-${Date.now()}`,
      query: 'Which tasks remain?',
      intent: 'tasks',
      text: `All ${dailyTasks.length} shift tasks are currently complete! Great job keeping up with your checklist.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
      actions: [
        { label: 'View Dashboard Tasks', type: 'NAVIGATE_VIEW', payload: { view: 'dashboard' } },
      ],
    };
  }

  const lines = pending.map((t) => `• ${t.label}`);
  const text =
    `${pending.length} of ${dailyTasks.length} shift tasks remain pending:\n` +
    lines.join('\n') +
    (completed.length > 0 ? `\n\n(${completed.length} task${completed.length === 1 ? '' : 's'} already completed)` : '');

  return {
    id: `avani-${Date.now()}`,
    query: 'Which tasks remain?',
    intent: 'tasks',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'Manage Tasks on Dashboard', type: 'NAVIGATE_VIEW', payload: { view: 'dashboard' } },
    ],
  };
}

/**
 * Honest boundary response for unavailable store stock / inventory.
 */
export function formatStockUnavailableResponse(): AvaniResponse {
  return {
    id: `avani-${Date.now()}`,
    query: 'Check store stock',
    intent: 'stock_unavailable',
    text: 'Inventory lookup is currently unavailable. Offline store warehouse stock levels are not yet connected to the calling engine. Please check with the Koramangala store inventory desk directly.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: false,
  };
}

/**
 * Honest boundary response for real-time external QA evaluation.
 */
export function formatQaUnavailableResponse(): AvaniResponse {
  return {
    id: `avani-${Date.now()}`,
    query: 'Real-time QA evaluation',
    intent: 'qa_unavailable',
    text: 'Real-time QA evaluation is automatically performed during simulated calls in the calling room. Live audio evaluation for external store phone lines is not currently connected.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: false,
    actions: [
      { label: 'Practice Call with QA Scorer', type: 'NAVIGATE_VIEW', payload: { view: 'plan', tab: 'practise' } },
    ],
  };
}

/**
 * Fallback response for unsupported / unrecognized queries.
 */
export function formatUnknownResponse(rawQuery: string): AvaniResponse {
  return {
    id: `avani-${Date.now()}`,
    query: rawQuery,
    intent: 'unknown',
    text:
      `I don't have access to that information in our current shift data.\n\n` +
      `You can ask me grounded questions about:\n` +
      `• Calling progress and completed calls\n` +
      `• Lead prioritization by attractiveness score\n` +
      `• Pending callbacks and follow-ups\n` +
      `• Latest store escalations & manager notes\n` +
      `• Remaining shift checklist tasks`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: false,
  };
}

/**
 * Main query dispatcher for AvaniBot.
 * Non-blocking, asynchronous response resolution.
 */
export async function answerQuery(
  rawQuery: string,
  context: AvaniContext
): Promise<AvaniResponse> {
  const intent = detectIntent(rawQuery);

  switch (intent) {
    case 'progress':
      return formatProgressResponse(context.shiftProgress, context.recentCalls);
    case 'prioritize_leads':
      return formatLeadPrioritization(context.leads);
    case 'callbacks':
      return formatCallbacksResponse(context.recentCalls, context.leads);
    case 'escalations':
      return formatEscalationResponse(context.pulseMessages);
    case 'tasks':
      return formatTasksResponse(context.dailyTasks);
    case 'stock_unavailable':
      return formatStockUnavailableResponse();
    case 'qa_unavailable':
      return formatQaUnavailableResponse();
    case 'unknown':
    default:
      return formatUnknownResponse(rawQuery);
  }
}

// ─── Specialized Role Agent Workflows ─────────────────────────

export function handleWalkoutRecovery(leads: Lead[]): AvaniResponse {
  const walkinLeads = (leads || [])
    .filter((l) => l.source.toLowerCase().includes('walk-in') || l.source.toLowerCase().includes('store'))
    .sort((a, b) => b.attractivenessScore - a.attractivenessScore);

  if (walkinLeads.length === 0) {
    return {
      id: `agent-walkout-${Date.now()}`,
      query: 'Walk-out Recovery Agent',
      intent: 'prioritize_leads',
      text: '🎯 Walk-out Recovery: No store walk-in leads found in current records.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
    };
  }

  const top = walkinLeads.slice(0, 3);
  const highest = top[0];
  const list = top.map((l) => `• ${l.name} — Score: ${l.attractivenessScore} (${l.product}) · ${l.source}`);

  const leadDetail = highest.emiNote || highest.interest || 'High purchase propensity';

  return {
    id: `agent-walkout-${Date.now()}`,
    query: 'Walk-out Recovery Agent',
    intent: 'prioritize_leads',
    text:
      `🎯 Walk-out Recovery Workflow Activated:\n` +
      `Identified ${walkinLeads.length} store walk-in visitors who left without purchasing:\n\n` +
      list.join('\n') +
      `\n\nRecommendation: Call ${highest.name} first (Score: ${highest.attractivenessScore}/100) — ${leadDetail}.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: `Call ${highest.name}`, type: 'START_CALL', payload: { leadId: highest.id } },
      { label: 'Review Walk-out Leads', type: 'NAVIGATE_VIEW', payload: { view: 'plan', tab: 'outgoing' } },
    ],
  };
}

export function handlePitchCoach(): AvaniResponse {
  return {
    id: `agent-pitchcoach-${Date.now()}`,
    query: 'Pitch Coach Agent',
    intent: 'pitch_coach',
    text:
      `🎓 Pitch Coach Activated:\n` +
      `Loaded "Warranty & Pricing Objections" roleplay scenario for SmartGRID mattresses. Focus on anchoring European knitted cover quality and 100-night trial before discounting.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'Start Pitch Practice Session', type: 'NAVIGATE_VIEW', payload: { view: 'plan', tab: 'practise' } },
    ],
  };
}

export function handleAsmAgent(pulseMessages: Record<string, PulseMessage[]>): AvaniResponse {
  const escalations = pulseMessages?.['escalations'] || [];
  if (escalations.length === 0) {
    return {
      id: `agent-asm-${Date.now()}`,
      query: 'ASM Agent',
      intent: 'escalations',
      text: `ASM Oversight: No active regional escalations requiring hold at this time.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAvailable: true,
    };
  }

  const cleaned = escalations.map((m) => ({
    who: m.who,
    time: m.time,
    rawText: m.text.replace(/<[^>]+>/g, '').trim(),
  }));

  const issue = cleaned.find(
    (m) => m.who.toLowerCase() === 'system' || m.rawText.toLowerCase().includes('escalation')
  ) || cleaned[0];

  const managerNote = cleaned.find((m) => m !== issue);
  const issueDescription = issue.rawText.replace(/^[🔴🚨\s]*ESCALATION:\s*/i, '');

  let text = `🚨 ASM Oversight Summary:\n${issueDescription}`;
  if (managerNote) {
    text += `\n\nManager Directive (${managerNote.who}): "${managerNote.rawText}"`;
  }

  return {
    id: `agent-asm-${Date.now()}`,
    query: 'ASM Agent',
    intent: 'escalations',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'View Escalation Thread', type: 'OPEN_CHANNEL', payload: { channelId: 'escalations' } },
    ],
  };
}

export function handleTelecallerQueue(callQueue: QueuedCaller[]): AvaniResponse {
  const queueCount = (callQueue || []).length;
  const list = (callQueue || []).slice(0, 2).map((q) => `• ${q.name} (${q.phone}) — Waiting: ${q.wait} · Intent: ${q.intent}`);

  return {
    id: `agent-telecaller-${Date.now()}`,
    query: 'Tele-caller Agent',
    intent: 'telecaller_queue',
    text:
      `📞 Tele-caller Outbound Queue Prepared:\n` +
      `Ready with ${queueCount} prioritized inbound/callback callers in the queue:\n\n` +
      list.join('\n') +
      `\n\nNext caller ready for dialer connection.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAvailable: true,
    actions: [
      { label: 'Launch Outbound Queue', type: 'OPEN_QUEUE' },
    ],
  };
}

export function handleFollowupCallbacks(recentCalls: RecentCall[], leads: Lead[]): AvaniResponse {
  return formatCallbacksResponse(recentCalls, leads);
}
