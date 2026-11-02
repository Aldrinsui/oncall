import { createContext, useContext, useState, useRef, type ReactNode } from 'react';
import type { View, PlanTab, PulseView } from '../types';

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
  ogScoreModalOpen: boolean;
  setOgScoreModalOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  // Call state
  callState: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review';
  setCallState: (s: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review') => void;
  callingLead: string | null;
  setCallingLead: (id: string | null) => void;
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'active' | 'wrapup' | 'review'>('idle');
  const [callingLead, setCallingLead] = useState<string | null>(null);
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
      ogScoreModalOpen, setOgScoreModalOpen,
      sidebarCollapsed, setSidebarCollapsed,
      callState, setCallState,
      callingLead, setCallingLead,
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
