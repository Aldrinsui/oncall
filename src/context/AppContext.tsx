import { createContext, useContext, useState, useRef, useMemo, type ReactNode } from 'react';
import type {
  View,
  PlanTab,
  PulseView,
  CallTarget,
  CallMode,
  RecentCall,
  SellingPersona,
  RecordingConsentState,
  ConsentRecord,
  DailyTask,
  QueuedCaller,
  ChartDataPoint,
  PulseMessage,
} from '../types';
import { RECENT_CALLS, SELLING_PERSONAS, DAILY_TASKS, CALL_QUEUE, CHART_DATA, PULSE_THREADS } from '../data/mockData';
import {
  calculateShiftProgress,
  calculateShiftPace,
  calculateAverageTalkTime,
  calculateConversionMetrics,
  calculateEarnings,
  aggregateWeeklyChartData,
  isQualifyingConversion,
  type ShiftProgress,
  type ShiftPace,
  type ConversionMetrics,
  type EarningsBreakdown,
} from '../services/dashboardService';
import {
  initiateOutboundCall,
  fetchCallStatus,
  terminateCall,
  bridgeCall,
  type CallDto,
} from '../services/telephonyApi';

interface AppContextType {
  activeView: View;
  setActiveView: (v: View) => void;
  planTab: PlanTab;
  setPlanTab: (t: PlanTab) => void;
  pulseView: PulseView;
  setPulseView: (v: PulseView) => void;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  leadsModalOpen: boolean;
  setLeadsModalOpen: (open: boolean) => void;
  leadsModalPage: number;
  setLeadsModalPage: (page: number) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  incomingAlerts: boolean;
  setIncomingAlerts: (enabled: boolean) => void;
  audioOutput: string;
  setAudioOutput: (output: string) => void;
  avatarModalOpen: boolean;
  setAvatarModalOpen: (open: boolean) => void;
  currentAvatar: SellingPersona;
  setCurrentAvatar: (p: SellingPersona) => void;
  saveAvatar: (p: SellingPersona) => void;
  ogScoreModalOpen: boolean;
  setOgScoreModalOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  // Call state
  callMode: CallMode;
  setCallMode: (m: CallMode) => void;
  callState: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review';
  setCallState: (s: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review') => void;
  callingLead: string | null;
  setCallingLead: (id: string | null) => void;
  activeCallTarget: CallTarget | null;
  setActiveCallTarget: (target: CallTarget | null) => void;
  backendCallId: string | null;
  backendCallStatus: string | null;
  backendCallDetails: CallDto | null;
  telephonyError: string | null;
  dialpadModalOpen: boolean;
  setDialpadModalOpen: (open: boolean) => void;
  startRoleplay: (target: CallTarget) => void;
  startCall: (target: CallTarget) => Promise<void> | void;
  endCall: () => Promise<void> | void;
  bridgeActiveCall: () => Promise<void>;
  recentCalls: RecentCall[];
  addRecentCall: (call: RecentCall) => void;
  // Recording consent compliance (DPDP)
  recordingConsent: RecordingConsentState;
  setRecordingConsent: (s: RecordingConsentState) => void;
  currentConsent: ConsentRecord | null;
  grantConsent: (
    method: 'voice' | 'wa',
    phone?: string,
    lang?: string,
    isMinor?: boolean,
    guardianPhone?: string
  ) => ConsentRecord;
  declineConsent: (
    method?: 'voice' | 'wa',
    isMinor?: boolean,
    guardianPhone?: string
  ) => void;
  resetConsent: () => void;
  // Dashboard Metrics & Central Domain Store
  shiftProgress: ShiftProgress;
  shiftPace: ShiftPace;
  avgTalkTime: string;
  conversions: ConversionMetrics;
  earnings: EarningsBreakdown;
  weeklyChartData: ChartDataPoint[];
  dailyTasks: DailyTask[];
  toggleTask: (taskId: string) => void;
  callQueue: QueuedCaller[];
  acceptQueueCaller: (callerId: string) => void;
  // Pulse Channels & Messages
  pulseMessages: Record<string, PulseMessage[]>;
  sendPulseMessage: (
    channelId: string,
    text: string,
    senderOverride?: Partial<PulseMessage>
  ) => PulseMessage;
  pinnedAnswers: Record<string, string>;
  answerPinnedCard: (cardId: string, answer: string, channelId?: string) => void;
  // Toast feedback
  toastMessage: string | null;
  showToast: (msg: string) => void;
}



const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [planTab, setPlanTab] = useState<PlanTab>('outgoing');
  const [pulseView, setPulseView] = useState<PulseView>('home');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [leadsModalOpen, setLeadsModalOpen] = useState(false);
  const [leadsModalPage, setLeadsModalPage] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [incomingAlerts, setIncomingAlerts] = useState(true);
  const [audioOutput, setAudioOutput] = useState('Web Audio Synth (Active)');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  // 1. Five Selectable Personas with LocalStorage Persistence
  const [currentAvatar, setCurrentAvatar] = useState<SellingPersona>(() => {
    try {
      const saved = localStorage.getItem('onground_selected_avatar');
      if (saved) {
        const parsed = JSON.parse(saved);
        const matched = SELLING_PERSONAS.find((p) => p.id === parsed.id || p.name === parsed.name);
        if (matched) return matched;
      }
    } catch (e) {
      console.warn('Failed to parse avatar from localStorage', e);
    }
    return SELLING_PERSONAS[0]; // Default: Atlas
  });

  const saveAvatar = (persona: SellingPersona) => {
    setCurrentAvatar(persona);
    try {
      localStorage.setItem('onground_selected_avatar', JSON.stringify(persona));
    } catch (e) {
      console.warn('Failed to persist avatar to localStorage', e);
    }
  };

  // 2. DPDP Recording Consent Gate ("Ask before you record")
  const [recordingConsent, setRecordingConsent] = useState<RecordingConsentState>('pending');
  const [currentConsent, setCurrentConsent] = useState<ConsentRecord | null>(null);

  const grantConsent = (
    method: 'voice' | 'wa',
    phone?: string,
    lang?: string,
    isMinor?: boolean,
    guardianPhone?: string
  ): ConsentRecord => {
    const consentId = `CNS-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const record: ConsentRecord = {
      consentId,
      status: 'granted',
      method,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      phone,
      language: lang,
      isMinor: !!isMinor,
      guardianPhone: isMinor ? guardianPhone : undefined,
      guardianConsent: !!isMinor,
      verifiedText: isMinor
        ? method === 'wa'
          ? `Parent/Guardian tapped Yes on WhatsApp consent link sent to +91 ${guardianPhone || phone}`
          : 'Parent/Guardian gave verbal recording consent out loud'
        : method === 'wa'
        ? 'Customer tapped Yes on WhatsApp consent link'
        : 'Customer gave verbal consent out loud',
    };
    setRecordingConsent('granted');
    setCurrentConsent(record);
    return record;
  };

  const declineConsent = (
    method: 'voice' | 'wa' = 'voice',
    isMinor?: boolean,
    guardianPhone?: string
  ) => {
    const consentId = `CNS-REF-${Math.floor(100000 + Math.random() * 900000)}`;
    const record: ConsentRecord = {
      consentId,
      status: 'declined',
      method,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMinor: !!isMinor,
      guardianPhone: isMinor ? guardianPhone : undefined,
      guardianConsent: false,
      verifiedText: isMinor
        ? method === 'wa'
          ? 'Parent/Guardian tapped No on WhatsApp'
          : 'Parent/Guardian verbally declined recording'
        : method === 'wa'
        ? 'Customer tapped No on WhatsApp'
        : 'Customer verbally declined recording',
    };
    setRecordingConsent('declined');
    setCurrentConsent(record);
  };


  const resetConsent = () => {
    setRecordingConsent('pending');
    setCurrentConsent(null);
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'active' | 'wrapup' | 'review'>('idle');
  const [callingLead, setCallingLead] = useState<string | null>(null);
  const [activeCallTarget, setActiveCallTarget] = useState<CallTarget | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>(() => {
    try {
      const saved = localStorage.getItem('onground_recent_calls');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse recent calls from localStorage', e);
    }
    return RECENT_CALLS;
  });

  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(() => {
    try {
      const saved = localStorage.getItem('onground_daily_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse daily tasks from localStorage', e);
    }
    return DAILY_TASKS;
  });

  const toggleTask = (taskId: string) => {
    setDailyTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      try {
        localStorage.setItem('onground_daily_tasks', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist daily tasks to localStorage', e);
      }
      return next;
    });
  };

  const [callQueue, setCallQueue] = useState<QueuedCaller[]>(() => {
    try {
      const saved = localStorage.getItem('onground_call_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse call queue from localStorage', e);
    }
    return CALL_QUEUE.map((c) => ({ ...c, status: 'waiting' as const }));
  });

  const acceptQueueCaller = (callerId: string) => {
    setCallQueue((prev) => {
      const next = prev.map((c) => (c.id === callerId ? { ...c, status: 'in_call' as const } : c));
      try {
        localStorage.setItem('onground_call_queue', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist call queue to localStorage', e);
      }
      return next;
    });
  };

  // Central Pulse Messaging State with LocalStorage Persistence
  const [pulseMessages, setPulseMessages] = useState<Record<string, PulseMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('onground_pulse_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse pulse messages from localStorage', e);
    }
    const map: Record<string, PulseMessage[]> = {};
    Object.keys(PULSE_THREADS).forEach((key) => {
      map[key] = [...PULSE_THREADS[key].messages];
    });
    return map;
  });

  const sendPulseMessage = (
    channelId: string,
    text: string,
    senderOverride?: Partial<PulseMessage>
  ): PulseMessage => {
    const newMessage: PulseMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      who: senderOverride?.who || 'Arvind Rajan',
      initials: senderOverride?.initials || 'AR',
      bg: senderOverride?.bg || '#e1f5ee',
      color: senderOverride?.color || '#0f6e56',
      text: text.trim(),
      time: senderOverride?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAgent: senderOverride?.isAgent !== undefined ? senderOverride.isAgent : true,
    };

    setPulseMessages((prev) => {
      const updated = {
        ...prev,
        [channelId]: [...(prev[channelId] || []), newMessage],
      };
      try {
        localStorage.setItem('onground_pulse_messages', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist pulse messages', e);
      }
      return updated;
    });

    return newMessage;
  };

  // Persistent Pinned Card Answers
  const [pinnedAnswers, setPinnedAnswers] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('onground_pinned_answers');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse pinned answers from localStorage', e);
    }
    return {};
  });

  const answerPinnedCard = (cardId: string, answer: string, channelId?: string) => {
    setPinnedAnswers((prev) => {
      const next = { ...prev, [cardId]: answer };
      try {
        localStorage.setItem('onground_pinned_answers', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist pinned answers to localStorage', e);
      }
      return next;
    });

    if (channelId) {
      sendPulseMessage(channelId, `@Sunita Rao ${answer}`);
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ogScoreModalOpen, setOgScoreModalOpen] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3000);
  };

  const [backendCallId, setBackendCallId] = useState<string | null>(null);
  const [backendCallStatus, setBackendCallStatus] = useState<string | null>(null);
  const [backendCallDetails, setBackendCallDetails] = useState<CallDto | null>(null);
  const [telephonyError, setTelephonyError] = useState<string | null>(null);
  const [dialpadModalOpen, setDialpadModalOpen] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCallPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startRoleplay = (target: CallTarget) => {
    // 1. Clear any existing polling
    clearCallPolling();
    // 2. Set call mode to ROLEPLAY
    setCallMode('ROLEPLAY');
    // 3. Set the active target
    setActiveCallTarget(target);
    setCallingLead(target.id);
    // 4. Navigate to Plan
    setActiveView('plan');
    // 5. Preserve or select the Practice a Call tab
    setPlanTab('practise');
    // 6. Reset backendCallId, backendCallStatus and backendCallDetails
    setBackendCallId(null);
    setBackendCallStatus(null);
    setBackendCallDetails(null);
    // 7. Clear previous telephony errors
    setTelephonyError(null);
    // 8. Reset recording consent for the new session
    resetConsent();
    // 9. Set callState to ringing
    setCallState('ringing');
    // 10-12. Pure local simulation: zero backend or telephony provider calls
    showToast(`AI Roleplay simulator ringing for ${target.name}...`);
  };

  const startCall = async (target: CallTarget) => {
    clearCallPolling();
    // Exclusively for real PSTN calling
    setCallMode('PSTN');
    setActiveCallTarget(target);
    setCallingLead(target.id);
    setActiveView('plan');
    setCallState('ringing');
    setBackendCallId(null);
    setBackendCallStatus(null);
    setBackendCallDetails(null);
    setTelephonyError(null);
    resetConsent(); // Always re-arm consent gate on new call
    showToast(`Calling ${target.name} (${target.phone})...`);

    // Format phone to E.164 standard (+91 country code for Indian numbers)
    let cleanPhone = (target.phone || '').replace(/[\s\-\(\)]/g, '');
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        cleanPhone = `+91${cleanPhone}`;
      } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = `+${cleanPhone}`;
      } else {
        cleanPhone = `+91${cleanPhone}`;
      }
    }

    if (!cleanPhone || !cleanPhone.startsWith('+') || !/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
      clearCallPolling();
      setCallState('idle');
      setCallMode(null);
      const msg = 'Invalid phone number format: Destination must be in E.164 format (e.g. +919876543210)';
      setTelephonyError(msg);
      showToast(`PSTN Calling Failed: ${msg}`);
      return;
    }

    try {
      const isUuid = target.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id);
      const storedAgentPhone = typeof window !== 'undefined' ? localStorage.getItem('onground_agent_phone') : null;
      const agentPhone = target.agentPhone || storedAgentPhone || undefined;

      const callDto = await initiateOutboundCall({
        customerPhone: cleanPhone,
        customerName: target.name,
        agentPhone: agentPhone,
        agentEndpointUri: agentPhone,
        notes: target.intent || 'Real outbound PSTN call from OnGround portal',
        leadId: isUuid ? target.id : undefined,
      });

      setBackendCallId(callDto.id);
      setBackendCallStatus(callDto.status);
      setBackendCallDetails(callDto);
      const leg = callDto.legs?.[0];
      const providerName = leg?.provider?.toUpperCase() || 'PSTN';
      showToast(`Real ${providerName} PSTN call ringing on ${cleanPhone} (Call ID: ${callDto.id.slice(0, 8)})`);

      // Start polling provider status every 1.5 seconds
      pollTimerRef.current = setInterval(async () => {
        try {
          const updated = await fetchCallStatus(callDto.id);
          setBackendCallStatus(updated.status);
          setBackendCallDetails(updated);

          if (updated.status === 'CONNECTED') {
            setCallState('active');
          } else if (updated.status === 'WRAPUP' || updated.status === 'COMPLETED') {
            clearCallPolling();
            setCallState('wrapup');
          } else if (
            updated.status === 'BUSY' ||
            updated.status === 'NO_ANSWER' ||
            updated.status === 'FAILED' ||
            updated.status === 'CANCELLED'
          ) {
            clearCallPolling();
            showToast(`PSTN call ended: ${updated.status}`);
            setCallState('wrapup');
          }
        } catch (pollErr) {
          console.warn('Call status poll warning:', pollErr);
        }
      }, 1500);

    } catch (err: any) {
      clearCallPolling();
      const msg = err?.message || 'Telephony provider connection failed';
      console.warn('Real PSTN calling dispatch note:', msg);
      setTelephonyError(msg);
      setCallState('idle'); // Clear ringing state on initiation failure
      setCallMode(null);
      showToast(`PSTN Calling Failed: ${msg}`);
    }
  };

  const bridgeActiveCall = async () => {
    if (!backendCallId) return;
    try {
      showToast('Bridging carrier conference lines...');
      const updated = await bridgeCall(backendCallId);
      setBackendCallStatus(updated.status);
      setBackendCallDetails(updated);
      if (updated.status === 'CONNECTED') {
        setCallState('active');
        showToast('Lines bridged! Two-way PSTN conversation live.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to bridge conference lines';
      showToast(`Carrier Bridge Error: ${msg}`);
      throw err;
    }
  };

  const endCall = async () => {
    clearCallPolling();
    // Only issue provider termination if active in PSTN mode with real backendCallId
    if (callMode === 'PSTN' && backendCallId) {
      try {
        await terminateCall(backendCallId);
      } catch (err) {
        console.warn('Failed to terminate backend call leg:', err);
      }
    }
    setCallState('wrapup');
  };

  const addRecentCall = (call: RecentCall) => {
    // If call doesn't have consent attached, attach currentConsent
    const callWithConsent: RecentCall = {
      ...call,
      consent: call.consent || currentConsent || undefined,
    };

    setRecentCalls((prev) => {
      // Deduplicate: If call with this ID already exists, do not double-increment
      if (prev.some((c) => c.id === callWithConsent.id)) {
        return prev;
      }
      const updated = [callWithConsent, ...prev];
      try {
        localStorage.setItem('onground_recent_calls', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist recent calls to localStorage', e);
      }
      return updated;
    });
  };

  // Static initial IDs to distinguish newly completed calls in this environment
  const initialCallIds = useMemo(() => new Set(RECENT_CALLS.map((c) => c.id)), []);

  // Filter newly completed calls (excluding initial demo rows and missed calls)
  const newCalls = useMemo(() => {
    return recentCalls.filter((c) => !initialCallIds.has(c.id) && c.outcome !== 'Missed');
  }, [recentCalls, initialCallIds]);

  // Total completed calls: Baseline 14 + new completed calls
  const callsCompleted = 14 + newCalls.length;
  const callsTotal = 18;

  const shiftProgress = useMemo(() => {
    return calculateShiftProgress(callsCompleted, callsTotal);
  }, [callsCompleted, callsTotal]);

  const shiftPace = useMemo(() => {
    return calculateShiftPace(callsCompleted, callsTotal);
  }, [callsCompleted, callsTotal]);

  const avgTalkTime = useMemo(() => {
    return calculateAverageTalkTime(newCalls, 14);
  }, [newCalls]);

  const conversions = useMemo(() => {
    return calculateConversionMetrics(newCalls, 11, 14);
  }, [newCalls]);

  const newConversionsCount = useMemo(() => {
    return newCalls.filter((c) => isQualifyingConversion(c.outcome)).length;
  }, [newCalls]);

  const earnings = useMemo(() => {
    return calculateEarnings(newConversionsCount);
  }, [newConversionsCount]);

  const weeklyChartData = useMemo(() => {
    return aggregateWeeklyChartData(CHART_DATA, newCalls);
  }, [newCalls]);

  return (
    <AppContext.Provider value={{
      activeView, setActiveView,
      planTab, setPlanTab,
      pulseView, setPulseView,
      activeChannelId, setActiveChannelId,
      leadsModalOpen, setLeadsModalOpen,
      leadsModalPage, setLeadsModalPage,
      notificationsOpen, setNotificationsOpen,
      settingsOpen, setSettingsOpen,
      incomingAlerts, setIncomingAlerts,
      audioOutput, setAudioOutput,
      avatarModalOpen, setAvatarModalOpen,
      currentAvatar, setCurrentAvatar, saveAvatar,
      ogScoreModalOpen, setOgScoreModalOpen,
      sidebarCollapsed, setSidebarCollapsed,
      callMode, setCallMode,
      callState, setCallState,
      callingLead, setCallingLead,
      activeCallTarget, setActiveCallTarget,
      backendCallId, backendCallStatus, backendCallDetails, telephonyError,
      dialpadModalOpen, setDialpadModalOpen,
      startRoleplay, startCall, endCall, bridgeActiveCall,
      recentCalls, addRecentCall,
      shiftProgress, shiftPace, avgTalkTime, conversions, earnings, weeklyChartData,
      dailyTasks, toggleTask,
      callQueue, acceptQueueCaller,
      pulseMessages, sendPulseMessage,
      pinnedAnswers, answerPinnedCard,
      recordingConsent, setRecordingConsent,
      currentConsent, grantConsent, declineConsent, resetConsent,
      toastMessage, showToast,
    }}>
      {children}
    </AppContext.Provider>
  );

}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
