import { Coins, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';
import { USER } from '../../data/mockData';
import { useApp } from '../../context/AppContext';

export default function EarningsCard() {
  const { showToast } = useApp();

  const baseEarnings = 3400;
  const bonusEarnings = 1800;
  const nextMilestone = 6000;
  const milestoneProgress = Math.round((USER.earnings / nextMilestone) * 100);

  return (
    <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-50 text-og-amber">
              <Coins size={16} />
            </span>
            <h3 className="text-sm font-bold text-[#1c1c1e]">Shift Earnings & Incentives</h3>
          </div>
          <span className="text-xs bg-og-green-bg text-og-forest font-bold px-2 py-0.5 rounded-full">
            Active Tier 2
          </span>
        </div>

        {/* Current Total */}
        <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-4 rounded-xl border border-amber-200/50 mb-3.5">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
            Total Earned This Month
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-[#854f0b]">
              ₹{USER.earnings.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-og-green flex items-center gap-0.5">
              <TrendingUp size={13} />
              +₹850 today
            </span>
          </div>

          {/* Breakdown Pills */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-amber-200/60 text-xs">
            <div>
              <div className="text-[10px] text-amber-800/80">Base Calls Incentive</div>
              <div className="font-bold text-[#1c1c1e]">₹{baseEarnings.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-[10px] text-amber-800/80">Conversion Bonuses</div>
              <div className="font-bold text-[#1c1c1e]">₹{bonusEarnings.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        {/* Next Tier Milestone */}
        <div className="p-3 rounded-xl border border-og-gray-border bg-og-gray/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-og-gray-text">Next Tier: ₹{nextMilestone.toLocaleString('en-IN')}</span>
            <span className="font-bold text-og-forest">{milestoneProgress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${milestoneProgress}%` }}
            />
          </div>
          <div className="text-[11px] text-og-gray-text">
            Unlock additional ₹1,000 bonus at 20 conversions.
          </div>
        </div>
      </div>

      <button
        onClick={() => showToast('[Demo Simulation] Shift commission ledger: Base ₹3,400 + Bonuses ₹1,800 = ₹5,200')}
        className="mt-3.5 w-full py-2 bg-og-gray hover:bg-gray-200 text-og-forest rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
      >
        <span>View Incentive Breakdown</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
