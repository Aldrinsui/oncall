import { useApp } from '../../context/AppContext';
import {
  MessageCircle,
  Bot,
  Award,
  TrendingUp,
  ChevronRight,
  Flame,
  Sparkles,
  Heart,
  ThumbsUp,
} from 'lucide-react';
import { AGENT_ROLES, PULSE_CHANNELS } from '../../data/mockData';

interface PulseHomeProps {
  onSelectChannel: (channelId: string) => void;
}

export default function PulseHome({ onSelectChannel }: PulseHomeProps) {
  const { showToast, setActiveView, setPlanTab, startCall } = useApp();

  const kudosPosts = [
    {
      id: 'k1',
      author: 'Sunita Rao (Manager)',
      time: '1 hr ago',
      badge: '⭐ Star Performer',
      text: 'Huge shoutout to Arvind Rajan for closing the highest value Ortho PRO order this morning (₹24,990) with a 92% SOP score! Keep raising the bar! 🚀',
      likes: 6,
    },
    {
      id: 'k2',
      author: 'Ravi Kumar (ASM)',
      time: '3 hrs ago',
      badge: '🎯 100% Quality',
      text: 'Koramangala team reached 84% conversion on morning callbacks today. Top objection handling across the region.',
      likes: 9,
    },
  ];

  const handleRoleAgentClick = (agentTitle: string) => {
    if (agentTitle.includes('Pitch Coach')) {
      setActiveView('plan');
      setPlanTab('practise');
      showToast('Switched to Pitch Coach roleplay simulator in Plan');
    } else if (agentTitle.includes('Walk-out')) {
      setActiveView('plan');
      setPlanTab('outgoing');
      showToast('Loaded Walk-out recovery leads queue');
    } else {
      showToast(`Activated ${agentTitle} assistance`);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* AvaniBot Hero Banner matching Mock */}
      <div className="bg-gradient-to-r from-og-night-mid via-[#252849] to-[#2d2d5f] text-white p-5 rounded-card shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-og-green to-emerald-400 flex items-center justify-center text-white shadow-lg flex-shrink-0">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-og-green-light uppercase tracking-wider">
                AvaniBot • Shift AI Assistant
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded-full font-bold">
                Online
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-0.5">
              AvaniBot: your AI manager assistant
            </h2>
            <p className="text-xs text-gray-300 mt-0.5">
              Ask about objection scripts, check store stock, or request real-time QA evaluation.
            </p>
          </div>
        </div>

        <button
          onClick={() => onSelectChannel('callcentre-team')}
          className="px-4 py-2 bg-og-green hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs self-start sm:self-auto flex-shrink-0"
        >
          <span>Open Team Channel</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Role and Task Agents Row (From Assignment Page 1 & 4) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-og-forest uppercase tracking-wider">
            Specialized Shift Agents
          </span>
          <span className="text-xs text-og-gray-text">Autonomous task execution</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {AGENT_ROLES.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleRoleAgentClick(agent.title)}
              className="p-3.5 rounded-xl border border-og-gray-border bg-white hover:border-og-green/40 hover:shadow-xs transition-all text-left flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl" aria-hidden="true">{agent.icon}</span>
                  <Sparkles size={13} className="text-gray-300 group-hover:text-og-green transition-colors" />
                </div>
                <h4 className="text-xs font-bold text-[#1c1c1e] leading-snug">{agent.title}</h4>
                <p className="text-[11px] text-og-gray-text mt-1 line-clamp-2 leading-tight">
                  {agent.sub}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-og-gray-border flex items-center justify-between text-[10px] font-bold text-og-green">
                <span>Engage</span>
                <ChevronRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Two-Column Section: Channels List (Left) + Kudos & Recognition Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Channels List */}
        <div className="lg:col-span-2 bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-50 text-og-green">
                <MessageCircle size={16} />
              </span>
              <h3 className="text-sm font-bold text-[#1c1c1e]">Active Pulse Channels</h3>
            </div>
            <span className="text-xs text-og-gray-text">Tap channel to enter live chat</span>
          </div>

          <div className="space-y-2.5">
            {PULSE_CHANNELS.map((ch) => (
              <div
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className="p-3.5 rounded-xl border border-og-gray-border bg-og-gray/30 hover:bg-og-gray/70 hover:border-og-green/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-xs"
                    style={{ backgroundColor: `${ch.color}15` }}
                  >
                    {ch.icon}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#1c1c1e] group-hover:text-og-forest transition-colors">
                        {ch.name}
                      </h4>
                      {ch.unread > 0 && (
                        <span className="text-[10px] bg-og-gold text-og-forest-deep font-extrabold px-1.5 py-0.2 rounded-full">
                          {ch.unread} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-og-gray-text mt-0.5 truncate">
                      {ch.lastMessage}
                    </p>
                  </div>
                </div>

                <ChevronRight
                  size={16}
                  className="text-gray-300 group-hover:text-og-forest transition-colors flex-shrink-0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Kudos & Team Recognition */}
        <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3.5">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-amber-50 text-og-amber">
                  <Award size={16} />
                </span>
                <h3 className="text-sm font-bold text-[#1c1c1e]">Team Kudos</h3>
              </div>
              <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                Koramangala
              </span>
            </div>

            <div className="space-y-3">
              {kudosPosts.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 rounded-xl border border-og-gray-border bg-gradient-to-br from-amber-50/40 to-orange-50/20 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1c1c1e]">{k.author}</span>
                    <span className="text-og-gray-text text-[11px]">{k.time}</span>
                  </div>

                  <span className="inline-block text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    {k.badge}
                  </span>

                  <p className="text-xs text-[#1c1c1e] leading-relaxed">{k.text}</p>

                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 pt-1 border-t border-amber-200/40">
                    <ThumbsUp size={12} />
                    <span>{k.likes} Shift Reactions</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => showToast('Kudos shoutout submitted to store manager')}
            className="mt-4 w-full py-2 bg-og-gray hover:bg-gray-200 text-og-forest rounded-lg text-xs font-bold transition-colors"
          >
            Send Kudos to a Teammate
          </button>
        </div>
      </div>
    </div>
  );
}
