import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, Settings, LogOut, User } from 'lucide-react';
import { USER, NOTIFICATIONS } from '../../data/mockData';

export default function Topbar() {
  const { setNotificationsOpen, notificationsOpen } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const unreadCount = NOTIFICATIONS.filter(n => n.needsAction).length;

  return (
    <header className="h-14 bg-og-forest/[0.97] flex items-center justify-between px-4 flex-shrink-0 relative z-40 gap-2">
      {/* Left: brand (visible on mobile where sidebar is hidden) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-og-green flex items-center justify-center text-white font-extrabold text-xs">
          OG
        </div>
        <span className="text-white font-extrabold text-sm">On-Ground.ai</span>
      </div>

      {/* Spacer on desktop */}
      <div className="hidden md:block" />

      {/* Right side */}
      <div className="flex items-center gap-1.5 relative">
        {/* Notification bell */}
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Notifications"
        >
          <Bell size={19} className="text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-og-gold border-2 border-white shadow-[0_0_0_2px_rgba(226,35,61,0.35)] animate-pulse-dot" />
          )}
        </button>

        {/* OG Score + Rank pill */}
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-100/20 to-amber-200/10 rounded-full py-0.5 px-2.5">
          <span className="og-ring sm" style={{ '--pct': USER.ogScore, '--ring-color': '#1d9e75' } as React.CSSProperties}>
            <span className="og-ring-val">{USER.ogScore}</span>
          </span>
          <span className="text-xs font-bold text-amber-200 tracking-wide">
            ⭐#{USER.rank}
          </span>
        </div>

        {/* User badge */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-og-green to-og-green-light flex items-center justify-center text-white text-sm font-bold shadow-md hover:shadow-lg transition-shadow"
          >
            {USER.emoji}
          </button>

          {/* User dropdown */}
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-12 w-64 bg-white rounded-card shadow-xl border border-og-gray-border z-50 animate-fade-in overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-og-gray-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-og-green to-og-green-light flex items-center justify-center text-lg">
                    {USER.emoji}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{USER.name}</div>
                    <div className="text-xs text-og-gray-text">{USER.store} · {USER.brand}</div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-og-gray transition-colors">
                    <User size={16} className="text-og-gray-text" />
                    Avatar
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-og-gray transition-colors">
                    <Settings size={16} className="text-og-gray-text" />
                    Settings
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-og-red hover:bg-og-red-bg transition-colors">
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
