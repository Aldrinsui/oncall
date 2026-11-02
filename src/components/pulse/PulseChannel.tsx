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

export default function PulseChannel({ channelId, onBack }: PulseChannelProps) {
  const { showToast } = useApp();

  const channelMeta = PULSE_CHANNELS.find((c) => c.id === channelId) || PULSE_CHANNELS[0];
  const initialThread = PULSE_THREADS[channelId] || PULSE_THREADS['callcentre-team'];

  const [messages, setMessages] = useState<PulseMessage[]>(initialThread.messages);
  const [inputText, setInputText] = useState('');
  const [needsInputAnswered, setNeedsInputAnswered] = useState<string | null>(null);
  const [customReply, setCustomReply] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (textToSend?: string) => {
    const content = textToSend || inputText;
    if (!content.trim()) return;

    const newMessage: PulseMessage = {
      id: `m-${Date.now()}`,
      who: 'Arvind Rajan',
      initials: 'AR',
      bg: '#e1f5ee',
      color: '#0f6e56',
      text: content.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAgent: true,
    };

    setMessages((prev) => [...prev, newMessage]);
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
    setNeedsInputAnswered(customReply.trim());
    handleSendMessage(`@Sunita Rao ${customReply.trim()}`);
    setCustomReply('');
  };

  return (
    <div className="bg-white rounded-card border border-og-gray-border shadow-md overflow-hidden flex flex-col h-[700px] animate-fade-in">
      {/* Channel Top Header */}
      <div className="bg-og-forest text-white p-3.5 px-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title="Back to Pulse Home"
            aria-label="Back to Pulse Home"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">{channelMeta.name}</span>
              <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full font-semibold">
                Shift Channel
              </span>
            </div>
            <p className="text-[11px] text-[#a9c4ba]">
              Koramangala Store Call Centre Shift • 8 active staff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#a9c4ba]">
          <Users size={15} />
          <span className="hidden sm:inline">Active Shift Members</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-og-gray/20">
        {/* Pinned "Needs your input" Card */}
        {initialThread.needsInput && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle size={13} className="text-og-amber" />
                Action Required • Needs Your Input
              </span>
              {needsInputAnswered && (
                <span className="text-[11px] font-bold text-og-green bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Responded: {needsInputAnswered}
                </span>
              )}
            </div>

            <p className="text-xs font-bold text-[#1c1c1e]">
              {initialThread.needsInput.question}
            </p>

            {/* Quick Answer Option Buttons */}
            {!needsInputAnswered && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {initialThread.needsInput.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswerNeedsInput(opt)}
                    className="px-3.5 py-1.5 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Reply Input Box for the Card */}
            {!needsInputAnswered && (
              <form onSubmit={handleCustomNeedsInputSubmit} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customReply}
                  onChange={(e) => setCustomReply(e.target.value)}
                  placeholder="Or type custom slot availability..."
                  className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-[#1c1c1e] placeholder-gray-400 focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold"
                >
                  Reply
                </button>
              </form>
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
                dangerouslySetInnerHTML={{ __html: m.text }}
              />
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
