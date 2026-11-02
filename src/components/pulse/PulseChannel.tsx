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
} from 'lucide-react';
import { PULSE_THREADS, PULSE_CHANNELS, LEADS } from '../../data/mockData';
import { answerQuery, type AvaniContext } from '../../services/avaniAssistant';
import type { PinnedActionItem } from '../../types';

interface PulseChannelProps {
  channelId: string;
  onBack: () => void;
}

// Safe parser for predefined system bold tags — eliminates any XSS vulnerability
function SafeMessageText({ text, isMe }: { text: string; isMe: boolean }) {
  if (isMe) {
    // User-submitted messages are rendered strictly as text
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  // Parse safe <b>...</b> in static feed messages without raw HTML injection
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
    pinnedAnswers,
    answerPinnedCard,
    shiftProgress,
    recentCalls,
    dailyTasks,
    callQueue,
  } = useApp();

  const channelMeta = PULSE_CHANNELS.find((c) => c.id === channelId) || PULSE_CHANNELS[0];
  const isAvaniBotChannel = channelId === 'avanibot';

  const [inputText, setInputText] = useState('');
  const [customReplyByCard, setCustomReplyByCard] = useState<Record<string, string>>({});
  const [isBotTyping, setIsBotTyping] = useState(false);

  const messages = pulseMessages[channelId] || (PULSE_THREADS[channelId]?.messages ?? []);
  const activeThread = PULSE_THREADS[channelId];

  // Multiple pinned action items support with fallback to legacy single needsInput
  const pinnedList: PinnedActionItem[] = activeThread?.pinnedItems
    ? activeThread.pinnedItems
    : activeThread?.needsInput
    ? [
        {
          id: `${channelId}-needs-input`,
          question: activeThread.needsInput.question,
          options: activeThread.needsInput.options,
        },
      ]
    : [];

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, channelId, isBotTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || inputText;
    if (!content.trim() || isBotTyping) return;

    sendPulseMessage(channelId, content.trim());
    setInputText('');
    showToast(`Message sent to ${channelMeta.name}`);

    // If active channel is AvaniBot, trigger grounded assistant response
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
        sendPulseMessage('avanibot', botResp.text, {
          who: 'AvaniBot',
          initials: '🤖',
          bg: '#e1f5ee',
          color: '#0f6e56',
          isAgent: false,
        });
      } catch (e) {
        sendPulseMessage(
          'avanibot',
          'Sorry Arvind, I encountered an error checking shift records. Please try again.',
          {
            who: 'AvaniBot',
            initials: '🤖',
            bg: '#fdecec',
            color: '#c94040',
            isAgent: false,
          }
        );
      } finally {
        setIsBotTyping(false);
      }
    }
  };

  const handleSelectPinnedOption = (card: PinnedActionItem, option: string) => {
    if (isAvaniBotChannel) {
      answerPinnedCard(card.id, option);
      handleSendMessage(option);
    } else {
      answerPinnedCard(card.id, `${option} for the coaching session.`, channelId);
      showToast(`Response submitted for: ${card.question}`);
    }
  };

  const handleCustomPinnedSubmit = (card: PinnedActionItem, e: React.FormEvent) => {
    e.preventDefault();
    const reply = (customReplyByCard[card.id] || '').trim();
    if (!reply) return;

    if (isAvaniBotChannel) {
      answerPinnedCard(card.id, reply);
      handleSendMessage(reply);
    } else {
      answerPinnedCard(card.id, reply, channelId);
      showToast('Custom reply sent to channel');
    }

    setCustomReplyByCard((prev) => ({ ...prev, [card.id]: '' }));
  };

  return (
    <div className="bg-white rounded-card border border-og-gray-border flex flex-col h-[calc(100vh-180px)] min-h-[500px] shadow-xs overflow-hidden animate-fade-in">
      {/* Channel Header */}
      <div className="p-4 border-b border-og-gray-border bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-og-gray-border hover:bg-og-gray text-[#1c1c1e] transition-colors cursor-pointer"
            aria-label="Back to channels"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1c1c1e]">{channelMeta.name}</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isAvaniBotChannel
                    ? 'bg-emerald-100 text-og-forest'
                    : 'bg-emerald-50 text-og-green'
                }`}
              >
                {isAvaniBotChannel ? 'Dedicated AI Assistant' : 'Active Channel'}
              </span>
            </div>
            <p className="text-xs text-og-gray-text">{channelMeta.lastMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-og-gray-text bg-og-gray/60 px-2.5 py-1 rounded-lg">
          {isAvaniBotChannel ? (
            <>
              <Bot size={14} className="text-og-green" />
              <span className="font-semibold text-og-forest">Shift AI Assistant</span>
            </>
          ) : (
            <>
              <Users size={14} />
              <span className="font-semibold">6 Team Members</span>
            </>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {/* Date Divider */}
        <div className="flex items-center justify-center my-2">
          <span className="text-[11px] font-bold text-og-gray-text bg-white border border-og-gray-border px-3 py-1 rounded-full shadow-2xs">
            {activeThread?.dateLabel || 'Today'}
          </span>
        </div>

        {/* Pinned Action Items Cards (Single or Multiple) */}
        {pinnedList.length > 0 && (
          <div className="space-y-3">
            {pinnedList.map((card) => {
              const answeredValue = pinnedAnswers[card.id];
              return (
                <div
                  key={card.id}
                  className={`p-4 rounded-xl border shadow-xs space-y-3 ${
                    isAvaniBotChannel
                      ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-teal-50/60'
                      : 'border-amber-200 bg-gradient-to-r from-amber-50/70 to-orange-50/60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`p-1 rounded-lg flex-shrink-0 mt-0.5 ${
                        isAvaniBotChannel
                          ? 'bg-emerald-100 text-og-forest'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isAvaniBotChannel ? <Sparkles size={15} /> : <HelpCircle size={15} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isAvaniBotChannel ? 'text-og-forest' : 'text-amber-900'
                          }`}
                        >
                          {isAvaniBotChannel ? 'AvaniBot Action Item' : 'Needs Your Input • Action Required'}
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

                  {answeredValue ? (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-og-forest font-bold">
                      <CheckCircle2 size={15} className="text-og-green" />
                      <span>Response submitted: "{answeredValue}"</span>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {card.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleSelectPinnedOption(card, opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                              opt.includes('Confirmed') || isAvaniBotChannel
                                ? 'bg-og-green hover:bg-og-forest text-white'
                                : 'bg-white hover:bg-gray-100 text-[#1c1c1e] border border-og-gray-border'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>

                      {!isAvaniBotChannel && (
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
                            className="flex-1 bg-white border border-og-gray-border rounded-lg px-3 py-1.5 text-xs text-[#1c1c1e] placeholder-gray-400 focus:outline-hidden focus:border-og-green"
                          />
                          <button
                            type="submit"
                            disabled={!(customReplyByCard[card.id] || '').trim()}
                            className="px-3 py-1.5 bg-og-forest hover:bg-og-forest-deep disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Reply
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Message Stream */}
        {messages.map((m) => {
          const isMe = m.isAgent || m.who === 'Arvind Rajan';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-og-gray-text">
                <span className="font-bold text-[#1c1c1e]">{m.who}</span>
                <span>•</span>
                <span>{m.time}</span>
              </div>

              <div
                className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-xs ${
                  isMe
                    ? 'bg-gradient-to-r from-og-green to-og-forest text-white rounded-tr-none'
                    : m.who === 'AvaniBot'
                    ? 'bg-white text-[#1c1c1e] border-2 border-emerald-500/30 rounded-tl-none shadow-xs'
                    : 'bg-white text-[#1c1c1e] border border-og-gray-border rounded-tl-none'
                }`}
              >
                <SafeMessageText text={m.text} isMe={isMe} />
              </div>
            </div>
          );
        })}

        {isBotTyping && (
          <div className="flex items-center gap-2 text-xs text-og-gray-text p-2 animate-fade-in">
            <Bot size={15} className="text-og-green animate-bounce" />
            <span>AvaniBot is referencing shift records...</span>
          </div>
        )}
      </div>

      {/* Channel Reply Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-og-gray-border bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isAvaniBotChannel
              ? 'Ask AvaniBot about targets, leads, callbacks, escalations or tasks...'
              : `Message ${channelMeta.name}...`
          }
          disabled={isBotTyping}
          className="flex-1 bg-og-gray border border-og-gray-border rounded-xl px-4 py-2.5 text-xs text-[#1c1c1e] placeholder-gray-400 focus:outline-hidden focus:border-og-green"
          aria-label={`Message ${channelMeta.name}`}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isBotTyping}
          className="px-4 py-2.5 bg-og-green hover:bg-og-forest disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <span>Send</span>
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
