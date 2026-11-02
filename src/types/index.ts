// ─── Navigation ─────────────────────────────────────────────────
export type View = 'dashboard' | 'plan' | 'calendar' | 'pulse';
export type PlanTab = 'outgoing' | 'incoming' | 'recent' | 'practise';
export type PulseView = 'home' | 'channel';

// ─── Leads ──────────────────────────────────────────────────────
export interface Lead {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  phone: string;
  interest: string;
  product: string;
  crossSell: string;
  emiNote: string;
  attractivenessScore: number;
  expectedValue: number;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  statusLabel: string;
  statusColor: string;
  icp: number;
  icpColor: string;
  intent: number;
  intentColor: string;
  buyingSignals: BuyingSignal[];
  lastContact: string;
  source: string;
}

export interface BuyingSignal {
  label: string;
  detail: string;
  icon: string;
}

// ─── Calls ──────────────────────────────────────────────────────
export type CallDirection = 'inbound' | 'outbound' | 'missed';
export type CallStatus = 'idle' | 'ringing' | 'active' | 'wrapup' | 'review';

export interface QueuedCaller {
  name: string;
  wait: string;
  waitLevel: 'hi' | 'mid' | 'lo';
  intent: string;
}

export interface RecentCall {
  id: string;
  name: string;
  initials: string;
  direction: CallDirection;
  duration: string;
  time: string;
  outcome: string;
  outcomeColor: string;
  value?: string;
}

export interface IncomingCall {
  id: string;
  name: string;
  initials: string;
  phone: string;
  valueAtStake: string;
  intent: string;
  time: string;
  missedCount: number;
}

export interface WrapupOutcome {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export interface SopItem {
  label: string;
  checked?: boolean;
  score?: number;
}

// ─── Calendar ───────────────────────────────────────────────────
export interface CalendarInvite {
  day: number;
  time: string;
  title: string;
  meta: string;
}

// ─── Pulse / Chat ───────────────────────────────────────────────
export interface PulseChannel {
  id: string;
  name: string;
  icon: string;
  unread: number;
  lastMessage: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  who: string;
  initials: string;
  bg: string;
  color: string;
  text: string;
  time: string;
  isAgent?: boolean;
}

export interface PulseThread {
  title: string;
  dateLabel: string;
  messages: ChatMessage[];
  needsInput?: {
    question: string;
    options: string[];
  };
}

// ─── Notifications ──────────────────────────────────────────────
export interface Notification {
  id: string;
  needsAction: boolean;
  icon: string;
  color: string;
  title: string;
  time: string;
  cta: string;
}

// ─── Dashboard ──────────────────────────────────────────────────
export interface KpiMetric {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: string;
}

export interface DailyTask {
  id: string;
  label: string;
  done: boolean;
  leadId?: string;
}

export interface ChartDataPoint {
  day: string;
  calls: number;
  talkTime: number;
  conversions: number;
}

// ─── Agent Roles (Pulse Home) ───────────────────────────────────
export interface AgentRole {
  id: string;
  icon: string;
  title: string;
  sub: string;
  gradient: string;
}

// ─── App State ──────────────────────────────────────────────────
export interface AppState {
  activeView: View;
  planTab: PlanTab;
  pulseView: PulseView;
  activeChannelId: string | null;
  leadsModalOpen: boolean;
  leadsModalPage: number;
  notificationsOpen: boolean;
  settingsOpen: boolean;
  sidebarCollapsed: boolean;
}
