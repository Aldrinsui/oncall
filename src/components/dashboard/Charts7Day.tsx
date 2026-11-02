import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
} from 'recharts';
import { BarChart3, TrendingUp, Phone, Clock } from 'lucide-react';
import { CHART_DATA } from '../../data/mockData';

export default function Charts7Day() {
  const [activeMetric, setActiveMetric] = useState<'calls' | 'talkTime' | 'conversions'>('calls');

  const metricConfig = {
    calls: {
      label: 'Calls Made',
      color: '#1d9e75',
      unit: 'calls',
      sub: 'Target: 18 calls/day',
    },
    talkTime: {
      label: 'Total Talk Time',
      color: '#185fa5',
      unit: 'min',
      sub: 'Target: 60 min/day',
    },
    conversions: {
      label: 'Closed Sales',
      color: '#c8860a',
      unit: 'sales',
      sub: 'Target: 4 conversions/day',
    },
  };

  const current = metricConfig[activeMetric];

  return (
    <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-og-gray-border mb-4 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-emerald-50 text-og-green">
            <BarChart3 size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#1c1c1e]">7-Day Performance Analytics</h3>
            <span className="text-[11px] text-og-gray-text">{current.sub}</span>
          </div>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1 bg-og-gray p-1 rounded-xl self-start sm:self-auto">
          {(['calls', 'talkTime', 'conversions'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                activeMetric === m
                  ? 'bg-white text-og-forest shadow-xs'
                  : 'text-og-gray-text hover:text-[#1c1c1e]'
              }`}
            >
              {m === 'talkTime' ? 'Talk Time' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-56 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f3" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: '#e5e5ea' }}
              tick={{ fill: '#8e8e93', fontSize: 11, fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8e8e93', fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2.5 rounded-xl shadow-lg border border-og-gray-border text-xs">
                      <div className="font-bold text-[#1c1c1e] mb-1">{label}</div>
                      <div className="flex items-center gap-1.5 font-semibold" style={{ color: current.color }}>
                        <span>{current.label}:</span>
                        <span className="font-black">{payload[0].value} {current.unit}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey={activeMetric}
              fill={current.color}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Highlights — Dynamically computed from dataset (P2 fix) */}
      <div className="grid grid-cols-3 gap-2 pt-3 mt-2 border-t border-og-gray-border text-center text-xs">
        <div>
          <span className="text-[10px] text-og-gray-text block">Weekly Calls</span>
          <span className="font-extrabold text-[#1c1c1e]">{CHART_DATA.reduce((acc, d) => acc + d.calls, 0)} calls</span>
        </div>
        <div>
          <span className="text-[10px] text-og-gray-text block">Avg Daily Talk</span>
          <span className="font-extrabold text-og-green">
            {(CHART_DATA.reduce((acc, d) => acc + d.talkTime, 0) / CHART_DATA.length).toFixed(1)} min
          </span>
        </div>
        <div>
          <span className="text-[10px] text-og-gray-text block">Total Conversions</span>
          <span className="font-extrabold text-amber-700">
            {CHART_DATA.reduce((acc, d) => acc + d.conversions, 0)} closed
          </span>
        </div>
      </div>
    </div>
  );
}
