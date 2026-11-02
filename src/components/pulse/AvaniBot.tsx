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
  MessageSquare,
} from 'lucide-react';
import {
  answerQuery,
  type AvaniResponse,
  type AvaniContext,
  type AvaniAction,
} from '../../services/avaniAssistant';
import { LEADS } from '../../data/mockData';

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestIdRef = useRef<number>(0);

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

    try {
      // Simulate quick natural processing delay (150ms)
      await new Promise((res) => setTimeout(res, 150));
      const response: AvaniResponse = await answerQuery(textToSend, context);

      // Verify this is still the newest query before setting state
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
    } catch (err) {
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

  const handleActionClick = (action: AvaniAction) => {
    switch (action.type) {
      case 'NAVIGATE_VIEW':
        if (action.payload?.view) {
          setActiveView(action.payload.view);
          if (action.payload.tab) {
            setPlanTab(action.payload.tab);
          }
          showToast(`Switched to ${action.payload.view} view`);
        }
        break;
      case 'OPEN_CHANNEL':
        if (action.payload?.channelId) {
          onSelectChannel(action.payload.channelId);
          showToast(`Opened #${action.payload.channelId} channel`);
        }
        break;
      case 'START_CALL':
        if (action.payload?.leadId) {
          const lead = LEADS.find((l) => l.id === action.payload.leadId);
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
        }
        break;
      case 'OPEN_QUEUE':
        setLeadsModalOpen(true);
        showToast('Opened live call queue');
        break;
      default:
        break;
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text:
          'Conversation reset. I am connected to your live shift progress, leads, callbacks, escalations, and tasks.\n' +
          'How can I help you with your shift right now?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAvailable: true,
      },
    ]);
    showToast('AvaniBot chat session reset');
  };

  return (
    <div className="bg-gradient-to-r from-og-night-mid via-[#252849] to-[#2d2d5f] text-white p-5 rounded-card shadow-md space-y-4">
      {/* Top Bar: Identity & Actions */}
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
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Data-Connected
              </span>
            </div>
            <h2 className="text-lg font-bold mt-0.5">AvaniBot: your AI manager assistant</h2>
            <p className="text-xs text-gray-300">
              Grounded in live calling targets, lead scores, callbacks, escalations & tasks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleResetChat}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 transition-colors text-xs flex items-center gap-1 cursor-pointer"
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            onClick={() => onSelectChannel('callcentre-team')}
            className="px-3.5 py-2 bg-og-green hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <span>Team Channel</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Quick Prompts Chips */}
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

              {/* Action Buttons Attached to Grounded Bot Responses */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                  {msg.actions.map((act, aIdx) => (
                    <button
                      key={aIdx}
                      onClick={() => handleActionClick(act)}
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
