import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Phone, Calendar, MessageCircle } from 'lucide-react';
import type { View } from '../../types';

const MOBILE_NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: Phone },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'pulse', label: 'Pulse', icon: MessageCircle },
];

export default function MobileNav() {
  const { activeView, setActiveView } = useApp();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-og-forest to-og-forest-deep flex items-center justify-around px-2 z-50 border-t border-white/10 safe-area-pb">
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors
              ${isActive ? 'text-white' : 'text-[#a9c4ba]/70'}
            `}
          >
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center
              ${isActive
                ? 'bg-gradient-to-br from-og-green to-og-green-light shadow-[0_2px_8px_rgba(29,158,117,0.4)]'
                : ''
              }
            `}>
              <Icon size={18} />
            </span>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
