import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Phone,
  Calendar,
  MessageCircle,
  PhoneOutgoing,
  PhoneIncoming,
  History,
  PhoneCall,
  X,
  ChevronRight,
} from 'lucide-react';
import type { View, PlanTab } from '../../types';
import { LEADS } from '../../data/mockData';

const MOBILE_NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: Phone },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'pulse', label: 'Pulse', icon: MessageCircle },
];

const PLAN_SUB_ITEMS: { id: PlanTab; label: string; icon: typeof PhoneOutgoing; desc: string }[] = [
  { id: 'outgoing', label: 'Calls to make', icon: PhoneOutgoing, desc: 'Ranked leads queue' },
  { id: 'incoming', label: 'Incoming calls', icon: PhoneIncoming, desc: 'Missed & callbacks' },
  { id: 'recent', label: 'Recent calls', icon: History, desc: 'Logs & SOP reviews' },
  { id: 'practise', label: 'Practise a call', icon: PhoneCall, desc: 'Interactive AI simulation' },
];

export default function MobileNav() {
  const {
    activeView,
    setActiveView,
    planTab,
    setPlanTab,
    startCall,
    startRoleplay,
  } = useApp();
  const [mobilePlanSheetOpen, setMobilePlanSheetOpen] = useState(false);

  // Close sheet on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobilePlanSheetOpen) {
        setMobilePlanSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobilePlanSheetOpen]);

  const handleNavClick = (id: View) => {
    if (id === 'plan') {
      setActiveView('plan');
      setMobilePlanSheetOpen(true);
    } else {
      setActiveView(id);
      setMobilePlanSheetOpen(false);
    }
  };

  const handleSubTabSelect = (tab: PlanTab) => {
    setActiveView('plan');
    setPlanTab(tab);
    setMobilePlanSheetOpen(false);

    if (tab === 'practise') {
      const lead = LEADS[0];
      startRoleplay({
        id: lead.id,
        name: `${lead.name} (AI Customer Roleplay)`,
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

  return (
    <>
      {/* Mobile Plan Sub-navigation Bottom Sheet */}
      {mobilePlanSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Plan sub navigation">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobilePlanSheetOpen(false)}
          />

          {/* Bottom Sheet */}
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 border-t border-og-gray-border animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3">
              <div>
                <span className="text-xs font-bold text-og-green uppercase tracking-wider">Plan Navigation</span>
                <h3 className="text-base font-bold text-[#1c1c1e]">Calling Plan Sections</h3>
              </div>
              <button
                onClick={() => setMobilePlanSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-og-gray flex items-center justify-center text-og-gray-text hover:text-[#1c1c1e]"
                aria-label="Close plan menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {PLAN_SUB_ITEMS.map((item) => {
                const Icon = item.icon;
                const isSelected = activeView === 'plan' && planTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabSelect(item.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-og-green-bg border-og-green text-og-forest'
                        : 'bg-og-gray/50 border-og-gray-border hover:bg-og-gray text-[#1c1c1e]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-og-green text-white' : 'bg-white text-og-forest border border-og-gray-border'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[11px] text-og-gray-text">{item.desc}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className={isSelected ? 'text-og-green' : 'text-og-gray-text'} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-og-forest to-og-forest-deep flex items-center justify-around px-2 z-40 border-t border-white/10"
        aria-label="Mobile Navigation"
      >
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              aria-label={item.label}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors relative ${
                isActive ? 'text-white' : 'text-[#a9c4ba]/70'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive
                    ? 'bg-gradient-to-br from-og-green to-og-green-light shadow-[0_2px_8px_rgba(29,158,117,0.4)] text-white'
                    : ''
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="text-[10px] font-semibold flex items-center gap-0.5">
                {item.label}
                {item.id === 'plan' && (
                  <span className="text-[8px] opacity-70">▾</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
