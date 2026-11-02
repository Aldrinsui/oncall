import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, Settings, LogOut, User } from 'lucide-react';
import { USER, NOTIFICATIONS } from '../../data/mockData';

export default function Topbar() {
  const {
    setNotificationsOpen,
    notificationsOpen,
    setSettingsOpen,
    setAvatarModalOpen,
    currentAvatar,
    showToast,
  } = useApp();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const unreadCount = NOTIFICATIONS.filter((n) => n.needsAction).length;

  const handleAvatarClick = () => {
    setDropdownOpen(false);
    setAvatarModalOpen(true);
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    setSettingsOpen(true);
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    showToast('Shift session active — Logout simulated for safety');
  };

  return (
    <header className="h-14 bg-og-forest/[0.97] flex items-center justify-between px-4 flex-shrink-0 relative z-30 gap-2 border-b border-white/5">
      {/* Left: brand (visible on mobile where sidebar is hidden) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-og-green flex items-center justify-center text-white font-extrabold text-xs">
          OG
        </div>
        <span className="text-white font-extrabold text-sm tracking-tight">On-Ground.ai</span>
      </div>

      {/* Spacer on desktop */}
      <div className="hidden md:block" />

      {/* Right side */}
      <div className="flex items-center gap-2 relative">
        {/* Notification bell */}
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Notifications & Activity"
          aria-label={`Notifications: ${unreadCount} action items`}
        >
          <Bell size={19} className="text-white" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-og-gold border-2 border-white shadow-[0_0_0_2px_rgba(226,35,61,0.35)] animate-pulse-dot"
              aria-hidden="true"
            />
          )}
        </button>

        {/* OG Score + Rank pill — native keyboard accessible button */}
        <button
          type="button"
          onClick={handleAvatarClick}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-100/20 to-amber-200/10 rounded-full py-0.5 px-2.5 cursor-pointer hover:bg-white/15 transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-300"
          title={`OG Score: ${USER.ogScore} | Rank: #${USER.rank} in ${USER.rankLocation}`}
          aria-label={`OG Score ${USER.ogScore}, Rank number ${USER.rank} in ${USER.rankLocation}. Click to view details.`}
        >
          <span
            className="og-ring sm"
            style={{ '--pct': USER.ogScore, '--ring-color': '#1d9e75' } as React.CSSProperties}
          >
            <span className="og-ring-val">{USER.ogScore}</span>
          </span>
          <span className="text-xs font-bold text-amber-200 tracking-wide">
            ⭐#{USER.rank}
          </span>
        </button>

        {/* User badge */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md hover:shadow-lg transition-all ring-2 ring-white/20 hover:ring-white/40"
            style={{
              backgroundColor: currentAvatar.ringColor,
              boxShadow: `0 2px 6px ${currentAvatar.ringColor}60`,
            }}
            title={`Selling Persona: ${currentAvatar.name} (${currentAvatar.title})`}
            aria-label={`User profile menu. Current persona: ${currentAvatar.name}`}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {currentAvatar.emoji}
          </button>

          {/* User dropdown */}
          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
                aria-hidden="true"
              />
              <div
                className="absolute right-0 top-12 w-64 bg-white rounded-card shadow-xl border border-og-gray-border z-50 animate-fade-in overflow-hidden"
                role="menu"
                aria-label="User settings dropdown"
              >
                {/* Header */}
                <div className="p-4 border-b border-og-gray-border flex items-center gap-3 bg-gradient-to-br from-gray-50 to-white">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ring-2"
                    style={{
                      backgroundColor: currentAvatar.bgLight,
                      borderColor: currentAvatar.ringColor,
                    }}
                  >
                    {currentAvatar.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[#1c1c1e] truncate">{USER.name}</div>
                    <div className="text-xs text-og-gray-text">{USER.store} · {USER.brand}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span
                        className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-sm"
                        style={{
                          backgroundColor: `${currentAvatar.ringColor}20`,
                          color: currentAvatar.ringColor,
                        }}
                      >
                        {currentAvatar.name}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {currentAvatar.badge}
                      </span>
                    </div>
                  </div>
                </div>


                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={handleAvatarClick}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold hover:bg-og-gray transition-colors text-left text-[#1c1c1e]"
                  >
                    <User size={16} className="text-og-green" />
                    <span>Agent Avatar & Score</span>
                  </button>
                  <button
                    onClick={handleSettingsClick}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold hover:bg-og-gray transition-colors text-left text-[#1c1c1e]"
                  >
                    <Settings size={16} className="text-og-gray-text" />
                    <span>Store & Audio Settings</span>
                  </button>
                  <button
                    onClick={handleLogoutClick}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-og-red hover:bg-og-red-bg transition-colors text-left"
                  >
                    <LogOut size={16} />
                    <span>End Shift / Logout</span>
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
