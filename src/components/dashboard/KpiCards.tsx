import { useApp } from '../../context/AppContext';
import { Phone, Clock, TrendingUp, CheckCircle, Award } from 'lucide-react';
import { USER } from '../../data/mockData';

export default function KpiCards() {
  const { setOgScoreModalOpen } = useApp();

  const completedPct = Math.round((USER.callsCompleted / USER.callsTotal) * 100);

  return (
    <div className="space-y-4">
      {/* Shift Greeting & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-og-night-mid to-[#252849] p-5 rounded-card text-white shadow-md">
        <div>
          <div className="text-xs font-semibold text-og-green-light uppercase tracking-wider">
            Shift 10:00 AM – 7:00 PM · Retail Tele-Calling
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">
            Good afternoon 👋 {USER.name} · {USER.store}
          </h2>
          <p className="text-xs text-gray-300 mt-1">
            4 scheduled callbacks pending. Primary focus: Ortho GRID walk-out recovery.
          </p>
        </div>

        {/* Quick shift achievement pill */}
        <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-xs flex-shrink-0 self-start sm:self-auto">
          <Award size={18} className="text-og-gold" />
          <div>
            <div className="text-[11px] text-gray-300">Store Standing</div>
            <div className="text-xs font-bold text-white">Rank #{USER.rank} of 14 agents</div>
          </div>
        </div>
      </div>

      {/* KPI 3-Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1: Today's Calling Plan */}
        <div className="bg-white p-4 rounded-card border border-og-gray-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-semibold text-og-gray-text mb-2">
            <span>Today's Calling Plan</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-og-green">
              <Phone size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1c1c1e]">{USER.callsTotal}</span>
            <span className="text-xs font-bold text-og-green">Calls Target</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-og-gray-text mt-3 pt-2.5 border-t border-og-gray-border">
            <span>Avg Talk: <strong>4m 22s</strong></span>
            <span className="text-og-green font-semibold">84% Conversion Target</span>
          </div>
        </div>

        {/* Card 2: My Progress Bar */}
        <div className="bg-white p-4 rounded-card border border-og-gray-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-semibold text-og-gray-text mb-2">
            <span>My Shift Progress</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-og-blue">
              <CheckCircle size={16} />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#1c1c1e]">{USER.callsCompleted}</span>
              <span className="text-xs text-og-gray-text font-bold">/ {USER.callsTotal} calls</span>
            </div>
            <span className="text-sm font-black text-og-green">{completedPct}%</span>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full h-2.5 bg-og-gray rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-og-green to-og-green-light rounded-full transition-all duration-500"
              style={{ width: `${completedPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-og-gray-text mt-2 pt-1 border-t border-og-gray-border">
            <span>{USER.callsTotal - USER.callsCompleted} calls remaining</span>
            <span className="text-og-green font-bold">On Pace ✓</span>
          </div>
        </div>

        {/* Card 3: OG Score™ with Circular Ring */}
        <button
          type="button"
          onClick={() => setOgScoreModalOpen(true)}
          className="bg-white p-4 rounded-card border border-og-gray-border shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between group focus:outline-hidden focus:ring-2 focus:ring-og-green"
          aria-label="View OG Score performance breakdown"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-og-gray-text w-full mb-1">
            <span>OG Score™</span>
            <span className="text-[10px] text-og-green font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
              ▲ +13 pts
            </span>
          </div>

          <div className="flex items-center gap-3.5 my-1">
            <div className="og-ring lg flex-shrink-0" style={{ '--pct': USER.ogScore, '--ring-color': '#1d9e75' } as React.CSSProperties}>
              <span className="og-ring-val">{USER.ogScore}</span>
            </div>
            <div>
              <div className="text-xs font-bold text-og-forest">72nd Percentile</div>
              <div className="text-[11px] text-og-gray-text leading-tight mt-0.5">
                Calculated across 14 staff agents this period
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold text-og-green group-hover:underline pt-2 border-t border-og-gray-border w-full flex items-center justify-between">
            <span>View score breakdown</span>
            <span>→</span>
          </div>
        </button>
      </div>
    </div>
  );
}
