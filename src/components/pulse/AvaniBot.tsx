import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bot,
  Send,
  Sparkles,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Phone,
  Pin,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  UserCheck,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import {
  answerQuery,
  type AvaniResponse,
  type AvaniContext,
  type AvaniAction,
} from '../../services/avaniAssistant';
import { LEADS } from '../../data/mockData';
import { pulseApi } from '../../services/pulseApi';
import type { PinnedActionItem } from '../../types';

interface AvaniBotProps {
  onSelectChannel: (channelId: string) => void;
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  actions?: AvaniAction[];
  isAvailable?: boolean;
}

const QUICK_PROMPTS = [
  'Which leads should I prioritize today?',
  'How is my calling progress?',
  "What's our latest escalation?",
  'What callbacks are pending?',
  'Which tasks remain?',
];

const ADVISORS_FOR_REASSIGNMENT = [
  'Priya K. · Whitefield Store',
  'Sameena S. · RT Nagar Store',
  'Neha P. · Call Centre Team',
  'Arvind Rajan · Koramangala Store',
];

export default function AvaniBot({
  onSelectChannel,
  externalPrompt,
  onClearExternalPrompt,
}: AvaniBotProps) {
  const {
    shiftProgress,
    recentCalls,
    dailyTasks,
    pulseMessages,
    sendPulseMessage,
    callQueue,
    setActiveView,
    setPlanTab,
    startCall,
    showToast,
    setLeadsModalOpen,
  } = useApp();

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text:
        'Hello Arvind! I am AvaniBot, your grounded shift assistant.\n\n' +
        'I am connected to your live calling targets, lead scores, callbacks, team escalations, and shift checklist.\n' +
        'How can I help you with your shift right now?',
      timestamp: 'Shift Start',
      isAvailable: true,
    },
  ]);

  // Pinned Actions Feed state
  const [pinnedItems, setPinnedItems] = useState<PinnedActionItem[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(true);
  const [pinnedError, setPinnedError] = useState<string | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [customReplyByItem, setCustomReplyByItem] = useState<Record<string, string>>({});
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [reassignModalItemId, setReassignModalItemId] = useState<string | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState(ADVISORS_FOR_REASSIGNMENT[0]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestIdRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load pinned items from backend
  const loadPinnedFeed = async () => {
    try {
      setPinnedLoading(true);
      setPinnedError(null);
      const items = await pulseApi.fetchPinnedItems('avanibot');
      setPinnedItems(items);
    } catch (err: any) {
      setPinnedError(err?.message || 'Failed to load pinned items');
    } finally {
      setPinnedLoading(false);
    }
  };

  useEffect(() => {
    loadPinnedFeed();
  }, []);

  // Auto-scroll to latest message in chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle external prompts triggered by specialized agent cards
  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      handleSend(externalPrompt.trim());
      if (onClearExternalPrompt) {
        onClearExternalPrompt();
      }
    }
  }, [externalPrompt]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText ?? inputQuery).trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);

    const requestId = ++activeRequestIdRef.current;

    const context: AvaniContext = {
      shiftProgress,
      leads: LEADS,
      recentCalls,
      dailyTasks,
      pulseMessages,
      callQueue,
    };

    sendPulseMessage('avanibot', textToSend);

    try {
      await new Promise((res) => setTimeout(res, 150));
      const response: AvaniResponse = await answerQuery(textToSend, context);

      sendPulseMessage('avanibot', response.text, {
        who: 'AvaniBot',
        initials: '🤖',
        bg: '#e1f5ee',
        color: '#0f6e56',
        isAgent: false,
      });

      if (requestId === activeRequestIdRef.current) {
        const botMessage: ChatMessage = {
          id: response.id,
          sender: 'bot',
          text: response.text,
          timestamp: response.timestamp,
          actions: response.actions,
          isAvailable: response.isAvailable,
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch {
      if (requestId === activeRequestIdRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'bot',
            text: 'An error occurred while accessing shift records. Please try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAvailable: false,
          },
        ]);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Pinned Item Actions
  const handleSelectPinnedOption = async (item: PinnedActionItem, option: string) => {
    if (submittingItemId) return;

    // Special semantic: "Calling now" invokes calling workflow for the 2 hot leads
    if (option === 'Calling now') {
      const hotLead = LEADS[0]; // Mukunda R.
      startCall({
        id: hotLead.id,
        name: hotLead.name,
        initials: hotLead.initials,
        phone: hotLead.phone,
        avatarBg: hotLead.avatarBg,
        avatarColor: hotLead.avatarColor,
        intent: hotLead.interest,
        product: hotLead.product,
        value: `₹${hotLead.expectedValue.toLocaleString()}`,
      });
      showToast(`Initiating outbound call to hot lead: ${hotLead.name} (${hotLead.phone})`);
    }

    // Special semantic: "Reassign" opens real reassignment workflow
    if (option === 'Reassign') {
      setReassignModalItemId(item.id);
      return;
    }

    // Persist response to backend
    try {
      setSubmittingItemId(item.id);
      await pulseApi.respondPinnedItem(item.id, option);

      // Optimistically update local pinned state with confirmation from backend
      setPinnedItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, isAnswered: true, selectedOption: option }
            : i
        )
      );
      showToast(`Response submitted: "${option}"`);
    } catch {
      showToast('Failed to record response. Please try again.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleConfirmReassignment = async () => {
    if (!reassignModalItemId) return;
    try {
      setSubmittingItemId(reassignModalItemId);
      await pulseApi.respondPinnedItem(
        reassignModalItemId,
        'Reassign',
        `Reassigned 2 hot leads to ${selectedAdvisor}`
      );

      setPinnedItems((prev) =>
        prev.map((i) =>
          i.id === reassignModalItemId
            ? {
                ...i,
                isAnswered: true,
                selectedOption: 'Reassign',
                customReply: `Reassigned 2 hot leads to ${selectedAdvisor}`,
              }
            : i
        )
      );
      showToast(`Successfully reassigned 2 hot leads to ${selectedAdvisor}`);
      setReassignModalItemId(null);
    } catch {
      showToast('Failed to reassign leads. Reassignment service unavailable.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleCustomPinnedSubmit = async (item: PinnedActionItem, e: React.FormEvent) => {
    e.preventDefault();
    const reply = (customReplyByItem[item.id] || '').trim();
    if (!reply || submittingItemId) return;

    try {
      setSubmittingItemId(item.id);
      await pulseApi.respondPinnedItem(item.id, 'Custom', reply);

      setPinnedItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, isAnswered: true, selectedOption: reply, customReply: reply }
            : i
        )
      );
      setCustomReplyByItem((prev) => ({ ...prev, [item.id]: '' }));
      showToast(`Custom response recorded: "${reply}"`);
    } catch {
      showToast('Failed to submit custom response.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleDailyBrief = () => {
    handleSend('Summarize my daily brief, calling targets, and escalations');
  };

  const handleAskQuestion = () => {
    inputRef.current?.focus();
    showToast('Ask AvaniBot anything about your shift');
  };

  const unansweredCount = pinnedItems.filter((i) => !i.isAnswered).length;

  return (
    <div className="bg-gradient-to-r from-og-night-mid via-[#252849] to-[#2d2d5f] text-white p-5 rounded-card shadow-md space-y-4">
      {/* Top Bar: Identity & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-og-green to-emerald-400 flex items-center justify-center text-white shadow-lg shrink-0">
            <Bot size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-og-green-light uppercase tracking-wider">
                AvaniBot • Shift AI Assistant
              </span>
              {/* ALWAYS ON Indicator */}
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ALWAYS ON
              </span>
            </div>
            <h2 className="text-lg font-bold mt-0.5">AvaniBot: your AI manager assistant</h2>
            <p className="text-xs text-gray-300">
              Grounded in live calling targets, lead scores, callbacks, escalations & tasks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Daily Brief action */}
          <button
            onClick={handleDailyBrief}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
            title="Generate today's shift brief"
          >
            <Calendar size={13} className="text-og-green-light" />
            <span>Daily Brief</span>
          </button>

          {/* Ask a question action */}
          <button
            onClick={handleAskQuestion}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
            title="Focus question input"
          >
            <MessageSquare size={13} className="text-og-green-light" />
            <span>Ask a question</span>
          </button>

          <button
            onClick={() => onSelectChannel('avanibot')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
            title="Open dedicated channel view"
          >
            <Bot size={13} className="text-og-green-light" />
            <span className="hidden sm:inline">Channel View</span>
          </button>
        </div>
      </div>

      {/* Part A: Persistent Multi-Item Pinned Action Feed */}
      <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl overflow-hidden shadow-xs">
        {/* Header Bar */}
        <div
          onClick={() => setPinnedOpen((prev) => !prev)}
          className="p-3 bg-amber-500/10 hover:bg-amber-500/15 border-b border-amber-500/20 flex items-center justify-between cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pin size={15} className="text-amber-400 rotate-45" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
              Needs your input
            </span>
            {unansweredCount > 0 && (
              <span className="text-[10px] font-extrabold bg-red-500 text-white px-2 py-0.2 rounded-full">
                {unansweredCount}
              </span>
            )}
            <span className="text-xs text-amber-300/80">pinned</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-200/70">
            <span>{unansweredCount ? `${unansweredCount} pending actions` : 'All caught up'}</span>
            {pinnedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>

        {/* Pinned Items List */}
        {pinnedOpen && (
          <div className="p-3 sm:p-4 space-y-3">
            {pinnedLoading && (
              <div className="text-xs text-gray-300 py-2 flex items-center gap-2">
                <Sparkles size={13} className="animate-spin text-amber-400" />
                <span>Loading active pinned actions...</span>
              </div>
            )}

            {pinnedError && (
              <div className="text-xs text-red-300 py-1 flex items-center gap-1.5">
                <AlertCircle size={13} />
                <span>{pinnedError}</span>
              </div>
            )}

            {!pinnedLoading && pinnedItems.length === 0 && (
              <div className="text-xs text-emerald-300 py-2 flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>No pending pinned actions. All shift decisions completed!</span>
              </div>
            )}

            {pinnedItems.map((item) => (
              <div
                key={item.id}
                className="bg-white/95 text-[#1c1c1e] p-3.5 rounded-xl border border-amber-200 shadow-xs space-y-2.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#1c1c1e] leading-snug">
                      {item.question}
                    </h4>
                    {item.meta && (
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                        {item.meta}
                      </p>
                    )}
                  </div>
                  {item.isAnswered && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={11} />
                      Responded
                    </span>
                  )}
                </div>

                {/* Responded vs Actions State */}
                {item.isAnswered ? (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>
                      Response: <strong>"{item.selectedOption}"</strong>
                      {item.customReply && item.customReply !== item.selectedOption && (
                        <span className="block text-[11px] font-normal text-gray-600 mt-0.5">
                          Note: {item.customReply}
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-0.5">
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.options.map((opt) => (
                        <button
                          key={opt}
                          disabled={submittingItemId === item.id}
                          onClick={() => handleSelectPinnedOption(item, opt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                            opt === 'Calling now' || opt === 'Converted'
                              ? 'bg-og-green hover:bg-emerald-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-[#1c1c1e] border border-gray-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {/* Custom reply field and Send button */}
                    <form
                      onSubmit={(e) => handleCustomPinnedSubmit(item, e)}
                      className="flex items-center gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={customReplyByItem[item.id] || ''}
                        onChange={(e) =>
                          setCustomReplyByItem((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Or type your answer"
                        disabled={submittingItemId === item.id}
                        className="flex-1 bg-white text-[#1c1c1e] placeholder-gray-400 border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:outline-hidden focus:border-og-green"
                      />
                      <button
                        type="submit"
                        disabled={!customReplyByItem[item.id]?.trim() || submittingItemId === item.id}
                        className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reassign Modal Workflow */}
      {reassignModalItemId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white text-[#1c1c1e] p-5 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-og-green" />
                <h3 className="text-sm font-bold">Reassign 2 Hot Leads</h3>
              </div>
              <button
                onClick={() => setReassignModalItemId(null)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Select an available store advisor to immediately take ownership of the 2 hot leads
              (<strong>Mukunda R.</strong> &amp; <strong>Ritu S.</strong>) untouched for 24h:
            </p>

            <div className="space-y-2">
              {ADVISORS_FOR_REASSIGNMENT.map((adv) => (
                <label
                  key={adv}
                  onClick={() => setSelectedAdvisor(adv)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                    selectedAdvisor === adv
                      ? 'border-og-green bg-emerald-50 text-og-forest font-bold'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{adv}</span>
                  <input
                    type="radio"
                    name="advisor"
                    checked={selectedAdvisor === adv}
                    onChange={() => setSelectedAdvisor(adv)}
                    className="accent-og-green"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReassignModalItemId(null)}
                className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleConfirmReassignment}
                disabled={submittingItemId !== null}
                className="px-4 py-1.5 text-xs font-bold bg-og-green hover:bg-emerald-600 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Shift Questions Chips */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Suggested Shift Questions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 hover:border-og-green text-gray-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={11} className="text-og-green-light shrink-0" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Stream Box */}
      <div className="bg-black/25 rounded-xl border border-white/10 p-3 sm:p-4 max-h-[300px] overflow-y-auto space-y-3 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[10px] font-bold text-gray-400">
                {msg.sender === 'user' ? 'You (Arvind)' : 'AvaniBot'}
              </span>
              <span className="text-[9px] text-gray-500">• {msg.timestamp}</span>
            </div>

            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3 leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-og-green text-white rounded-tr-xs shadow-xs'
                  : msg.isAvailable === false
                  ? 'bg-red-950/40 border border-red-500/30 text-red-200 rounded-tl-xs shadow-xs'
                  : 'bg-white/10 border border-white/15 text-gray-100 rounded-tl-xs shadow-xs backdrop-blur-xs'
              }`}
            >
              {msg.isAvailable === false && (
                <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1 text-[11px]">
                  <AlertCircle size={13} />
                  <span>Information Boundary Notice</span>
                </div>
              )}
              <div>{msg.text}</div>

              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                  {msg.actions.map((act, aIdx) => (
                    <button
                      key={aIdx}
                      onClick={() => {
                        if (act.type === 'START_CALL' && act.payload?.leadId) {
                          const lead = LEADS.find((l) => l.id === act.payload.leadId);
                          if (lead) {
                            startCall({
                              id: lead.id,
                              name: lead.name,
                              initials: lead.initials,
                              phone: lead.phone,
                              avatarBg: lead.avatarBg,
                              avatarColor: lead.avatarColor,
                              intent: lead.interest,
                              product: lead.product,
                              value: `₹${lead.expectedValue.toLocaleString()}`,
                            });
                            showToast(`Connecting outbound call to ${lead.name}...`);
                          }
                        } else if (act.type === 'OPEN_CHANNEL' && act.payload?.channelId) {
                          onSelectChannel(act.payload.channelId);
                        } else if (act.type === 'NAVIGATE_VIEW' && act.payload?.view) {
                          setActiveView(act.payload.view);
                          if (act.payload.tab) setPlanTab(act.payload.tab);
                        } else if (act.type === 'OPEN_QUEUE') {
                          setLeadsModalOpen(true);
                        }
                      }}
                      className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors border border-white/20 cursor-pointer shadow-xs"
                    >
                      <span>{act.label}</span>
                      <ExternalLink size={11} className="text-og-green-light" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-300 text-xs py-2 px-1">
            <div className="w-5 h-5 rounded-full bg-og-green/30 flex items-center justify-center">
              <Sparkles size={12} className="text-og-green-light animate-spin" />
            </div>
            <span>AvaniBot is referencing shift records...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form with Send Button */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask AvaniBot about your shift, leads, callbacks, escalations or tasks..."
            disabled={loading}
            className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/15 text-white placeholder-gray-400 rounded-xl px-3.5 py-2.5 text-xs border border-white/15 focus:border-og-green focus:outline-hidden transition-all"
            aria-label="Ask AvaniBot about your shift"
          />
        </div>
        <button
          type="submit"
          disabled={!inputQuery.trim() || loading}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            !inputQuery.trim() || loading
              ? 'bg-white/10 text-gray-400 cursor-not-allowed border border-white/10'
              : 'bg-og-green hover:bg-emerald-600 text-white shadow-md'
          }`}
          aria-label="Submit question to AvaniBot"
        >
          <span>Send</span>
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
