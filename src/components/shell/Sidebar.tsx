import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Phone,
  Calendar,
  MessageCircle,
  PhoneIncoming,
  PhoneOutgoing,
  History,
  PhoneCall,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState } from 'react';
import type { View, PlanTab } from '../../types';
import { LEADS } from '../../data/mockData';

const NAV_ITEMS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: Phone },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'pulse', label: 'Pulse', icon: MessageCircle },
];

const PLAN_SUB_ITEMS: { id: PlanTab; label: string; icon: typeof PhoneOutgoing }[] = [
  { id: 'outgoing', label: 'Calls to make', icon: PhoneOutgoing },
  { id: 'incoming', label: 'Incoming', icon: PhoneIncoming },
  { id: 'recent', label: 'Recent', icon: History },
  { id: 'practise', label: 'Practise a call', icon: PhoneCall },
];

export default function Sidebar() {
  const {
    activeView,
    setActiveView,
    planTab,
    setPlanTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    startCall,
  } = useApp();
  const [planOpen, setPlanOpen] = useState(activeView === 'plan');

  const handleNavClick = (id: View) => {
    if (id === 'plan') {
      setPlanOpen(!planOpen);
      setActiveView('plan');
    } else {
      setActiveView(id);
      setPlanOpen(false);
    }
  };

  const handlePlanSubClick = (tab: PlanTab) => {
    setActiveView('plan');
    setPlanTab(tab);
    setPlanOpen(true);

    if (tab === 'practise') {
      const lead = LEADS[0];
      startCall({
        id: lead.id,
        name: `${lead.name} (AI Roleplay Practise)`,
        initials: lead.initials,
        phone: lead.phone,
        avatarBg: lead.avatarBg,
        avatarColor: lead.avatarColor,
        intent: 'AI Voice Roleplay Practice',
        product: lead.product,
        value: `₹${lead.expectedValue.toLocaleString('en-IN')}`,
        personaChallenge: lead.emiNote,
      });
    }
  };

  if (sidebarCollapsed) {
    return (
      <aside
        className="hidden md:flex w-14 min-h-screen flex-col flex-shrink-0 bg-gradient-to-b from-og-forest to-og-forest-deep p-2 items-center gap-4 z-40 fixed left-0 top-0 bottom-0 shadow-lg"
        aria-label="Collapsed Sidebar"
      >
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>

        <nav className="flex flex-col gap-2 w-full items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-gradient-to-br from-og-green to-og-green-light text-white shadow-md'
                    : 'text-[#a9c4ba] hover:bg-white/10'
                }`}
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex w-56 min-h-screen flex-col flex-shrink-0 bg-gradient-to-b from-og-forest to-og-forest-deep shadow-[2px_0_16px_rgba(0,0,0,0.18)] p-5 gap-1 z-40 fixed left-0 top-0 bottom-0"
      aria-label="Main Navigation Sidebar"
    >
      {/* Brand Header with Collapse Toggle */}
      <div className="flex items-center justify-between px-2.5 pb-5">
        <span className="text-white font-extrabold text-base tracking-tight">On-Ground.ai</span>
        <button
          onClick={() => setSidebarCollapsed(true)}
          className="text-[#a9c4ba]/70 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          const isPlan = item.id === 'plan';

          return (
            <div key={item.id}>
              <button
                onClick={() => handleNavClick(item.id)}
                aria-label={item.label}
                aria-expanded={isPlan ? planOpen : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-og transition-colors duration-150 group
                  ${isActive ? 'bg-white/5' : 'hover:bg-white/[0.06]'}
                `}
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-og-green to-og-green-light shadow-[0_2px_8px_rgba(29,158,117,0.4)]'
                      : 'bg-white/[0.08]'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-white' : 'text-og-green-light/70'} />
                </span>
                <span
                  className={`text-sm font-semibold flex-1 text-left ${
                    isActive ? 'text-white font-bold' : 'text-[#a9c4ba]'
                  }`}
                >
                  {item.label}
                </span>
                {isPlan && (
                  <span className="text-[#a9c4ba]/60">
                    {planOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </button>

              {/* Plan sub-items */}
              {isPlan && planOpen && (
                <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3 animate-fade-in">
                  {PLAN_SUB_ITEMS.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeView === 'plan' && planTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handlePlanSubClick(sub.id)}
                        aria-label={sub.label}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          isSubActive
                            ? 'text-white font-bold bg-white/10'
                            : 'text-[#a9c4ba]/80 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <SubIcon size={14} className={sub.id === 'practise' ? 'text-og-green-light' : undefined} />
                        <span>{sub.label}</span>
                        {sub.id === 'practise' && (
                          <span className="ml-auto text-[9px] bg-og-green/20 text-og-green-light px-1.5 py-0.2 rounded font-bold">
                            AI
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Store Info */}
      <div className="px-2.5 pt-4 border-t border-white/10 text-[11px] text-[#a9c4ba]/60">
        Koramangala Store · Retail
      </div>
    </aside>
  );
}
