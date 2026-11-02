import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Send,
  HelpCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Users,
  Paperclip,
} from 'lucide-react';
import { PULSE_THREADS, PULSE_CHANNELS } from '../../data/mockData';
import type { PulseMessage } from '../../types';

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
  const { showToast, pulseMessages, sendPulseMessage } = useApp();

  const channelMeta = PULSE_CHANNELS.find((c) => c.id === channelId) || PULSE_CHANNELS[0];

  const [inputText, setInputText] = useState('');
  const [needsInputAnswered, setNeedsInputAnswered] = useState<string | null>(null);
  const [customReply, setCustomReply] = useState('');

  const messages = pulseMessages[channelId] || (PULSE_THREADS[channelId]?.messages ?? []);
  const activeThread = PULSE_THREADS[channelId];

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, channelId]);

  const handleSendMessage = (textToSend?: string) => {
    const content = textToSend || inputText;
    if (!content.trim()) return;

    sendPulseMessage(channelId, content.trim());
    setInputText('');
    showToast('Message sent to ' + channelMeta.name);
  };

  const handleAnswerNeedsInput = (option: string) => {
    setNeedsInputAnswered(option);
    handleSendMessage(`@Sunita Rao ${option} for the 4:30 PM Friday coaching session.`);
  };

  const handleCustomNeedsInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customReply.trim()) return;
    setNeedsInputAnswered(customReply);
    handleSendMessage(`@Sunita Rao ${customReply}`);
    setCustomReply('');
  };

  return (
    <div className="bg-white rounded-card border border-og-gray-border flex flex-col h-[calc(100vh-180px)] min-h-[500px] shadow-xs overflow-hidden animate-fade-in">
      {/* Channel Header */}
      <div className="p-4 border-b border-og-gray-border bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-og-gray-border hover:bg-og-gray text-[#1c1c1e] transition-colors"
            aria-label="Back to channels"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1c1c1e]">{channelMeta.name}</h3>
              <span className="text-[10px] bg-emerald-50 text-og-green px-2 py-0.5 rounded-full font-bold">
                Active Channel
              </span>
            </div>
            <p className="text-xs text-og-gray-text">{channelMeta.lastMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-og-gray-text bg-og-gray/60 px-2.5 py-1 rounded-lg">
          <Users size={14} />
          <span className="font-semibold">6 Team Members</span>
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

        {/* Pinned "Needs Your Input" Card */}
        {activeThread?.needsInput && (
          <div className="p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/70 to-orange-50/60 shadow-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="p-1 rounded-lg bg-amber-100 text-amber-800 flex-shrink-0 mt-0.5">
                <HelpCircle size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                    Needs Your Input • Action Required
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#1c1c1e] mt-0.5">
                  {activeThread.needsInput.question}
                </h4>
              </div>
            </div>

            {needsInputAnswered ? (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-og-forest font-bold">
                <CheckCircle2 size={15} className="text-og-green" />
                <span>Response submitted: "{needsInputAnswered}"</span>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {activeThread.needsInput.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleAnswerNeedsInput(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                        opt.includes('Confirmed')
                          ? 'bg-og-green hover:bg-og-forest text-white'
                          : 'bg-white hover:bg-gray-100 text-[#1c1c1e] border border-og-gray-border'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCustomNeedsInputSubmit} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customReply}
                    onChange={(e) => setCustomReply(e.target.value)}
                    placeholder="Or type a custom note to Sunita..."
                    className="flex-1 bg-white border border-og-gray-border rounded-lg px-3 py-1.5 text-xs text-[#1c1c1e] placeholder-gray-400 focus:outline-hidden focus:border-og-green"
                  />
                  <button
                    type="submit"
                    disabled={!customReply.trim()}
                    className="px-3 py-1.5 bg-og-forest hover:bg-og-forest-deep disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Reply
                  </button>
                </form>
              </div>
            )}
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
                    : 'bg-white text-[#1c1c1e] border border-og-gray-border rounded-tl-none'
                }`}
              >
                <SafeMessageText text={m.text} isMe={isMe} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Channel Reply Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-og-gray-border flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${channelMeta.name}...`}
          className="flex-1 bg-og-gray/50 border border-og-gray-border rounded-xl px-4 py-2.5 text-xs text-[#1c1c1e] placeholder-gray-400 focus:outline-hidden focus:border-og-green focus:bg-white"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 bg-og-green hover:bg-og-forest disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-xs flex items-center justify-center"
          aria-label="Send channel message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
