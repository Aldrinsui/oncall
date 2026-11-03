import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Send,
  HelpCircle,
  CheckCircle2,
  Users,
  Bot,
  Sparkles,
  AlertCircle,
  Inbox,
  ChevronDown,
  ChevronUp,
  Clock,
  Pin,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { PULSE_THREADS, PULSE_CHANNELS, LEADS } from '../../data/mockData';
import { answerQuery, type AvaniContext } from '../../services/avaniAssistant';
import { pulseApi } from '../../services/pulseApi';
import type {
  PinnedActionItem,
  ChatMessage,
  AgentChannelContext,
  AgentChannelTask,
} from '../../types';

interface PulseChannelProps {
  channelId: string;
  onBack: () => void;
}

// Safe parser for predefined system bold tags
function SafeMessageText({ text, isMe }: { text: string; isMe: boolean }) {
  if (isMe) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  const segments = text.split(/(<b>.*?<\/b>)/gi);
  return (
    <div className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.toLowerCase().startsWith('<b>') && seg.toLowerCase().endsWith('</b>')) {
          return (
            <strong key={i} className="font-bold">
              {seg.slice(3, -4)}
            </strong>
          );
        }
        return <span key={i}>{seg}</span>;
      })}
    </div>
  );
}

export default function PulseChannel({ channelId, onBack }: PulseChannelProps) {
  const {
    showToast,
    pulseMessages,
    sendPulseMessage,
    shiftProgress,
    recentCalls,
    dailyTasks,
    callQueue,
  } = useApp();

  const channelMeta = PULSE_CHANNELS.find((c) => c.id === channelId) || {
    id: channelId,
    name: `#${channelId.replace(/^#/, '')}`,
    unread: 0,
    lastMessage: 'Active channel',
    color: '#1d4ed8',
    icon: 'Hash',
  };

  const isAvaniBotChannel = channelId === 'avanibot';
  const isAgentChannel =
    channelId.includes('agent') ||
    ['callcentre-agent', 'cross-sell-agent', 'sop-agent', 'lead-conversion-agent', 'capture-agent'].includes(
      channelId.replace(/^#/, '')
    );

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedList, setPinnedList] = useState<PinnedActionItem[]>([]);
  const [channelContext, setChannelContext] = useState<AgentChannelContext | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [customReplyByCard, setCustomReplyByCard] = useState<Record<string, string>>({});
  const [helpTaskId, setHelpTaskId] = useState<string | null>(null);
  const [helpExplanation, setHelpExplanation] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load channel messages, pinned items, and My Context & Tasks from backend
  useEffect(() => {
    let mounted = true;

    async function loadChannelData() {
      try {
        const [msgs, pinned, ctx] = await Promise.all([
          pulseApi.fetchMessages(channelId),
          pulseApi.fetchPinnedItems(channelId),
          isAgentChannel ? pulseApi.fetchChannelContext(channelId) : Promise.resolve(null),
        ]);

        if (mounted) {
          // Merge with any in-memory pulseMessages from AppContext if newer
          const appMsgs = pulseMessages[channelId] || [];
          if (appMsgs.length > msgs.length) {
            setMessages(appMsgs);
          } else {
            setMessages(msgs);
          }

          setPinnedList(pinned);
          setChannelContext(ctx);
        }
      } catch {
        // Fallback to static mock thread
        if (mounted) {
          setMessages(PULSE_THREADS[channelId]?.messages || []);
          setPinnedList(PULSE_THREADS[channelId]?.pinnedItems || []);
        }
      }
    }

    loadChannelData();

    // Mark channel as read
    pulseApi.markChannelRead(channelId);

    return () => {
      mounted = false;
    };
  }, [channelId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, channelId, isBotTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || inputText;
    if (!content.trim() || isBotTyping) return;

    setInputText('');

    // Optimistically add user message
    const newMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      who: 'You',
      initials: 'AR',
      bg: '#e1f5ee',
      color: '#0f6e56',
      text: content.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAgent: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    sendPulseMessage(channelId, content.trim());
    showToast(`Message sent to ${channelMeta.name}`);

    // Persist to backend
    try {
      await pulseApi.postMessage(channelId, content.trim());
    } catch {
      // Offline fallback already updated state
    }

    // If channel is AvaniBot, trigger grounded assistant response
    if (isAvaniBotChannel) {
      setIsBotTyping(true);
      const context: AvaniContext = {
        shiftProgress,
        leads: LEADS,
        recentCalls,
        dailyTasks,
        pulseMessages,
        callQueue,
      };

      try {
        await new Promise((res) => setTimeout(res, 200));
        const botResp = await answerQuery(content.trim(), context);

        const botMsg: ChatMessage = {
          id: botResp.id,
          who: 'AvaniBot',
          initials: '🤖',
          bg: '#e1f5ee',
          color: '#0f6e56',
          text: botResp.text,
          time: botResp.timestamp,
          isAgent: false,
        };

        setMessages((prev) => [...prev, botMsg]);
        sendPulseMessage('avanibot', botResp.text, {
          who: 'AvaniBot',
          initials: '🤖',
          bg: '#e1f5ee',
          color: '#0f6e56',
          isAgent: false,
        });

        // Save bot response to backend
        try {
          await pulseApi.postMessage(channelId, botResp.text);
        } catch {}
      } catch {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          who: 'AvaniBot',
          initials: '🤖',
          bg: '#fdecec',
          color: '#c94040',
          text: 'Sorry Arvind, I encountered an error checking shift records. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAgent: false,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsBotTyping(false);
      }
    }
  };

  const handleSelectPinnedOption = async (card: PinnedActionItem, option: string) => {
    try {
      await pulseApi.respondPinnedItem(card.id, option);
      setPinnedList((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, isAnswered: true, selectedOption: option } : c))
      );
      showToast(`Response submitted for: ${card.question}`);
      handleSendMessage(option);
    } catch {
      showToast('Failed to record response. Please retry.');
    }
  };

  const handleCustomPinnedSubmit = async (card: PinnedActionItem, e: React.FormEvent) => {
    e.preventDefault();
    const reply = (customReplyByCard[card.id] || '').trim();
    if (!reply) return;

    try {
      await pulseApi.respondPinnedItem(card.id, 'Custom', reply);
      setPinnedList((prev) =>
        prev.map((c) =>
          c.id === card.id
            ? { ...c, isAnswered: true, selectedOption: reply, customReply: reply }
            : c
        )
      );
      setCustomReplyByCard((prev) => ({ ...prev, [card.id]: '' }));
      showToast('Custom response submitted to channel');
      handleSendMessage(reply);
    } catch {
      showToast('Failed to submit response.');
    }
  };

  // Part C: Task action handlers
  const handleTaskAction = async (task: AgentChannelTask, action: 'Done' | 'Not yet' | 'Need help') => {
    if (action === 'Need help') {
      setHelpTaskId(task.id);
      setHelpExplanation('');
      return;
    }

    const newStatus = action === 'Done' ? 'COMPLETED' : 'IN_PROGRESS';

    try {
      await pulseApi.updateTask(task.id, { status: newStatus });
      setChannelContext((prev: AgentChannelContext | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t: AgentChannelTask) =>
            t.id === task.id ? { ...t, status: newStatus as any } : t
          ),
        };
      });
      showToast(`Task marked as ${newStatus}: ${task.title}`);
    } catch {
      showToast('Failed to update task state.');
    }
  };

  const handleSaveNeedHelp = async (task: AgentChannelTask) => {
    if (!helpExplanation.trim()) {
      showToast('Please provide an explanation for needing help.');
      return;
    }

    try {
      await pulseApi.updateTask(task.id, {
        status: 'BLOCKED',
        explanation: helpExplanation.trim(),
      });
      setChannelContext((prev: AgentChannelContext | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t: AgentChannelTask) =>
            t.id === task.id
              ? { ...t, status: 'BLOCKED', explanation: helpExplanation.trim() }
              : t
          ),
        };
      });
      setHelpTaskId(null);
      setHelpExplanation('');
      showToast(`Flagged task as BLOCKED (Need help): ${task.title}`);
    } catch {
      showToast('Failed to update task.');
    }
  };

  const handleBulkAcknowledge = async () => {
    try {
      setAcknowledging(true);
      const res = await pulseApi.acknowledgeTasks(channelId);
      setChannelContext((prev: AgentChannelContext | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          unacknowledgedTaskCount: 0,
          tasks: prev.tasks.map((t: AgentChannelTask) => ({ ...t, isAcknowledged: true })),
        };
      });
      showToast(`Acknowledged ${res.acknowledged_count} shift tasks for today.`);
    } catch {
      showToast('Failed to acknowledge tasks.');
    } finally {
      setAcknowledging(false);
    }
  };

  const unackCount = channelContext?.unacknowledgedTaskCount ?? 0;

  return (
    <div className="bg-white rounded-card border border-og-gray-border flex flex-col h-[calc(100vh-180px)] min-h-[550px] shadow-xs overflow-hidden animate-fade-in">
      {/* Channel Header Bar */}
      <div className="p-3.5 border-b border-og-gray-border bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-og-gray-border hover:bg-og-gray text-[#1c1c1e] transition-colors cursor-pointer shrink-0"
            aria-label="Back to channels"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[#1c1c1e] truncate">{channelMeta.name}</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  isAvaniBotChannel
                    ? 'bg-emerald-100 text-og-forest'
                    : isAgentChannel
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-emerald-50 text-og-green'
                }`}
              >
                {isAvaniBotChannel
                  ? 'Dedicated AI Assistant'
                  : isAgentChannel
                  ? 'Specialized Agent'
                  : 'Active Channel'}
              </span>
            </div>
            <p className="text-xs text-og-gray-text truncate">{channelMeta.lastMessage}</p>
          </div>
        </div>

        {/* Right side pill */}
        <div className="flex items-center gap-2 shrink-0">
          {channelContext && (
            <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-900">
              <span>{channelContext.metricName}</span>
              <span className="text-blue-700">{channelContext.currentValue}%</span>
              <span className="text-[10px] text-emerald-600">
                {channelContext.changeValue >= 0 ? `▲ +${channelContext.changeValue}%` : `▼ ${channelContext.changeValue}%`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-og-gray-text bg-og-gray/60 px-2.5 py-1 rounded-lg">
            {isAvaniBotChannel ? (
              <>
                <Bot size={14} className="text-og-green" />
                <span className="font-semibold text-og-forest">Shift AI Assistant</span>
              </>
            ) : (
              <>
                <Users size={14} />
                <span className="font-semibold">Team Channel</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Part C: Pinned "My Context & Tasks" Panel on relevant agent channels */}
      {isAgentChannel && channelContext && (
        <div className="border-b-2 border-teal-600/30 bg-[#fcfffe] border-l-4 border-l-teal-700 flex-shrink-0 z-10 shadow-2xs">
          {/* Collapsible Header */}
          <div
            onClick={() => setContextOpen((prev) => !prev)}
            className="flex items-center gap-2 p-2.5 px-3.5 bg-emerald-50/80 hover:bg-emerald-100/60 transition-colors cursor-pointer"
          >
            <Inbox size={16} className="text-teal-700 shrink-0" />
            <span className="text-xs font-bold text-teal-900">My Context &amp; Tasks</span>
            <span className="text-[10px] font-extrabold bg-teal-700 text-white px-2 py-0.2 rounded-md uppercase tracking-wider">
              FOR YOU
            </span>
            {unackCount > 0 && (
              <span className="text-[10px] font-extrabold bg-red-500 text-white px-2 py-0.2 rounded-full">
                {unackCount}
              </span>
            )}
            <span className="text-xs text-teal-800/80 truncate flex-1 ml-1 hidden sm:inline">
              From your manager · {channelContext.tasks.length} tasks ·{' '}
              {unackCount ? `${unackCount} to acknowledge` : 'Acknowledged'}
            </span>
            <span className="text-teal-700 ml-auto">
              {contextOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </div>

          {/* Context Body when open */}
          {contextOpen && (
            <div className="max-h-[40vh] overflow-y-auto p-3.5 space-y-3 text-xs text-gray-800">
              {/* Incoming Context */}
              <div>
                <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                  INCOMING CONTEXT
                </div>
                <div className="text-[11px] text-gray-500">
                  Sent {channelContext.digestTime} by AvaniBot for your manager
                </div>
                <div className="mt-1.5 p-2 rounded-lg bg-white border border-teal-200/60 text-xs space-y-1">
                  <div>{channelContext.managerContext}</div>
                  {channelContext.didWell && (
                    <div className="text-emerald-700 font-medium">
                      ✓ <strong>Did well:</strong> {channelContext.didWell}
                    </div>
                  )}
                  {channelContext.improve && (
                    <div className="text-amber-800 font-medium">
                      ↗ <strong>Improve:</strong> {channelContext.improve}
                    </div>
                  )}
                </div>
              </div>

              {/* My Tasks Today */}
              <div>
                <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-1">
                  MY TASKS TODAY
                </div>

                <div className="border border-teal-200 rounded-xl bg-teal-50/40 overflow-hidden space-y-2 pb-2">
                  {/* Bulk Acknowledgement Banner */}
                  {unackCount > 0 ? (
                    <div className="flex items-center justify-between p-2.5 px-3 bg-amber-50 border-b border-amber-200 text-amber-900 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle size={14} className="text-amber-600" />
                        <span>Acknowledge today's tasks ({unackCount} pending)</span>
                      </div>
                      <button
                        onClick={handleBulkAcknowledge}
                        disabled={acknowledging}
                        className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 p-2 px-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>Today's shift tasks acknowledged</span>
                    </div>
                  )}

                  {/* Type 1 Tasks */}
                  <div className="px-3 pt-1">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Type 1 · {channelContext.itemsLabel}
                    </span>
                  </div>

                  <div className="px-3 space-y-2">
                    {channelContext.tasks.map((t: AgentChannelTask) => (
                      <div
                        key={t.id}
                        className="bg-white p-2.5 rounded-lg border border-teal-100 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h5 className="font-bold text-[#1c1c1e] text-xs leading-snug">
                              {t.title}
                            </h5>
                            {t.description && (
                              <p className="text-[11px] text-gray-500 mt-0.5">{t.description}</p>
                            )}
                            {t.timeWindow && (
                              <div className="flex items-center gap-1 text-[10px] text-teal-700 font-semibold mt-1">
                                <Clock size={11} />
                                <span>Window: {t.timeWindow}</span>
                              </div>
                            )}
                          </div>

                          {/* Current Status Pill */}
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                              t.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'BLOCKED'
                                ? 'bg-red-100 text-red-800'
                                : t.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>

                        {t.explanation && (
                          <div className="p-1.5 bg-red-50 text-red-800 rounded border border-red-200 text-[11px]">
                            <strong>Help request note:</strong> {t.explanation}
                          </div>
                        )}

                        {/* Task Action Buttons: Done / Not yet / Need help */}
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 flex-wrap">
                          <span className="text-[10px] text-gray-500 font-bold">Action:</span>
                          <button
                            onClick={() => handleTaskAction(t, 'Done')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                              t.status === 'COMPLETED'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            ✓ Done
                          </button>
                          <button
                            onClick={() => handleTaskAction(t, 'Not yet')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                              t.status === 'IN_PROGRESS'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                            }`}
                          >
                            Not yet
                          </button>
                          <button
                            onClick={() => handleTaskAction(t, 'Need help')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                              t.status === 'BLOCKED'
                                ? 'bg-amber-600 text-white'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            Need help
                          </button>
                        </div>

                        {/* Inline Need Help explanation form */}
                        {helpTaskId === t.id && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                            <div className="text-[11px] font-bold text-amber-900">
                              Describe what you need help with:
                            </div>
                            <input
                              type="text"
                              value={helpExplanation}
                              onChange={(e) => setHelpExplanation(e.target.value)}
                              placeholder="e.g. Lead requested 20% discount override from manager"
                              className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs text-[#1c1c1e] focus:outline-hidden"
                            />
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => setHelpTaskId(null)}
                                className="px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-200 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNeedHelp(t)}
                                className="px-2.5 py-0.5 bg-amber-700 text-white text-[11px] font-bold rounded"
                              >
                                Save Need Help
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Type 2 Soft Tasks */}
                  {channelContext.softTasks && (
                    <div className="px-3 pt-2 border-t border-teal-200/60 space-y-1">
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Type 2 · Soft Tasks
                      </span>
                      <div className="text-xs pt-1 space-y-0.5">
                        {channelContext.softTasks.good_at?.length > 0 && (
                          <div className="text-emerald-700">
                            <strong>Good at:</strong> {channelContext.softTasks.good_at.join(', ')}
                          </div>
                        )}
                        {channelContext.softTasks.work_on?.length > 0 && (
                          <div className="text-amber-800">
                            <strong>Practise today:</strong> {channelContext.softTasks.work_on.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {/* Date Divider */}
        <div className="flex items-center justify-center my-2">
          <span className="text-[11px] font-bold text-og-gray-text bg-white border border-og-gray-border px-3 py-1 rounded-full shadow-2xs">
            Today
          </span>
        </div>

        {/* Pinned Action Items Feed on Channel (if any) */}
        {pinnedList.length > 0 && (
          <div className="space-y-3">
            {pinnedList.map((card) => (
              <div
                key={card.id}
                className="p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/70 to-orange-50/60 shadow-xs space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="p-1 rounded-lg flex-shrink-0 mt-0.5 bg-amber-100 text-amber-800">
                    <Pin size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                        Needs Your Input • Action Required
                      </span>
                      {card.meta && (
                        <span className="text-[10px] text-gray-500 font-medium">
                          • {card.meta}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-[#1c1c1e] mt-0.5">
                      {card.question}
                    </h4>
                  </div>
                </div>

                {card.isAnswered ? (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-og-forest font-bold">
                    <CheckCircle2 size={15} className="text-og-green" />
                    <span>Response submitted: "{card.selectedOption}"</span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {card.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => handleSelectPinnedOption(card, opt)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-gray-100 text-[#1c1c1e] border border-og-gray-border transition-all shadow-xs cursor-pointer"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => handleCustomPinnedSubmit(card, e)}
                      className="flex items-center gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={customReplyByCard[card.id] || ''}
                        onChange={(e) =>
                          setCustomReplyByCard((prev) => ({
                            ...prev,
                            [card.id]: e.target.value,
                          }))
                        }
                        placeholder="Or type a custom response..."
                        className="flex-1 text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-amber-600"
                      />
                      <button
                        type="submit"
                        disabled={!customReplyByCard[card.id]?.trim()}
                        className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
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

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.isAgent ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs"
              style={{
                backgroundColor: msg.bg || '#f1f2f6',
                color: msg.color || '#1c1c1e',
              }}
            >
              {msg.initials}
            </div>

            <div className={`max-w-[78%] space-y-1 ${msg.isAgent ? 'items-end' : 'items-start'}`}>
              <div
                className={`flex items-center gap-2 text-[10px] text-og-gray-text ${
                  msg.isAgent ? 'justify-end' : 'justify-start'
                }`}
              >
                <span className="font-bold text-[#1c1c1e]">{msg.who}</span>
                <span>• {msg.time}</span>
              </div>

              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                  msg.isAgent
                    ? 'bg-og-green text-white rounded-tr-xs'
                    : 'bg-white border border-og-gray-border text-[#1c1c1e] rounded-tl-xs'
                }`}
              >
                <SafeMessageText text={msg.text} isMe={!!msg.isAgent} />
              </div>
            </div>
          </div>
        ))}

        {isBotTyping && (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
            <Sparkles size={13} className="animate-spin text-og-green" />
            <span>AvaniBot is formulating a grounded response...</span>
          </div>
        )}
      </div>

      {/* Message Input Footer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-og-gray-border bg-white flex items-center gap-2 flex-shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${channelMeta.name}...`}
          disabled={isBotTyping}
          className="flex-1 bg-og-gray/40 border border-og-gray-border focus:border-og-green rounded-xl px-3.5 py-2.5 text-xs text-[#1c1c1e] focus:outline-hidden transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isBotTyping}
          className={`p-2.5 rounded-xl text-white transition-all cursor-pointer ${
            !inputText.trim() || isBotTyping
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-og-green hover:bg-emerald-600 shadow-xs'
          }`}
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
