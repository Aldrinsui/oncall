import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { NOTIFICATIONS } from '../../data/mockData';
import { X } from 'lucide-react';

export default function NotificationsDrawer() {
  const {
    notificationsOpen,
    setNotificationsOpen,
    setActiveView,
    setPlanTab,
    setPulseView,
    setActiveChannelId,
    showToast,
  } = useApp();

  // Escape key handler for dialog accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notificationsOpen) {
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notificationsOpen, setNotificationsOpen]);

  if (!notificationsOpen) return null;

  const handleCtaClick = (item: typeof NOTIFICATIONS[0]) => {
    setNotificationsOpen(false);

    if (item.title.includes('#callcentre-team') || item.cta.includes('#callcentre-team')) {
      setActiveView('pulse');
      setPulseView('channel');
      setActiveChannelId('callcentre-team');
      showToast('Navigated to #callcentre-team channel');
    } else if (item.cta.includes('Call Back') || item.title.includes('called 3 times')) {
      setActiveView('plan');
      setPlanTab('incoming');
      showToast('Navigated to Incoming / Missed calls queue');
    } else if (item.cta.includes('Open Coach')) {
      setActiveView('pulse');
      setPulseView('home');
      showToast('Navigated to Skill Coach in Pulse');
    } else if (item.cta.includes('View Score') || item.cta.includes('View Rank')) {
      setActiveView('dashboard');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications and activity drawer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={() => setNotificationsOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 bg-og-forest text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">Notifications & Activity</span>
              <span className="text-xs bg-og-gold text-og-forest-deep px-2 py-0.5 rounded-full font-bold">
                {NOTIFICATIONS.filter((n) => n.needsAction).length} action items
              </span>
            </div>
            <button
              onClick={() => setNotificationsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              aria-label="Close notifications drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-og-gray-border p-2">
            {NOTIFICATIONS.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-lg transition-colors flex gap-3 ${
                  item.needsAction ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-og-gray'
                }`}
              >
                <div className="text-2xl flex-shrink-0" aria-hidden="true">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-og-gray-text">{item.time}</span>
                    {item.needsAction && (
                      <span className="text-[11px] font-bold text-og-amber bg-og-amber-bg px-2 py-0.5 rounded-full">
                        Action Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[#1c1c1e] leading-snug mb-2">{item.title}</p>
                  {item.cta && (
                    <button
                      onClick={() => handleCtaClick(item)}
                      className="text-xs font-bold text-og-green hover:text-og-forest flex items-center gap-1.5"
                      aria-label={`${item.cta} for ${item.title}`}
                    >
                      <span>{item.cta}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer — accurate description without unverified live-sync claims */}
          <div className="p-3 border-t border-og-gray-border bg-og-gray text-center">
            <span className="text-xs text-og-gray-text">
              Shift notifications · Koramangala Store shift schedule
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
