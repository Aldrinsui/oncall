import { useState } from 'react';
import type { View, PlanTab, PulseView } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [planTab, setPlanTab] = useState<PlanTab>('outgoing');
  const [pulseView, setPulseView] = useState<PulseView>('home');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [leadsModalOpen, setLeadsModalOpen] = useState(false);
  const [leadsModalPage, setLeadsModalPage] = useState(0);

  return (
    <div className="flex w-full min-h-screen bg-og-gray">
      {/* Sidebar — Phase 2 */}
      <div className="w-56 bg-gradient-to-b from-og-forest to-og-forest-deep min-h-screen flex flex-col p-5 gap-1">
        <div className="text-white font-extrabold text-base px-2.5 pb-4">On-Ground.ai</div>
        <div className="text-og-green-light text-sm px-2.5 py-2">Dashboard</div>
        <div className="text-og-green-light text-sm px-2.5 py-2">Plan</div>
        <div className="text-og-green-light text-sm px-2.5 py-2">Calendar</div>
        <div className="text-og-green-light text-sm px-2.5 py-2">Pulse</div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar — Phase 2 */}
        <div className="h-14 bg-og-forest/95 flex items-center justify-between px-4">
          <span className="text-white font-bold text-lg capitalize">{activeView}</span>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">🦸‍♂️ Arvind Rajan</span>
          </div>
        </div>

        {/* Content placeholder */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-card p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Phase 1 Complete ✓</h2>
            <p className="text-og-gray-text">
              Project scaffolded with React + TypeScript + Tailwind CSS.
              <br />
              Types, mock data, and design tokens are ready.
              <br />
              Active view: <strong className="text-og-green">{activeView}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
