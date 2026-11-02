import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Phone, Calendar, MessageCircle, PhoneIncoming, PhoneOutgoing, History, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { View } from '../../types';

const NAV_ITEMS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: Phone },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'pulse', label: 'Pulse', icon: MessageCircle },
];

const PLAN_SUB_ITEMS = [
  { id: 'outgoing' as const, label: 'Calls to make', icon: PhoneOutgoing },
  { id: 'incoming' as const, label: 'Incoming', icon: PhoneIncoming },
  { id: 'recent' as const, label: 'Recent', icon: History },
];

export default function Sidebar() {
  const { activeView, setActiveView, planTab, setPlanTab, sidebarCollapsed } = useApp();
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

  const handlePlanSubClick = (tab: typeof PLAN_SUB_ITEMS[number]['id']) => {
    setActiveView('plan');
    setPlanTab(tab);
    setPlanOpen(true);
  };

  if (sidebarCollapsed) return null;

  return (
    <aside className="hidden md:flex w-56 min-h-screen flex-col flex-shrink-0 bg-gradient-to-b from-og-forest to-og-forest-deep shadow-[2px_0_16px_rgba(0,0,0,0.18)] p-5 gap-1 z-50 fixed left-0 top-0 bottom-0">
      {/* Brand */}
      <div className="text-white font-extrabold text-base px-2.5 pb-5">
        On-Ground.ai
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
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-og transition-colors duration-150 group
                  ${isActive ? 'bg-white/5' : 'hover:bg-white/[0.06]'}
                `}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                  ${isActive
                    ? 'bg-gradient-to-br from-og-green to-og-green-light shadow-[0_2px_8px_rgba(29,158,117,0.4)]'
                    : 'bg-white/[0.08]'
                  }
                `}>
                  <Icon size={17} className={isActive ? 'text-white' : 'text-og-green-light/70'} />
                </span>
                <span className={`text-sm font-semibold flex-1 text-left
                  ${isActive ? 'text-white font-bold' : 'text-[#a9c4ba]'}
                `}>
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
                <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                  {PLAN_SUB_ITEMS.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeView === 'plan' && planTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handlePlanSubClick(sub.id)}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors
                          ${isSubActive ? 'text-white font-bold bg-white/5' : 'text-[#a9c4ba]/80 hover:text-white hover:bg-white/[0.04]'}
                        `}
                      >
                        <SubIcon size={14} />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
