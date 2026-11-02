import type {
  Lead, QueuedCaller, RecentCall, IncomingCall, WrapupOutcome,
  SopItem, CalendarInvite, PulseChannel, PulseThread, ChatMessage,
  Notification, KpiMetric, DailyTask, ChartDataPoint, AgentRole, BuyingSignal,
} from '../types';

// ─── Leads Data ─────────────────────────────────────────────────

const signals = (items: [string, string, string][]): BuyingSignal[] =>
  items.map(([label, detail, icon]) => ({ label, detail, icon }));

export const LEADS: Lead[] = [
  {
    id: 'l1', name: 'Mukunda R.', initials: 'MK', avatarBg: '#e1f5ee', avatarColor: '#0f6e56',
    phone: '+91 98450 12345',
    interest: 'Interested: Ortho GRID · ₹8,490',
    product: 'Ortho GRID Mattress', crossSell: 'Mattress Protector · ₹1,999',
    emiNote: 'Asked about EMI — quote the 12-month zero-interest plan',
    attractivenessScore: 90, expectedValue: 8490,
    badge: '2h left', badgeBg: '#e1f5ee', badgeColor: '#0f6e56',
    statusLabel: 'Open', statusColor: '#1d9e75',
    icp: 87, icpColor: '#1d9e75',
    intent: 91, intentColor: '#1d9e75',
    buyingSignals: signals([
      ['Financing', 'Enquired about 12-month EMI plan on store visit', '💳'],
      ['Quotation', 'Requested a formal quote for Ortho GRID + Protector', '📄'],
      ['Warranty', 'Asked about 10-year warranty coverage details', '🛡️'],
    ]),
    lastContact: '2 hours ago', source: 'Walk-in → Store Koramangala',
  },
  {
    id: 'l2', name: 'Ritu S.', initials: 'RS', avatarBg: '#faeeda', avatarColor: '#854f0b',
    phone: '+91 99001 56789',
    interest: 'Interested: SmartGRID Luxe · ₹16,990',
    product: 'SmartGRID Luxe Mattress', crossSell: 'SmartGRID Pillow · ₹2,499',
    emiNote: 'Prefers no-cost EMI on credit card',
    attractivenessScore: 85, expectedValue: 16990,
    badge: 'Today', badgeBg: '#fff3d6', badgeColor: '#854f0b',
    statusLabel: 'Follow-up', statusColor: '#c8860a',
    icp: 82, icpColor: '#c8860a',
    intent: 88, intentColor: '#1d9e75',
    buyingSignals: signals([
      ['Store Visit', 'Spent 40 min testing the SmartGRID Luxe in-store', '🏪'],
      ['Competitor Compare', 'Compared with Sleepwell and Wakefit pricing', '⚔️'],
      ['Financing', 'Asked about credit card no-cost EMI options', '💳'],
    ]),
    lastContact: 'Today 11:30 AM', source: 'Referral → Priya (existing customer)',
  },
  {
    id: 'l3', name: 'Kavita M.', initials: 'KM', avatarBg: '#e8f0fe', avatarColor: '#185fa5',
    phone: '+91 98765 43210',
    interest: 'Interested: Ortho PRO · ₹12,990',
    product: 'Ortho PRO Mattress', crossSell: 'Adjustable Bed Base · ₹24,990',
    emiNote: 'Budget conscious — emphasize value proposition',
    attractivenessScore: 78, expectedValue: 12990,
    badge: 'Tomorrow', badgeBg: '#e8f0fe', badgeColor: '#185fa5',
    statusLabel: 'New', statusColor: '#185fa5',
    icp: 75, icpColor: '#c8860a',
    intent: 72, intentColor: '#c8860a',
    buyingSignals: signals([
      ['Online Research', 'Visited product page 3 times this week', '🔍'],
      ['Warranty', 'Specifically asked about warranty in live chat', '🛡️'],
    ]),
    lastContact: 'Yesterday', source: 'Website chat → Koramangala store',
  },
  {
    id: 'l4', name: 'Suresh N.', initials: 'SN', avatarBg: '#f3e8ff', avatarColor: '#6d28d9',
    phone: '+91 97654 32100',
    interest: 'Interested: SmartGRID · ₹11,990',
    product: 'SmartGRID Mattress', crossSell: 'Mattress Protector · ₹1,999',
    emiNote: 'Wants Bajaj Finserv EMI card option',
    attractivenessScore: 72, expectedValue: 11990,
    badge: '3 days', badgeBg: '#f3e8ff', badgeColor: '#6d28d9',
    statusLabel: 'Warm', statusColor: '#6d28d9',
    icp: 70, icpColor: '#c8860a',
    intent: 65, intentColor: '#c8860a',
    buyingSignals: signals([
      ['Financing', 'Has Bajaj Finserv card — asked about EMI', '💳'],
      ['Size Query', 'Asked about King vs Queen size availability', '📏'],
    ]),
    lastContact: '3 days ago', source: 'Walk-in → Store Koramangala',
  },
  {
    id: 'l5', name: 'Deepa K.', initials: 'DK', avatarBg: '#fdecec', avatarColor: '#c94040',
    phone: '+91 96543 21000',
    interest: 'Interested: Ortho GRID · ₹8,490',
    product: 'Ortho GRID Mattress', crossSell: 'SmartGRID Pillow · ₹2,499',
    emiNote: 'Price sensitive — may need discount approval from manager',
    attractivenessScore: 65, expectedValue: 8490,
    badge: 'This week', badgeBg: '#fdecec', badgeColor: '#c94040',
    statusLabel: 'Cold', statusColor: '#e24b4a',
    icp: 60, icpColor: '#e24b4a',
    intent: 55, intentColor: '#e24b4a',
    buyingSignals: signals([
      ['Price Check', 'Compared prices on multiple platforms', '💰'],
    ]),
    lastContact: '5 days ago', source: 'Phone enquiry',
  },
  {
    id: 'l6', name: 'Rohan P.', initials: 'RP', avatarBg: '#e1f5ee', avatarColor: '#0f6e56',
    phone: '+91 95432 10000',
    interest: 'Interested: SmartGRID Luxe · ₹16,990',
    product: 'SmartGRID Luxe Mattress', crossSell: 'Adjustable Bed Base · ₹24,990',
    emiNote: 'High budget — upsell opportunity',
    attractivenessScore: 88, expectedValue: 16990,
    badge: 'Hot', badgeBg: '#e1f5ee', badgeColor: '#0f6e56',
    statusLabel: 'Open', statusColor: '#1d9e75',
    icp: 92, icpColor: '#1d9e75',
    intent: 94, intentColor: '#1d9e75',
    buyingSignals: signals([
      ['High Budget', 'Mentioned budget of ₹20,000+', '💎'],
      ['Store Visit', 'Visited store twice in one week', '🏪'],
      ['Referral', 'Referred by an existing premium customer', '🤝'],
    ]),
    lastContact: '1 hour ago', source: 'Walk-in → Store Koramangala',
  },
];

// ─── Live Queue ─────────────────────────────────────────────────

export const CALL_QUEUE: QueuedCaller[] = [
  { name: 'Priya Iyer', wait: '4m 20s', waitLevel: 'hi', intent: 'Likely billing dispute — flagged before' },
  { name: 'Suresh Nair', wait: '1m 50s', waitLevel: 'mid', intent: 'Plan upgrade enquiry' },
];

// ─── Recent Calls ───────────────────────────────────────────────

export const RECENT_CALLS: RecentCall[] = [
  { id: 'rc1', name: 'Mukunda R.', initials: 'MK', direction: 'outbound', duration: '6m 42s', time: '2:15 PM', outcome: 'Interested', outcomeColor: '#1d9e75', value: '₹8,490' },
  { id: 'rc2', name: 'Ritu S.', initials: 'RS', direction: 'inbound', duration: '3m 18s', time: '1:42 PM', outcome: 'Follow-up', outcomeColor: '#c8860a', value: '₹16,990' },
  { id: 'rc3', name: 'Kavita M.', initials: 'KM', direction: 'outbound', duration: '4m 55s', time: '12:30 PM', outcome: 'Callback', outcomeColor: '#185fa5', value: '₹12,990' },
  { id: 'rc4', name: 'Suresh N.', initials: 'SN', direction: 'missed', duration: '—', time: '11:15 AM', outcome: 'Missed', outcomeColor: '#e24b4a', value: '₹11,990' },
  { id: 'rc5', name: 'Deepa K.', initials: 'DK', direction: 'outbound', duration: '2m 10s', time: '10:45 AM', outcome: 'Not interested', outcomeColor: '#e24b4a' },
  { id: 'rc6', name: 'Anita R.', initials: 'AR', direction: 'inbound', duration: '5m 30s', time: '9:30 AM', outcome: 'Resolved', outcomeColor: '#1d9e75' },
  { id: 'rc7', name: 'Priya Iyer', initials: 'PI', direction: 'inbound', duration: '8m 12s', time: 'Yesterday', outcome: 'Interested', outcomeColor: '#1d9e75', value: '₹22,000' },
  { id: 'rc8', name: 'Rahul V.', initials: 'RV', direction: 'outbound', duration: '1m 45s', time: 'Yesterday', outcome: 'Follow-up', outcomeColor: '#c8860a' },
];

// ─── Incoming (Missed) Calls ────────────────────────────────────

export const INCOMING_CALLS: IncomingCall[] = [
  { id: 'ic1', name: 'Priya Iyer', initials: 'PI', phone: '+91 98450 67890', valueAtStake: '₹22,000', intent: 'Billing dispute — 2nd missed call', time: '10 min ago', missedCount: 2 },
  { id: 'ic2', name: 'Ankit Shah', initials: 'AS', phone: '+91 97650 34567', valueAtStake: '₹15,400', intent: 'Warranty claim follow-up', time: '25 min ago', missedCount: 1 },
  { id: 'ic3', name: 'Meera J.', initials: 'MJ', phone: '+91 96540 23456', valueAtStake: '₹8,990', intent: 'EMI plan enquiry', time: '1 hr ago', missedCount: 1 },
  { id: 'ic4', name: 'Rajesh K.', initials: 'RK', phone: '+91 95430 12345', valueAtStake: '₹31,000', intent: 'Bulk order — corporate gifting', time: '2 hrs ago', missedCount: 3 },
];

// ─── Wrapup Outcomes ────────────────────────────────────────────

export const WRAPUP_OUTCOMES: WrapupOutcome[] = [
  { key: 'interested', label: 'Interested', icon: 'ThumbsUp', color: '#0f6e56', bg: '#e1f5ee' },
  { key: 'followup', label: 'Follow-up needed', icon: 'CalendarClock', color: '#c8860a', bg: '#fff3d6' },
  { key: 'callback', label: 'Requested callback', icon: 'PhoneOutgoing', color: '#185fa5', bg: '#e8f0fe' },
  { key: 'resolved', label: 'Resolved', icon: 'CircleCheck', color: '#1d9e75', bg: '#e1f5ee' },
  { key: 'notinterested', label: 'Not interested', icon: 'Frown', color: '#e24b4a', bg: '#fdecec' },
];

// ─── SOP Items ──────────────────────────────────────────────────

export const CALL_SOP_ITEMS: SopItem[] = [
  { label: 'Opening & Intent Confirm' },
  { label: 'Needs Discovery' },
  { label: 'Product Pitch' },
  { label: 'EMI / Financing Mention' },
  { label: 'Warranty Mention' },
  { label: 'Closing / Callback Booking' },
];

// ─── Calendar ───────────────────────────────────────────────────

export const CALENDAR_INVITES: CalendarInvite[] = [
  { day: 3, time: '11:00 AM', title: 'SOP coaching session', meta: 'With Sunita Rao (Manager) · via #callcentre-team' },
  { day: 5, time: '2:30 PM', title: 'Warranty pitch refresher', meta: 'With L&D team · flagged from your last 3 calls' },
  { day: 7, time: '10:00 AM', title: 'Weekly team huddle', meta: 'With Call Centre team · #callcentre-team' },
  { day: 12, time: '3:00 PM', title: 'Product training: SmartGRID Luxe', meta: 'With Product team · virtual session' },
  { day: 14, time: '11:30 AM', title: 'Monthly review with ASM', meta: 'With Ravi Kumar (ASM) · performance review' },
  { day: 18, time: '4:00 PM', title: 'Cross-sell workshop', meta: 'With L&D team · improving attachment rate' },
  { day: 21, time: '10:00 AM', title: 'Weekly team huddle', meta: 'With Call Centre team · #callcentre-team' },
  { day: 25, time: '2:00 PM', title: 'Customer feedback review', meta: 'With QA team · recent NPS scores' },
  { day: 28, time: '10:00 AM', title: 'Weekly team huddle', meta: 'With Call Centre team · #callcentre-team' },
];

// ─── Pulse Channels ─────────────────────────────────────────────

export const PULSE_CHANNELS: PulseChannel[] = [
  { id: 'callcentre-team', name: '#callcentre-team', icon: '📞', unread: 3, lastMessage: 'Sunita: Greeting QA scores need attention', color: '#c8860a' },
  { id: 'customer-discussions', name: '#customer-discussions', icon: '💬', unread: 1, lastMessage: 'Arvind: Mukunda callback confirmed 4:30 PM', color: '#1d9e75' },
  { id: 'store-updates', name: '#store-updates', icon: '🏪', unread: 0, lastMessage: 'New SmartGRID Luxe stock arrived — Koramangala', color: '#185fa5' },
  { id: 'escalations', name: '#escalations', icon: '🚨', unread: 2, lastMessage: 'Priya Iyer billing dispute — needs manager input', color: '#e24b4a' },
];

// ─── Pulse Threads ──────────────────────────────────────────────

export const PULSE_THREADS: Record<string, PulseThread> = {
  'callcentre-team': {
    title: '#callcentre-team',
    dateLabel: 'Today · Call Centre Team',
    messages: [
      { id: 'm1', who: 'Sunita Rao', initials: 'SR', bg: '#faeeda', color: '#854f0b', text: '👥 <b>STAKEHOLDERS:</b> <b>@You (Arvind R.)</b>, whole call centre shift', time: '2:05 PM' },
      { id: 'm2', who: 'Sunita Rao', initials: 'SR', bg: '#faeeda', color: '#854f0b', text: '📋 <b>ISSUE DEFINITION:</b> Greeting-in-first-10s QA score is at 71% this week, below our 85% target.', time: '2:05 PM' },
      { id: 'm3', who: 'Sunita Rao', initials: 'SR', bg: '#faeeda', color: '#854f0b', text: '📊 <b>DATA SNAPSHOT:</b> 12 out of 40 calls this week missed the greeting window. Most misses are in the first hour after lunch.', time: '2:06 PM' },
      { id: 'm4', who: 'Sunita Rao', initials: 'SR', bg: '#faeeda', color: '#854f0b', text: '🎯 <b>ACTION ITEMS:</b> I\'m scheduling a 15-min coaching session Friday. Please confirm your slot.', time: '2:06 PM' },
      { id: 'm5', who: 'Ravi Kumar', initials: 'RK', bg: '#e8f0fe', color: '#185fa5', text: 'Good catch Sunita. Let me pull up the per-agent breakdown — I\'ll share before Friday.', time: '2:10 PM' },
    ],
    needsInput: {
      question: 'Confirm 4:30 PM Friday coaching slot with Sunita?',
      options: ['Confirmed ✓', 'Reschedule'],
    },
  },
  'customer-discussions': {
    title: '#customer-discussions',
    dateLabel: 'Today · Customer Discussions',
    messages: [
      { id: 'cd1', who: 'Arvind Rajan', initials: 'AR', bg: '#e1f5ee', color: '#0f6e56', text: 'Mukunda R. callback confirmed for 4:30 PM today. He\'s interested in Ortho GRID + Protector bundle.', time: '1:30 PM', isAgent: true },
      { id: 'cd2', who: 'Priya D.', initials: 'PD', bg: '#f3e8ff', color: '#6d28d9', text: 'Nice! I had a similar upsell last week. Make sure to mention the 10-year warranty — that\'s what closed it for me.', time: '1:35 PM' },
      { id: 'cd3', who: 'Arvind Rajan', initials: 'AR', bg: '#e1f5ee', color: '#0f6e56', text: 'Good tip, thanks Priya! Will lead with warranty + EMI combo.', time: '1:38 PM', isAgent: true },
    ],
  },
  'store-updates': {
    title: '#store-updates',
    dateLabel: 'Today · Store Updates',
    messages: [
      { id: 'su1', who: 'Store Bot', initials: '🏪', bg: '#e8f0fe', color: '#185fa5', text: '📦 <b>New stock alert:</b> SmartGRID Luxe (King) — 8 units arrived at Koramangala store.', time: '10:00 AM' },
      { id: 'su2', who: 'Store Bot', initials: '🏪', bg: '#e8f0fe', color: '#185fa5', text: '⚠️ <b>Low stock:</b> Ortho GRID (Queen) — only 2 units remaining. Restock ETA: Thursday.', time: '10:05 AM' },
    ],
  },
  'escalations': {
    title: '#escalations',
    dateLabel: 'Today · Escalations',
    messages: [
      { id: 'es1', who: 'System', initials: '🚨', bg: '#fdecec', color: '#e24b4a', text: '🔴 <b>ESCALATION:</b> Priya Iyer has called 3 times about a billing dispute. Value at stake: ₹22,000. Needs manager review.', time: '11:00 AM' },
      { id: 'es2', who: 'Sunita Rao', initials: 'SR', bg: '#faeeda', color: '#854f0b', text: 'I\'ll handle this one. Arvind, please don\'t call back until I\'ve reviewed the account.', time: '11:15 AM' },
    ],
  },
};

// ─── Notifications ──────────────────────────────────────────────

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', needsAction: true, icon: '☎️', color: '#854f0b', title: 'Sunita Rao is checking greeting-QA scores Friday — reply in #callcentre-team', time: '2:05 PM', cta: 'Open #callcentre-team' },
  { id: 'n2', needsAction: true, icon: '🎯', color: '#5b21b6', title: 'Skill Improvement Coach is waiting on you to pick a skill to practice', time: 'Today', cta: 'Open Coach' },
  { id: 'n3', needsAction: false, icon: '📊', color: '#1d9e75', title: 'Your OG Score improved to 76 — up 3 pts this week!', time: 'Today', cta: 'View Score' },
  { id: 'n4', needsAction: false, icon: '⭐', color: '#c8860a', title: 'You\'re now ranked #3 in Koramangala — keep it up!', time: 'Yesterday', cta: 'View Rank' },
  { id: 'n5', needsAction: true, icon: '📞', color: '#e24b4a', title: 'Rajesh K. has called 3 times — ₹31,000 at stake', time: '2 hrs ago', cta: 'Call Back' },
];

// ─── Dashboard KPIs ─────────────────────────────────────────────

export const KPI_METRICS: KpiMetric[] = [
  { label: 'Calls Today', value: 18, sub: '14 completed · 4 remaining', color: '#1d9e75', icon: 'Phone' },
  { label: 'Avg Duration', value: '4m 22s', sub: 'Target: 5m', color: '#185fa5', icon: 'Clock' },
  { label: 'Conversion', value: '84%', sub: 'Above 80% target', color: '#1d9e75', icon: 'TrendingUp' },
];

// ─── Dashboard Tasks ────────────────────────────────────────────

export const DAILY_TASKS: DailyTask[] = [
  { id: 't1', label: 'Follow up with Mukunda R. — Ortho GRID quote', done: false, leadId: 'l1' },
  { id: 't2', label: 'Call back Ritu S. — SmartGRID Luxe EMI', done: false, leadId: 'l2' },
  { id: 't3', label: 'Send warranty doc to Kavita M.', done: true, leadId: 'l3' },
  { id: 't4', label: 'Review SOP from morning calls', done: true },
  { id: 't5', label: 'Confirm Friday coaching with Sunita', done: false },
];

// ─── 7-Day Chart Data ──────────────────────────────────────────

export const CHART_DATA: ChartDataPoint[] = [
  { day: 'Mon', calls: 22, talkTime: 85, conversions: 6 },
  { day: 'Tue', calls: 19, talkTime: 72, conversions: 5 },
  { day: 'Wed', calls: 25, talkTime: 98, conversions: 8 },
  { day: 'Thu', calls: 18, talkTime: 68, conversions: 4 },
  { day: 'Fri', calls: 21, talkTime: 78, conversions: 7 },
  { day: 'Sat', calls: 15, talkTime: 55, conversions: 3 },
  { day: 'Sun', calls: 14, talkTime: 52, conversions: 4 },
];

// ─── Agent Roles (Pulse Home) ───────────────────────────────────

export const AGENT_ROLES: AgentRole[] = [
  { id: 'walkout', icon: '1️⃣', title: 'Walk-out Recovery', sub: 'Win back store visitors who left', gradient: 'linear-gradient(135deg, #0f6e56, #1d9e75)' },
  { id: 'pitchcoach', icon: '2️⃣', title: 'Pitch Coach', sub: 'Practice & perfect your pitch', gradient: 'linear-gradient(135deg, #854f0b, #c8860a)' },
  { id: 'asmagent', icon: '3️⃣', title: 'ASM Agent', sub: 'Area sales manager assistant', gradient: 'linear-gradient(135deg, #1a1a2e, #2d2d5f)' },
  { id: 'telecaller', icon: '4️⃣', title: 'Tele-caller', sub: 'Outbound call campaigns', gradient: 'linear-gradient(135deg, #4a154b, #6d28d9)' },
  { id: 'followup', icon: '5️⃣', title: 'Follow-up', sub: 'Nurture leads to close', gradient: 'linear-gradient(135deg, #185fa5, #2563eb)' },
];

// ─── User Profile ───────────────────────────────────────────────

export const USER = {
  name: 'Arvind Rajan',
  initials: 'AR',
  emoji: '🦸‍♂️',
  store: 'Koramangala',
  brand: 'The Sleep Company',
  ogScore: 76,
  rank: 3,
  rankLocation: 'Koramangala',
  callsCompleted: 14,
  callsTotal: 18,
  earnings: 5200,
};
