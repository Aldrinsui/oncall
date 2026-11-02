import { createContext, useContext, useState, useRef, type ReactNode } from 'react';
import type {
  View,
  PlanTab,
  PulseView,
  CallTarget,
  RecentCall,
  SellingPersona,
  RecordingConsentState,
  ConsentRecord,
} from '../types';
import { RECENT_CALLS, SELLING_PERSONAS } from '../data/mockData';

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
  callState: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review';
  setCallState: (s: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review') => void;
  callingLead: string | null;
  setCallingLead: (id: string | null) => void;
  activeCallTarget: CallTarget | null;
  setActiveCallTarget: (target: CallTarget | null) => void;
  startCall: (target: CallTarget) => void;
  endCall: () => void;
  recentCalls: RecentCall[];
  addRecentCall: (call: RecentCall) => void;
  // Recording consent compliance (DPDP)
  recordingConsent: RecordingConsentState;
  setRecordingConsent: (s: RecordingConsentState) => void;
  currentConsent: ConsentRecord | null;
  grantConsent: (method: 'voice' | 'wa', phone?: string, lang?: string) => ConsentRecord;
  declineConsent: (method?: 'voice' | 'wa') => void;
  resetConsent: () => void;
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

  const grantConsent = (method: 'voice' | 'wa', phone?: string, lang?: string): ConsentRecord => {
    const consentId = `CNS-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const record: ConsentRecord = {
      consentId,
      status: 'granted',
      method,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      phone,
      language: lang,
      verifiedText:
        method === 'wa'
          ? 'Customer tapped Yes on WhatsApp consent link'
          : 'Customer gave verbal consent out loud',
    };
    setRecordingConsent('granted');
    setCurrentConsent(record);
    return record;
  };

  const declineConsent = (method: 'voice' | 'wa' = 'voice') => {
    const consentId = `CNS-REF-${Math.floor(100000 + Math.random() * 900000)}`;
    const record: ConsentRecord = {
      consentId,
      status: 'declined',
      method,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      verifiedText:
        method === 'wa' ? 'Customer tapped No on WhatsApp' : 'Customer verbally declined recording',
    };
    setRecordingConsent('declined');
    setCurrentConsent(record);
  };

  const resetConsent = () => {
    setRecordingConsent('pending');
    setCurrentConsent(null);
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'active' | 'wrapup' | 'review'>('idle');
  const [callingLead, setCallingLead] = useState<string | null>(null);
  const [activeCallTarget, setActiveCallTarget] = useState<CallTarget | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>(RECENT_CALLS);
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

  const startCall = (target: CallTarget) => {
    setActiveCallTarget(target);
    setCallingLead(target.id);
    setActiveView('plan');
    setCallState('ringing');
    resetConsent(); // Always re-arm consent gate on new call
    showToast(`Calling ${target.name} (${target.phone})...`);
  };

  const endCall = () => {
    setCallState('wrapup');
  };

  const addRecentCall = (call: RecentCall) => {
    // If call doesn't have consent attached, attach currentConsent
    const callWithConsent: RecentCall = {
      ...call,
      consent: call.consent || currentConsent || undefined,
    };
    setRecentCalls((prev) => [callWithConsent, ...prev]);
  };

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
      callState, setCallState,
      callingLead, setCallingLead,
      activeCallTarget, setActiveCallTarget,
      startCall, endCall,
      recentCalls, addRecentCall,
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
