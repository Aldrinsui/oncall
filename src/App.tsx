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
import Planner from './components/plan/Planner';
import Calendar from './components/calendar/Calendar';
import Pulse from './components/pulse/Pulse';
import ActiveCallView from './components/calling/ActiveCallView';

function AppContent() {
  const {
    activeView,
    sidebarCollapsed,
    toastMessage,
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
          {/* Active Calling Engine Layer — Rendered on top when ringing or active */}
          <ActiveCallView />

          {/* Primary View Router */}
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'plan' && <Planner />}
          {activeView === 'calendar' && <Calendar />}
          {activeView === 'pulse' && <Pulse />}
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
