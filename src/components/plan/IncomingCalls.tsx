import { useApp } from '../../context/AppContext';
import { PhoneOutgoing, Clock, AlertTriangle } from 'lucide-react';
import { INCOMING_CALLS } from '../../data/mockData';
import type { IncomingCall } from '../../types';

export default function IncomingCalls() {
  const { startCall } = useApp();

  const handleCallBack = (call: IncomingCall) => {
    // Pass the actual incoming caller identity to the unified calling engine
    startCall({
      id: call.id,
      name: call.name,
      initials: call.initials,
      phone: call.phone,
      avatarBg: '#fdecec',
      avatarColor: '#c94040',
      intent: call.intent,
      value: call.valueAtStake,
      personaChallenge: `Customer called regarding "${call.intent}". Value at stake: ${call.valueAtStake}. Explain resolution quickly.`,
    });
  };

  const totalValueAtStake = '₹77,390';

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-og-gray-border gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-og-red animate-pulse-dot" />
            <h3 className="text-sm font-bold text-[#1c1c1e]">Missed Inbound & Callbacks</h3>
          </div>
          <p className="text-xs text-og-gray-text mt-0.5">
            Recover high-intent inbound inquiries before competitors respond
          </p>
        </div>

        <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <AlertTriangle size={15} className="text-og-red" />
          <div className="text-xs">
            <span className="text-red-800 font-semibold">Total Value at Stake: </span>
            <span className="font-black text-og-red">{totalValueAtStake}</span>
          </div>
        </div>
      </div>

      {/* Missed Calls Table / Cards */}
      <div className="space-y-3">
        {INCOMING_CALLS.map((call) => (
          <div
            key={call.id}
            className="p-4 rounded-xl border border-og-gray-border bg-white hover:border-gray-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            {/* Left: Caller info & missed badge */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-red-50 text-og-red border border-red-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {call.initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-[#1c1c1e]">{call.name}</h4>
                  <span className="text-[11px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                    {call.missedCount > 1 ? `${call.missedCount} Missed Calls` : '1 Missed Call'}
                  </span>
                  <span className="text-[11px] text-og-gray-text flex items-center gap-1">
                    <Clock size={12} />
                    {call.time}
                  </span>
                </div>

                <p className="text-xs text-og-gray-text mt-1">{call.intent}</p>
                <div className="text-[11px] text-gray-500 mt-0.5">{call.phone}</div>
              </div>
            </div>

            {/* Right: Value at stake + Call Back button */}
            <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-og-gray-border">
              <div className="text-left sm:text-right">
                <div className="text-sm font-black text-og-red">{call.valueAtStake}</div>
                <div className="text-[10px] text-og-gray-text font-semibold uppercase tracking-wider">
                  Value at stake
                </div>
              </div>

              <button
                onClick={() => handleCallBack(call)}
                className="px-4 py-2 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                aria-label={`Call back ${call.name}`}
              >
                <PhoneOutgoing size={14} />
                <span>Call Back</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
