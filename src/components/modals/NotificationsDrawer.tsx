import { useApp } from '../../context/AppContext';
import { NOTIFICATIONS } from '../../data/mockData';
import { X, CheckCircle2, PhoneCall, AlertCircle } from 'lucide-react';

export default function NotificationsDrawer() {
  const { notificationsOpen, setNotificationsOpen, setActiveView, setActiveChannelId } = useApp();

  if (!notificationsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={() => setNotificationsOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 bg-og-forest text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">Notifications & Activity</span>
              <span className="text-xs bg-og-gold text-og-forest-deep px-2 py-0.5 rounded-full font-bold">
                {NOTIFICATIONS.filter(n => n.needsAction).length} action items
              </span>
            </div>
            <button
              onClick={() => setNotificationsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
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
                <div className="text-2xl flex-shrink-0">{item.icon}</div>
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
                      onClick={() => {
                        setNotificationsOpen(false);
                        if (item.title.includes('#callcentre-team')) {
                          setActiveView('pulse');
                          setActiveChannelId('callcentre-team');
                        } else if (item.title.includes('Call Back')) {
                          setActiveView('plan');
                        }
                      }}
                      className="text-xs font-bold text-og-green hover:text-og-forest flex items-center gap-1.5"
                    >
                      <span>{item.cta}</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-og-gray-border bg-og-gray text-center">
            <span className="text-xs text-og-gray-text">Shift notifications synced live with Koramangala Store</span>
          </div>
        </div>
      </div>
    </div>
  );
}
