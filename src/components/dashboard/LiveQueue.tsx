import { useApp } from '../../context/AppContext';
import { PhoneCall, AlertCircle, Clock, UserCheck } from 'lucide-react';
import { CALL_QUEUE } from '../../data/mockData';

export default function LiveQueue() {
  const { setActiveView, setPlanTab, setCallState, setCallingLead, showToast } = useApp();

  const handleCallQueueItem = (name: string) => {
    setActiveView('plan');
    setPlanTab('incoming');
    setCallState('ringing');
    setCallingLead('l1'); // Mukunda / Priya queue simulation
    showToast(`Connecting to ${name} in Live Queue...`);
  };

  return (
    <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-og-red animate-pulse-dot" />
          <h3 className="text-sm font-bold text-[#1c1c1e]">Who is Waiting Now</h3>
          <span className="text-xs bg-og-red-bg text-og-red font-bold px-2 py-0.5 rounded-full">
            {CALL_QUEUE.length} in queue
          </span>
        </div>
        <span className="text-xs text-og-gray-text hidden sm:inline">Live Inbound Routing</span>
      </div>

      <div className="space-y-2.5">
        {CALL_QUEUE.map((caller) => (
          <div
            key={caller.name}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-og-gray-border bg-og-gray/40 hover:bg-og-gray transition-colors gap-3"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                  caller.waitLevel === 'hi'
                    ? 'bg-red-100 text-og-red border border-red-200'
                    : 'bg-amber-100 text-og-amber border border-amber-200'
                }`}
              >
                {caller.name.split(' ').map((n) => n[0]).join('')}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1c1c1e]">{caller.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      caller.waitLevel === 'hi'
                        ? 'bg-red-50 text-og-red'
                        : 'bg-amber-50 text-og-amber'
                    }`}
                  >
                    Wait: {caller.wait}
                  </span>
                </div>
                <p className="text-xs text-og-gray-text mt-0.5">{caller.intent}</p>
              </div>
            </div>

            <button
              onClick={() => handleCallQueueItem(caller.name)}
              className="px-4 py-2 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs flex-shrink-0"
              aria-label={`Call ${caller.name} now`}
            >
              <PhoneCall size={14} />
              <span>Call Now</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
