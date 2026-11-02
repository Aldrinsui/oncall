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

export interface CallTarget {
  id: string;
  name: string;
  initials: string;
  phone: string;
  avatarBg: string;
  avatarColor: string;
  intent: string;
  product?: string;
  value?: string;
  personaChallenge?: string;
  scriptContext?: string;
}

export interface QueuedCaller {
  id: string;
  name: string;
  initials: string;
  phone: string;
  wait: string;
  waitLevel: 'hi' | 'mid' | 'lo';
  intent: string;
}

export interface SopReviewItem {
  criterion: string;
  passed: boolean;
  score: number;
  evidence: string;
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
  sopScore?: number;
  reviewItems?: SopReviewItem[];
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

export type PulseMessage = ChatMessage;

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
export type NotificationActionType =
  | 'OPEN_PULSE_CHANNEL'
  | 'OPEN_INCOMING_CALLS'
  | 'OPEN_COACH'
  | 'VIEW_SCORE'
  | 'VIEW_RANK';

export interface Notification {
  id: string;
  needsAction: boolean;
  icon: string;
  color: string;
  title: string;
  time: string;
  cta: string;
  actionType?: NotificationActionType;
  actionPayload?: string;
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
