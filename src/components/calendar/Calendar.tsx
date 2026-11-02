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
  MessageSquare,
  Send,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { CALENDAR_INVITES } from '../../data/mockData';
import type { CalendarInvite } from '../../types';
import {
  CALENDAR_COLLABORATORS,
  generateSessionUrl,
  formatSessionDateTime,
  formatWhatsAppInvite,
  generateWhatsAppShareUrl,
  formatPulseInviteMessage,
  validateCollaboratorSelection,
  type Collaborator,
} from '../../services/calendarService';

export default function Calendar() {
  const { setActiveView, setActiveChannelId, setPulseView, showToast, sendPulseMessage } = useApp();

  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 10 is November (0-indexed)
  const [selectedDay, setSelectedDay] = useState(3); // Default to Nov 3 (Today in mock)
  const [shareModalInvite, setShareModalInvite] = useState<CalendarInvite | null>(null);

  // Invite Collaborators Modal State
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(['sunita', 'callcentre']);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const handleOpenShareModal = (invite: CalendarInvite) => {
    setShareModalInvite(invite);
    setSelectedRecipients(['sunita', 'callcentre']);
    setCopied(false);
    setCopyError(null);
    setValidationError(null);
  };

  const handleToggleRecipient = (id: string) => {
    setValidationError(null);
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const getSelectedCollaboratorObjects = (): Collaborator[] => {
    return CALENDAR_COLLABORATORS.filter((c) => selectedRecipients.includes(c.id));
  };

  const handleCopyLink = async (sessionUrl: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(sessionUrl);
        setCopied(true);
        setCopyError(null);
        showToast('Session invitation link copied to clipboard');
        setTimeout(() => setCopied(false), 2500);
      } else {
        throw new Error('Clipboard API unavailable in current environment');
      }
    } catch (err) {
      console.warn('Clipboard copy error:', err);
      setCopyError('Unable to access clipboard automatically. Please copy the link manually.');
      showToast('Failed to copy. Please copy the URL manually.');
    }
  };

  const handleShareWhatsApp = (invite: CalendarInvite, sessionUrl: string) => {
    const selected = getSelectedCollaboratorObjects();
    const waUrl = generateWhatsAppShareUrl(invite, selected, sessionUrl);
    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
    showToast('Opening WhatsApp to share invitation card...');
  };

  const handlePostToPulse = (invite: CalendarInvite, sessionUrl: string) => {
    const selected = getSelectedCollaboratorObjects();
    const message = formatPulseInviteMessage(invite, selected, sessionUrl);
    sendPulseMessage('callcentre-team', message);
    showToast('Session invitation posted to #callcentre-team on Pulse');
  };

  const handlePrepareInvitation = (invite: CalendarInvite) => {
    const validation = validateCollaboratorSelection(selectedRecipients);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Please select at least one recipient.');
      return;
    }

    const selected = getSelectedCollaboratorObjects();
    const names = selected.map((c) => c.name).join(', ');
    showToast(`Invitations prepared for ${names}. Session link is ready.`);
    setShareModalInvite(null);
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
            className="px-3 py-1 bg-og-green hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Today
          </button>
          <div className="h-4 w-[1px] bg-white/20 mx-1" />
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-white min-w-[120px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
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
                  className={`h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
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

                  {/* Event Dots — strictly for November 2026 */}
                  <div className="flex items-center gap-1 mt-auto">
                    {hasEvents && (
                      <span className="w-2 h-2 rounded-full bg-og-green shadow-xs animate-pulse-dot" />
                    )}
                    {currentMonth === 10 && currentYear === 2026 && day === 3 && (
                      <span className="w-2 h-2 rounded-full bg-og-gold shadow-xs" title="SOP Coaching" />
                    )}
                    {currentMonth === 10 && currentYear === 2026 && day === 14 && (
                      <span className="w-2 h-2 rounded-full bg-og-blue shadow-xs" title="Monthly ASM Review" />
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
                      onClick={() => handleOpenShareModal(invite)}
                      className="p-1 rounded-md text-og-gray-text hover:text-[#1c1c1e] hover:bg-white transition-colors cursor-pointer"
                      title="Invite collaborators & share link"
                      aria-label="Invite collaborators to session"
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
                      className="w-full py-1.5 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
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

      {/* Invite Collaborators Modal */}
      {shareModalInvite && (() => {
        const sessionUrl = generateSessionUrl(shareModalInvite);
        const formattedDateTime = formatSessionDateTime(
          shareModalInvite.day,
          shareModalInvite.time,
          currentYear,
          currentMonth
        );

        return (
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Invite collaborators to session"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                onClick={() => setShareModalInvite(null)}
                aria-hidden="true"
              />

              <div className="relative w-full max-w-lg bg-white rounded-sheet shadow-2xl p-5 sm:p-6 border border-og-gray-border space-y-4 animate-fade-in z-10">
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-3 border-b border-og-gray-border">
                  <div>
                    <div className="text-[10px] font-bold text-og-green uppercase tracking-wider">
                      ONGROUND CALENDAR
                    </div>
                    <h3 className="text-lg font-bold text-[#1c1c1e] mt-0.5">Invite collaborators</h3>
                    <p className="text-xs text-og-gray-text mt-0.5">
                      Get the right people into the session.
                    </p>
                  </div>
                  <button
                    onClick={() => setShareModalInvite(null)}
                    className="w-8 h-8 rounded-full bg-og-gray flex items-center justify-center text-og-gray-text hover:text-[#1c1c1e] transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Session Card Preview */}
                <div className="p-3.5 bg-og-gray/40 rounded-xl border border-og-gray-border space-y-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-og-forest">
                    TEAM SESSION
                  </div>
                  <div className="font-bold text-sm text-[#1c1c1e]">{shareModalInvite.title}</div>
                  <div className="text-xs text-og-gray-text flex items-center gap-1.5 pt-0.5">
                    <Clock size={12} className="text-og-green shrink-0" />
                    <span>{formattedDateTime}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    <span>{shareModalInvite.meta}</span>
                  </div>
                </div>

                {/* Section 01: Invite People */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-og-gray-text">
                        01 / Invite people
                      </div>
                      <div className="text-xs font-semibold text-[#1c1c1e]">
                        Select who should receive this invitation.
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-og-gray-text">
                      {selectedRecipients.length} selected
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {CALENDAR_COLLABORATORS.map((c) => {
                      const isSelected = selectedRecipients.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleRecipient(c.id)}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              handleToggleRecipient(c.id);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-og-green bg-emerald-50/50 shadow-xs'
                              : 'border-og-gray-border bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-xs"
                              style={{ backgroundColor: c.bg, color: c.color }}
                            >
                              {c.initials}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#1c1c1e]">{c.name}</div>
                              <div className="text-[11px] text-og-gray-text">{c.role}</div>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-og-green border-og-green text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check size={13} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 02: Share Session */}
                <div className="space-y-2.5 pt-1 border-t border-og-gray-border">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-og-gray-text">
                      02 / Share session
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs font-semibold text-[#1c1c1e]">
                        Session invitation link
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          copied
                            ? 'bg-emerald-100 text-og-forest'
                            : 'bg-og-gray text-og-gray-text'
                        }`}
                      >
                        {copied ? 'Copied to clipboard' : 'Ready to copy'}
                      </span>
                    </div>
                    <p className="text-[11px] text-og-gray-text mt-0.5">
                      A unique link associated with this session.
                    </p>
                  </div>

                  {/* URL Input and Copy Button */}
                  <div className="flex items-center gap-2 p-1.5 bg-og-gray rounded-xl border border-og-gray-border text-xs">
                    <input
                      type="text"
                      readOnly
                      value={sessionUrl}
                      className="flex-1 bg-transparent border-none text-[#1c1c1e] focus:outline-hidden font-mono text-[11px] px-2 truncate"
                      aria-label="Session link"
                    />
                    <button
                      onClick={() => handleCopyLink(sessionUrl)}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs transition-colors cursor-pointer shrink-0 ${
                        copied
                          ? 'bg-emerald-700 text-white'
                          : 'bg-og-green hover:bg-og-forest text-white shadow-xs'
                      }`}
                      aria-label="Copy session link"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {copyError && (
                    <div className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle size={12} />
                      <span>{copyError}</span>
                    </div>
                  )}

                  {/* Multi-Channel Sharing Actions: WhatsApp & Pulse */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(shareModalInvite, sessionUrl)}
                      className="p-2.5 rounded-xl border border-og-gray-border bg-white hover:bg-emerald-50/40 hover:border-og-green transition-all flex items-center gap-2 text-left cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Send size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1c1c1e]">WhatsApp</div>
                        <div className="text-[10px] text-og-gray-text truncate">Share invitation</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePostToPulse(shareModalInvite, sessionUrl)}
                      className="p-2.5 rounded-xl border border-og-gray-border bg-white hover:bg-purple-50/40 hover:border-purple-400 transition-all flex items-center gap-2 text-left cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Users size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1c1c1e]">Pulse</div>
                        <div className="text-[10px] text-og-gray-text truncate">Post to team channel</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Validation Error Banner */}
                {validationError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Action Footer */}
                <div className="pt-2 border-t border-og-gray-border">
                  <button
                    type="button"
                    onClick={() => handlePrepareInvitation(shareModalInvite)}
                    disabled={selectedRecipients.length === 0}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      selectedRecipients.length === 0
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-og-green hover:bg-og-forest text-white shadow-sm cursor-pointer'
                    }`}
                  >
                    <span>
                      Prepare invitation · {selectedRecipients.length} selected
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
