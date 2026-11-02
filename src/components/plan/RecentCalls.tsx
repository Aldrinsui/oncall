import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Award,
  ChevronRight,
  FileCheck,
} from 'lucide-react';
import type { RecentCall } from '../../types';
import CallSopReviewModal from '../modals/CallSopReviewModal';

export default function RecentCalls() {
  const { recentCalls } = useApp();
  const [selectedCall, setSelectedCall] = useState<RecentCall | null>(null);

  const getDirectionIcon = (direction: RecentCall['direction']) => {
    switch (direction) {
      case 'inbound':
        return <PhoneIncoming size={14} className="text-og-green" />;
      case 'outbound':
        return <PhoneOutgoing size={14} className="text-og-blue" />;
      case 'missed':
        return <PhoneMissed size={14} className="text-og-red" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-og-gray-border gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#1c1c1e]">Call History & Quality Reviews</h3>
          <p className="text-xs text-og-gray-text">
            Tap any call record to review the AI quality score and transcript evidence
          </p>
        </div>

        <span className="text-xs font-semibold text-og-gray-text self-start sm:self-auto">
          {recentCalls.length} Recorded Calls
        </span>
      </div>

      {/* Calls List */}
      <div className="space-y-2.5">
        {recentCalls.map((call) => (
          <div
            key={call.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedCall(call)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCall(call);
              }
            }}
            className="p-3.5 rounded-xl border border-og-gray-border bg-white hover:border-og-green/40 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group focus:outline-hidden focus:ring-2 focus:ring-og-green"
            aria-label={`Call record: ${call.name}, outcome: ${call.outcome}. Press Enter to view quality review.`}
          >
            {/* Left: Direction + Caller + Time */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                style={{ backgroundColor: `${call.outcomeColor}15`, color: call.outcomeColor }}
              >
                {call.initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1c1c1e]">{call.name}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-og-gray-text capitalize">
                    {getDirectionIcon(call.direction)}
                    <span>{call.direction}</span>
                  </span>
                </div>

                <div className="text-xs text-og-gray-text mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {call.time}
                  </span>
                  <span>•</span>
                  <span>Duration: <strong>{call.duration}</strong></span>
                  {call.value && (
                    <>
                      <span>•</span>
                      <span className="font-bold text-og-forest">{call.value}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Outcome badge + SOP Score + Action */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-og-gray-border">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full text-center"
                style={{ backgroundColor: `${call.outcomeColor}15`, color: call.outcomeColor }}
              >
                {call.outcome}
              </span>

              {call.sopScore !== undefined && call.sopScore > 0 && (
                <div className="flex items-center gap-1 bg-emerald-50 text-og-green font-bold text-xs px-2.5 py-1 rounded-full">
                  <Award size={13} />
                  <span>{call.sopScore}% SOP</span>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCall(call);
                }}
                className="text-xs font-bold text-og-green group-hover:text-og-forest flex items-center gap-1 pl-1"
                aria-label={`Review SOP for call with ${call.name}`}
              >
                <span>Review</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for viewing the selected call review */}
      <CallSopReviewModal call={selectedCall} onClose={() => setSelectedCall(null)} />
    </div>
  );
}
