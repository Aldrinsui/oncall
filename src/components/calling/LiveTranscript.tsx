import { useEffect, useRef } from 'react';
import { Mic, Volume2, Sparkles, Send } from 'lucide-react';

export interface TranscriptLine {
  id: string;
  speaker: 'agent' | 'customer';
  name: string;
  text: string;
  time: string;
}

interface LiveTranscriptProps {
  lines: TranscriptLine[];
  onAgentSpeak: (text: string) => void;
  isMicActive: boolean;
  onToggleMic: () => void;
  prompts?: string[];
  stageLabel?: string;
}

export default function LiveTranscript({
  lines,
  onAgentSpeak,
  isMicActive,
  onToggleMic,
  prompts,
  stageLabel,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRef.current && inputRef.current.value.trim()) {
      onAgentSpeak(inputRef.current.value.trim());
      inputRef.current.value = '';
    }
  };

  const activePrompts = prompts && prompts.length > 0 ? prompts : [
    'Hello! Arvind from The Sleep Company Koramangala. How can I help you today?',
    'We offer a 12-month zero-interest EMI on the Ortho GRID mattress.',
    'It comes with an exclusive 10-year warranty and a 100-night trial.',
    'May I book a showroom demo or send you the official quote on WhatsApp?',
  ];

  return (
    <div className="bg-og-night rounded-2xl border border-og-night-border overflow-hidden flex flex-col h-[460px] shadow-lg">
      {/* Header */}
      <div className="p-3 px-4 bg-og-night-mid border-b border-og-night-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-og-green animate-pulse-dot" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Live Call Audio Transcript
          </span>
        </div>

        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
            isMicActive
              ? 'bg-og-green text-white shadow-xs'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
          title="Toggle microphone for live speech-to-text"
        >
          <Mic size={13} className={isMicActive ? 'animate-pulse' : undefined} />
          <span>{isMicActive ? 'Mic Active' : 'Enable Mic'}</span>
        </button>
      </div>

      {/* Transcript Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-3 scroll-smooth text-xs"
      >
        {lines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-gray-400">
            <div>
              <Volume2 size={24} className="mx-auto mb-2 text-gray-500 animate-bounce" />
              <p>Call connected. Speak into your microphone or select an SOP prompt below.</p>
            </div>
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className={`flex flex-col ${
                line.speaker === 'agent' ? 'items-end' : 'items-start'
              } animate-fade-in`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
                <span className="font-bold text-gray-200">{line.name}</span>
                <span>•</span>
                <span>{line.time}</span>
              </div>

              <div
                className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                  line.speaker === 'agent'
                    ? 'bg-gradient-to-r from-og-green to-og-forest text-white rounded-tr-none'
                    : 'bg-[#1e2330] text-gray-100 rounded-tl-none border border-og-night-border'
                }`}
              >
                {line.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stage-Aware Contextual Prompts Strip */}
      <div className="p-2 bg-og-night-mid/70 border-t border-og-night-border flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-gray-400 font-bold px-1 flex-shrink-0 flex items-center gap-1">
          <Sparkles size={11} className="text-og-green" />
          {stageLabel ? `${stageLabel} Prompts:` : 'SOP Prompts:'}
        </span>
        {activePrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onAgentSpeak(p)}
            className="bg-white/10 hover:bg-og-green/30 hover:border-og-green text-gray-200 px-2.5 py-1 rounded-lg border border-white/5 whitespace-nowrap transition-colors flex-shrink-0"
            title={p}
          >
            {p.length > 40 ? p.slice(0, 40) + '...' : p}
          </button>
        ))}
      </div>

      {/* Message Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-og-night border-t border-og-night-border flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Type agent response or speak into your microphone..."
          className="flex-1 bg-[#1e2330] text-white placeholder-gray-500 text-xs px-3.5 py-2.5 rounded-xl border border-og-night-border focus:outline-hidden focus:border-og-green"
        />
        <button
          type="submit"
          className="p-2.5 bg-og-green hover:bg-og-forest text-white rounded-xl transition-colors flex items-center justify-center shadow-xs"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
