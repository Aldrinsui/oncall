import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/shell/Sidebar';
import Topbar from './components/shell/Topbar';
import MobileNav from './components/shell/MobileNav';
import NotificationsDrawer from './components/modals/NotificationsDrawer';
import SettingsModal from './components/modals/SettingsModal';
import AvatarModal from './components/modals/AvatarModal';
import OgScoreModal from './components/modals/OgScoreModal';
import LeadsModal from './components/modals/LeadsModal';
import Dashboard from './components/dashboard/Dashboard';

function AppContent() {
  const {
    activeView,
    planTab,
    sidebarCollapsed,
    toastMessage,
    setActiveView,
  } = useApp();

  return (
    <div className="flex min-h-screen w-full bg-og-gray">
      {/* Desktop Sidebar (Fixed 224px or 56px when collapsed) */}
      <Sidebar />

      {/* Main Container — with dynamic left padding to match sidebar state */}
      <div
        className={`flex-1 flex flex-col ${
          sidebarCollapsed ? 'md:pl-14' : 'md:pl-56'
        } pb-20 md:pb-6 transition-all duration-200 min-w-0`}
      >
        <Topbar />

        <main className="flex-1 p-3.5 sm:p-5 md:p-6 max-w-7xl w-full mx-auto">
          {activeView === 'dashboard' ? (
            <Dashboard />
          ) : (
            /* Views to be completed in upcoming phases */
            <div className="bg-white rounded-card shadow-sm border border-og-gray-border p-6 md:p-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-og-gray-border gap-4">
                <div>
                  <span className="text-xs uppercase tracking-wider font-extrabold text-og-green">
                    Navigation Destination
                  </span>
                  <h1 className="text-2xl font-bold text-[#1c1c1e] mt-1 capitalize">
                    {activeView === 'plan'
                      ? `Plan · ${
                          planTab === 'outgoing'
                            ? 'Calls to make'
                            : planTab === 'incoming'
                            ? 'Incoming'
                            : planTab === 'recent'
                            ? 'Recent'
                            : 'Practise a call'
                        }`
                      : activeView}
                  </h1>
                  <p className="text-xs text-og-gray-text mt-1">
                    This section will be delivered in the upcoming phases.
                  </p>
                </div>

                {/* View Switcher Controls for Review */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-og-gray-text">Quick View Switch:</span>
                  {(['dashboard', 'plan', 'calendar', 'pulse'] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => setActiveView(view)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        activeView === view
                          ? 'bg-og-forest text-white shadow-sm'
                          : 'bg-og-gray text-[#1c1c1e] hover:bg-gray-200'
                      }`}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Status Box */}
              <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-og-green-bg/50 to-emerald-50/20 border border-og-green/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-og-green/15 text-og-green flex items-center justify-center font-bold text-lg">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0f6e56]">
                      Phase 3: Dashboard is fully implemented and live!
                    </h3>
                    <p className="text-xs text-[#0f6e56]/80 mt-0.5">
                      Switch back to <strong>Dashboard</strong> to review the KPI cards, progress bar, live queue, earnings, interactive tasks, and 7-day performance charts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Navigation bar at bottom */}
        <MobileNav />

        {/* Modals & Overlays */}
        <NotificationsDrawer />
        <SettingsModal />
        <AvatarModal />
        <OgScoreModal />
        <LeadsModal />

        {/* Global Toast Notification */}
        {toastMessage && (
          <div
            className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-og-forest text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-og-green/30 animate-fade-in"
            role="status"
            aria-live="polite"
          >
            <span className="w-2 h-2 rounded-full bg-og-green-light animate-pulse-dot" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
