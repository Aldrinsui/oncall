import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Video,
  Share2,
  Copy,
  Check,
  X,
  Users,
} from 'lucide-react';
import { CALENDAR_INVITES } from '../../data/mockData';
import type { CalendarInvite } from '../../types';

export default function Calendar() {
  const { setActiveView, setActiveChannelId, setPulseView, showToast } = useApp();

  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 10 is November (0-indexed)
  const [selectedDay, setSelectedDay] = useState(3); // Default to Nov 3 (Today in mock)
  const [shareModalInvite, setShareModalInvite] = useState<CalendarInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Align to Monday = 0
  };

  const totalDays = daysInMonth(currentYear, currentMonth);
  const offset = firstDayOfWeek(currentYear, currentMonth);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(10); // November 2026
    setSelectedDay(3);
  };

  // Filter events for selected day (in November 2026)
  const selectedEvents = currentMonth === 10 && currentYear === 2026
    ? CALENDAR_INVITES.filter((inv) => inv.day === selectedDay)
    : [];

  const handleJoinSession = (invite: CalendarInvite) => {
    if (invite.meta.includes('#callcentre-team')) {
      setActiveView('pulse');
      setPulseView('channel');
      setActiveChannelId('callcentre-team');
      showToast('Opening #callcentre-team coaching channel...');
    } else {
      showToast(`Joined session: ${invite.title}`);
    }
  };

  const handleCopyLink = () => {
    setCopied(true);
    showToast('Meeting invite link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Calendar Hero Header */}
      <div className="bg-gradient-to-r from-og-night-mid to-[#252849] text-white p-5 rounded-card shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-og-green-light uppercase tracking-wider">
            Shift Schedule & Events
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">Calendar</h2>
          <p className="text-xs text-gray-300 mt-0.5">
            SOP coaching sessions, team huddles & scheduled customer callbacks
          </p>
        </div>

        {/* Month Switcher & Today Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white/10 p-1.5 rounded-xl backdrop-blur-xs">
          <button
            onClick={handleToday}
            className="px-3 py-1 bg-og-green hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Today
          </button>
          <div className="h-4 w-[1px] bg-white/20 mx-1" />
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-white min-w-[120px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Two-Column View: Month Grid (Left) + Selected Day Agenda (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Month Grid */}
        <div className="lg:col-span-2 bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-og-gray-text pb-3 border-b border-og-gray-border mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Blank offset days */}
            {Array.from({ length: offset }).map((_, idx) => (
              <div key={`offset-${idx}`} className="h-16 sm:h-20 rounded-xl bg-gray-50/50" />
            ))}

            {/* Days in current month */}
            {Array.from({ length: totalDays }).map((_, idx) => {
              const day = idx + 1;
              const isToday = day === 3 && currentMonth === 10 && currentYear === 2026;
              const isSelected = day === selectedDay;
              const hasEvents = currentMonth === 10 && currentYear === 2026 && CALENDAR_INVITES.some((inv) => inv.day === day);

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-2 border-og-green bg-emerald-50/50 shadow-xs'
                      : 'border-og-gray-border bg-white hover:border-gray-300 hover:bg-gray-50/70'
                  }`}
                  aria-label={`Day ${day} ${monthNames[currentMonth]}${hasEvents ? ' (has events)' : ''}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-og-forest text-white'
                          : isSelected
                          ? 'text-og-green font-black'
                          : 'text-[#1c1c1e]'
                      }`}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span className="hidden sm:inline text-[9px] font-bold text-og-green uppercase">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Event Dots */}
                  <div className="flex items-center gap-1 mt-auto">
                    {hasEvents && (
                      <span className="w-2 h-2 rounded-full bg-og-green shadow-xs animate-pulse-dot" />
                    )}
                    {day === 3 && (
                      <span className="w-2 h-2 rounded-full bg-og-gold shadow-xs" />
                    )}
                    {day === 14 && (
                      <span className="w-2 h-2 rounded-full bg-og-blue shadow-xs" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Day Agenda */}
        <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3.5">
            <div>
              <span className="text-[10px] font-bold text-og-green uppercase tracking-wider">
                Day Schedule
              </span>
              <h3 className="text-base font-bold text-[#1c1c1e]">
                {monthNames[currentMonth]} {selectedDay}, {currentYear}
              </h3>
            </div>
            <span className="text-xs bg-og-gray px-2.5 py-0.5 rounded-full font-bold text-og-gray-text">
              {selectedEvents.length} Sessions
            </span>
          </div>

          {/* Agenda Items List */}
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px]">
            {selectedEvents.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-og-gray-text space-y-2">
                <CalendarIcon size={32} className="text-gray-300" />
                <p className="text-xs font-semibold">No coaching sessions scheduled on this day.</p>
                <p className="text-[11px] text-gray-400">Regular shift tele-calling schedule is active.</p>
              </div>
            ) : (
              selectedEvents.map((invite, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-og-gray-border bg-og-gray/30 hover:bg-og-gray/60 transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-og-forest flex items-center gap-1.5 bg-emerald-50 text-og-green px-2 py-0.5 rounded-md">
                      <Clock size={12} />
                      {invite.time}
                    </span>
                    <button
                      onClick={() => setShareModalInvite(invite)}
                      className="p-1 rounded-md text-og-gray-text hover:text-[#1c1c1e] hover:bg-white transition-colors"
                      title="Share invite link"
                      aria-label="Share session invite"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-[#1c1c1e]">{invite.title}</h4>
                    <p className="text-xs text-og-gray-text mt-0.5 leading-snug">{invite.meta}</p>
                  </div>

                  <div className="pt-2 border-t border-og-gray-border flex items-center justify-between">
                    <button
                      onClick={() => handleJoinSession(invite)}
                      className="w-full py-1.5 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Video size={13} />
                      <span>Join / Open Session</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Share Invite Modal */}
      {shareModalInvite && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Share meeting invitation"
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setShareModalInvite(null)}
              aria-hidden="true"
            />

            <div className="relative w-full max-w-md bg-white rounded-sheet shadow-2xl p-5 border border-og-gray-border space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-og-gray-border">
                <div>
                  <span className="text-[10px] font-bold text-og-green uppercase tracking-wider">
                    Meeting Invite
                  </span>
                  <h3 className="text-base font-bold text-[#1c1c1e]">Share Session Link</h3>
                </div>
                <button
                  onClick={() => setShareModalInvite(null)}
                  className="w-8 h-8 rounded-full bg-og-gray flex items-center justify-center text-og-gray-text hover:text-[#1c1c1e]"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 bg-og-gray/60 rounded-xl space-y-1 text-xs">
                <div className="font-bold text-[#1c1c1e]">{shareModalInvite.title}</div>
                <div className="text-og-gray-text">{shareModalInvite.time} • {shareModalInvite.meta}</div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-og-gray rounded-xl border border-og-gray-border text-xs">
                <input
                  type="text"
                  readOnly
                  value={`https://on-ground.ai/meet/session-${shareModalInvite.day}-nov`}
                  className="flex-1 bg-transparent border-none text-[#1c1c1e] focus:outline-hidden font-mono text-[11px]"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1 bg-og-green hover:bg-og-forest text-white rounded-lg font-bold flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
