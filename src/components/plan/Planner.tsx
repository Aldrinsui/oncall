import { useApp } from '../../context/AppContext';
import {
  PhoneOutgoing,
  PhoneIncoming,
  History,
  PhoneCall,
  Calendar,
  Sparkles,
  Play,
} from 'lucide-react';
import CallsToMake from './CallsToMake';
import IncomingCalls from './IncomingCalls';
import RecentCalls from './RecentCalls';
import { LEADS, INCOMING_CALLS, RECENT_CALLS } from '../../data/mockData';
import type { PlanTab } from '../../types';

export default function Planner() {
  const {
    planTab,
    setPlanTab,
    setCallingLead,
    setCallState,
    showToast,
  } = useApp();

  const handleStartPractise = (leadId: string, leadName: string) => {
    setCallingLead(leadId);
    setCallState('ringing');
    showToast(`Starting AI simulated practise call with ${leadName}...`);
  };

  const tabs: { id: PlanTab; label: string; count?: number; icon: typeof PhoneOutgoing; isAi?: boolean }[] = [
    { id: 'outgoing', label: 'Calls to make', count: LEADS.length, icon: PhoneOutgoing },
    { id: 'incoming', label: 'Incoming', count: INCOMING_CALLS.length, icon: PhoneIncoming },
    { id: 'recent', label: 'Recent', count: RECENT_CALLS.length, icon: History },
    { id: 'practise', label: 'Practise a call', icon: PhoneCall, isAi: true },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Planner Hero Header */}
      <div className="bg-gradient-to-r from-og-night-mid to-[#2d2d5f] text-white p-5 rounded-card shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-og-green-light uppercase tracking-wider">
            Today's Calling Plan
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">Planner</h2>
          <p className="text-xs text-gray-300 mt-0.5">
            18 target calls scheduled • Koramangala Store shift allocation
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-xs self-start sm:self-auto">
          <Calendar size={16} className="text-og-green-light" />
          <span className="text-xs font-bold text-white tracking-wide">
            Tuesday, 3 Nov 2026
          </span>
        </div>
      </div>

      {/* Plan Sub-tab Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-og-gray rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = planTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setPlanTab(tab.id);
                if (tab.id === 'practise') {
                  showToast('AI Roleplay practice simulator ready — choose a customer persona below');
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-white text-og-forest shadow-xs'
                  : 'text-og-gray-text hover:text-[#1c1c1e] hover:bg-white/50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-og-green' : undefined} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isActive ? 'bg-og-green-bg text-og-forest' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.isAi && (
                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-black">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs">
        {planTab === 'outgoing' && <CallsToMake />}
        {planTab === 'incoming' && <IncomingCalls />}
        {planTab === 'recent' && <RecentCalls />}
        {planTab === 'practise' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/40 p-4 rounded-xl border border-purple-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-og-purple-mid uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={14} />
                  AI Voice Roleplay Simulator
                </span>
                <h3 className="text-base font-bold text-[#1c1c1e] mt-1">
                  Practise Pitching & Objection Handling
                </h3>
                <p className="text-xs text-og-gray-text mt-0.5">
                  Train with simulated customer personas before making live customer calls. Real speech synthesis and SOP score feedback.
                </p>
              </div>

              <button
                onClick={() => handleStartPractise('l1', 'Mukunda R. (Ortho GRID Persona)')}
                className="px-4 py-2.5 bg-og-purple-mid hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all flex-shrink-0"
              >
                <Play size={14} className="fill-white" />
                <span>Launch Mukunda Simulation</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LEADS.slice(0, 4).map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 rounded-xl border border-og-gray-border hover:border-og-purple-mid/40 hover:shadow-xs transition-all space-y-2 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{ backgroundColor: lead.avatarBg, color: lead.avatarColor }}
                      >
                        {lead.initials}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#1c1c1e]">{lead.name}</h4>
                        <span className="text-[11px] text-og-gray-text">{lead.product}</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                      Persona
                    </span>
                  </div>

                  <p className="text-xs text-og-gray-text leading-snug">
                    <strong className="text-gray-700 font-semibold">Challenge: </strong>
                    {lead.emiNote}
                  </p>

                  <button
                    onClick={() => handleStartPractise(lead.id, lead.name)}
                    className="w-full py-1.5 bg-og-gray hover:bg-purple-50 hover:text-purple-700 text-[#1c1c1e] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PhoneCall size={13} />
                    <span>Practise this Scenario</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
