import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  MessageCircle,
  Award,
  ChevronRight,
  Sparkles,
  ThumbsUp,
  Headphones,
  ShoppingCart,
  CheckSquare,
  Target,
  Mic,
  TrendingUp,
  Info,
  Users,
} from 'lucide-react';
import AvaniBot from './AvaniBot';
import { pulseApi } from '../../services/pulseApi';
import type { CustomAgent, PulseChannel } from '../../types';

interface PulseHomeProps {
  onSelectChannel: (channelId: string) => void;
}

const AGENT_ICON_MAP: Record<string, any> = {
  Headphones: Headphones,
  ShoppingCart: ShoppingCart,
  CheckSquare: CheckSquare,
  Target: Target,
  Mic: Mic,
};

export default function PulseHome({ onSelectChannel }: PulseHomeProps) {
  const { showToast } = useApp();
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [channels, setChannels] = useState<PulseChannel[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoadingAgents(true);
        const [agentsData, channelsData] = await Promise.all([
          pulseApi.fetchCustomAgents(),
          pulseApi.fetchChannels(),
        ]);
        if (mounted) {
          setCustomAgents(agentsData);
          setChannels(channelsData);
        }
      } catch {
        // Handled inside pulseApi fallbacks
      } finally {
        if (mounted) setLoadingAgents(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const roleAgents = customAgents.filter((a) => a.agentType === 'role');
  const taskAgents = customAgents.filter((a) => a.agentType === 'task');

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

  const renderAgentIcon = (iconName: string) => {
    const IconComponent = AGENT_ICON_MAP[iconName] || Headphones;
    return <IconComponent size={16} />;
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* AvaniBot Interactive Shift AI Assistant (Part A & B) */}
      <AvaniBot
        onSelectChannel={onSelectChannel}
        externalPrompt={externalPrompt}
        onClearExternalPrompt={() => setExternalPrompt(null)}
      />

      {/* Part B: Specialized Role & Task Agents */}
      <div className="space-y-4">
        {/* Section Header with Explicit Attribution */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-og-forest uppercase tracking-wider">
              Specialized Shift Agents
            </span>
            <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 flex items-center gap-1">
              <Info size={11} className="text-gray-400" />
              Source: Sample shift benchmark · Koramangala store
            </span>
          </div>
          <span className="text-xs text-og-gray-text">
            Tap agent to enter channel &amp; tasks
          </span>
        </div>

        {/* 1. Role Agents (Run a Team) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={12} className="text-blue-600" />
            <span>Role Agents (Run a Team)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roleAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onSelectChannel(agent.channelSlug)}
                className="p-3.5 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-2xs"
                      style={{ backgroundColor: agent.color }}
                    >
                      {renderAgentIcon(agent.icon)}
                    </div>
                    {/* KPI Badge */}
                    <div className="flex items-center gap-1.5 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-md text-xs font-bold text-blue-900">
                      <span>{agent.metricName}</span>
                      <span className="text-blue-700">{agent.currentValue}%</span>
                      <span className="text-[10px] text-emerald-700">
                        {agent.changeValue >= 0 ? `▲ +${agent.changeValue}%` : `▼ ${agent.changeValue}%`}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-[#1c1c1e] group-hover:text-blue-800 transition-colors">
                    #{agent.channelSlug}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">{agent.name} · {agent.scope}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-blue-700">
                  <span>Enter Channel &amp; My Tasks</span>
                  <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Task Agents (Move One Metric) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={12} className="text-purple-600" />
            <span>Task Agents (Move One Metric)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {taskAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onSelectChannel(agent.channelSlug)}
                className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-og-green/40 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-2xs"
                      style={{ backgroundColor: agent.color }}
                    >
                      {renderAgentIcon(agent.icon)}
                    </div>
                    {/* KPI Badge */}
                    <div className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-800 flex items-center gap-1">
                      <span>{agent.currentValue}%</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold">
                        {agent.changeValue >= 0 ? `▲ +${agent.changeValue}%` : `▼ ${agent.changeValue}%`}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-[#1c1c1e] group-hover:text-og-forest transition-colors leading-snug">
                    #{agent.channelSlug}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {agent.metricName} (target {agent.targetValue}%)
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] font-bold text-og-green">
                  <span>{agent.itemsLabel}</span>
                  <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-Column Section: Active Channels List + Kudos */}
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
            {channels.map((ch) => (
              <div
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className="p-3.5 rounded-xl border border-og-gray-border bg-og-gray/30 hover:bg-og-gray/70 hover:border-og-green/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs text-white font-bold"
                    style={{ backgroundColor: ch.color || '#1d4ed8' }}
                  >
                    #
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#1c1c1e] group-hover:text-og-forest transition-colors">
                        {ch.name}
                      </h4>
                      {ch.unread > 0 && (
                        <span className="text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.2 rounded-full">
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
                  className="text-gray-300 group-hover:text-og-forest transition-colors shrink-0"
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
            className="mt-4 w-full py-2 bg-og-gray hover:bg-gray-200 text-og-forest rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Send Kudos to a Teammate
          </button>
        </div>
      </div>
    </div>
  );
}
