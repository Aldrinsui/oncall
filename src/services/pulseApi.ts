import type {
  PulseChannel,
  ChatMessage,
  PinnedActionItem,
  CustomAgent,
  AgentChannelTask,
  AgentChannelContext,
} from '../types';
import { PULSE_CHANNELS, PULSE_THREADS } from '../data/mockData';
import { getApiBaseUrl } from './telephonyApi';

/**
 * Resolves the Pulse API base URL dynamically:
 * - When VITE_BACKEND_API_URL or getApiBaseUrl() is set, appends '/api/v1' to the backend origin.
 * - In local dev with Vite proxy, returns '/api/v1' (relative path proxied to backend).
 * - Never points to localhost in production.
 */
export const getPulseApiBase = (): string => {
  const backendOrigin = getApiBaseUrl();
  if (backendOrigin) {
    return `${backendOrigin}/api/v1`;
  }
  return '/api/v1';
};

// Default development and production identity headers
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Agent-Id': '00000000-0000-0000-0000-000000000001',
  'X-Store-Id': 'Koramangala',
  'Authorization': 'Bearer oncall-session-token',
};

// In-memory fallback cache for offline resilience
const mockResponses: Record<string, { option: string; reply?: string }> = {};
const mockTaskUpdates: Record<string, Partial<AgentChannelTask>> = {};
let mockAcknowledgedSlugs = new Set<string>();

export const pulseApi = {
  /**
   * Fetch store-authorized channels with unread counts.
   */
  async fetchChannels(): Promise<PulseChannel[]> {
    try {
      const res = await fetch(`${getPulseApiBase()}/pulse/channels`, {
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data.map((c: any) => ({
        id: c.channel_slug || c.name.toLowerCase().replace(/[^a-z0-9-]/g, '') || c.id,
        name: c.name,
        icon: c.icon || 'Hash',
        unread: c.unread_count ?? 0,
        lastMessage: c.description || 'Active Pulse channel',
        color: c.color || '#1d4ed8',
      }));
    } catch {
      // Offline fallback: return seed channels
      return PULSE_CHANNELS;
    }
  },

  /**
   * Fetch message thread for a channel.
   */
  async fetchMessages(channelId: string): Promise<ChatMessage[]> {
    try {
      // Find UUID if channelId is slug
      const channelsRes = await fetch(`${getPulseApiBase()}/pulse/channels`, { headers: DEFAULT_HEADERS });
      if (!channelsRes.ok) throw new Error('Failed to resolve channel UUID');
      const channelsJson = await channelsRes.json();
      const match = channelsJson.data.find(
        (c: any) => c.id === channelId || c.channel_slug === channelId || c.name.toLowerCase().includes(channelId.toLowerCase())
      );
      const uuid = match ? match.id : channelId;

      const res = await fetch(`${getPulseApiBase()}/pulse/channels/${uuid}/messages`, {
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data.map((m: any) => ({
        id: m.id,
        who: m.sender_name,
        initials: m.sender_initials,
        bg: m.is_current_agent ? '#e1f5ee' : '#f1f2f6',
        color: m.is_current_agent ? '#0f6e56' : '#1c1c1e',
        text: m.body,
        time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAgent: m.is_current_agent,
      }));
    } catch {
      return PULSE_THREADS[channelId]?.messages || [];
    }
  },

  /**
   * Post a message to a channel.
   */
  async postMessage(channelId: string, body: string): Promise<ChatMessage> {
    try {
      const channelsRes = await fetch(`${getPulseApiBase()}/pulse/channels`, { headers: DEFAULT_HEADERS });
      let uuid = channelId;
      if (channelsRes.ok) {
        const channelsJson = await channelsRes.json();
        const match = channelsJson.data.find(
          (c: any) => c.id === channelId || c.channel_slug === channelId || c.name.toLowerCase().includes(channelId.toLowerCase())
        );
        if (match) uuid = match.id;
      }

      const res = await fetch(`${getPulseApiBase()}/pulse/channels/${uuid}/messages`, {
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const m = json.data;
      return {
        id: m.id,
        who: m.sender_name,
        initials: m.sender_initials,
        bg: '#e1f5ee',
        color: '#0f6e56',
        text: m.body,
        time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAgent: true,
      };
    } catch (e) {
      // Offline fallback: construct client message
      return {
        id: `offline-${Date.now()}`,
        who: 'You',
        initials: 'AR',
        bg: '#e1f5ee',
        color: '#0f6e56',
        text: body,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAgent: true,
      };
    }
  },

  /**
   * Mark channel as read.
   */
  async markChannelRead(channelId: string): Promise<boolean> {
    try {
      const channelsRes = await fetch(`${getPulseApiBase()}/pulse/channels`, { headers: DEFAULT_HEADERS });
      let uuid = channelId;
      if (channelsRes.ok) {
        const channelsJson = await channelsRes.json();
        const match = channelsJson.data.find(
          (c: any) => c.id === channelId || c.channel_slug === channelId || c.name.toLowerCase().includes(channelId.toLowerCase())
        );
        if (match) uuid = match.id;
      }

      const res = await fetch(`${getPulseApiBase()}/pulse/channels/${uuid}/read`, {
        method: 'POST',
        headers: DEFAULT_HEADERS,
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  /**
   * Fetch active pinned items for channel.
   */
  async fetchPinnedItems(channelId: string): Promise<PinnedActionItem[]> {
    try {
      const channelsRes = await fetch(`${getPulseApiBase()}/pulse/channels`, { headers: DEFAULT_HEADERS });
      let uuid = channelId;
      if (channelsRes.ok) {
        const channelsJson = await channelsRes.json();
        const match = channelsJson.data.find(
          (c: any) => c.id === channelId || c.channel_slug === channelId || c.name.toLowerCase().includes(channelId.toLowerCase())
        );
        if (match) uuid = match.id;
      }

      const res = await fetch(`${getPulseApiBase()}/pulse/channels/${uuid}/pinned-items`, {
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data.map((item: any) => ({
        id: item.id,
        question: item.question,
        options: item.options || [],
        meta: item.meta,
        urgency: item.urgency,
        isAnswered: item.is_answered,
        selectedOption: item.selected_option,
        customReply: item.custom_reply,
      }));
    } catch {
      // Offline fallback: return standard reference items for avanibot
      if (channelId === 'avanibot' || channelId === '00000000-0000-0000-0001-000000000001') {
        const item1Resp = mockResponses['11111111-1111-1111-1111-111111110001'];
        const item2Resp = mockResponses['11111111-1111-1111-1111-111111110002'];
        return [
          {
            id: '11111111-1111-1111-1111-111111110001',
            question: 'Call now or reassign the 2 hot leads',
            options: ['Calling now', 'Reassign'],
            meta: 'Untouched for 24h',
            urgency: 'high',
            isAnswered: !!item1Resp,
            selectedOption: item1Resp?.option || null,
            customReply: item1Resp?.reply || null,
          },
          {
            id: '11111111-1111-1111-1111-111111110002',
            question: "Log this morning's call outcome",
            options: ['Converted', 'Callback', 'Not interested'],
            meta: 'Suresh Nair · plan upgrade enquiry',
            urgency: 'mid',
            isAnswered: !!item2Resp,
            selectedOption: item2Resp?.option || null,
            customReply: item2Resp?.reply || null,
          },
        ];
      }
      return (PULSE_THREADS[channelId]?.pinnedItems || []).map((item) => {
        const resp = mockResponses[item.id];
        return {
          ...item,
          isAnswered: !!resp,
          selectedOption: resp?.option || null,
          customReply: resp?.reply || null,
        };
      });
    }
  },

  /**
   * Submit persistent response to pinned action item.
   */
  async respondPinnedItem(
    pinnedItemId: string,
    selectedOption: string,
    customReply?: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${getPulseApiBase()}/pulse/pinned-items/${pinnedItemId}/respond`, {
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({
          selected_option: selectedOption,
          custom_reply: customReply || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Record to local memory cache as well
      mockResponses[pinnedItemId] = { option: selectedOption, reply: customReply };
      return true;
    } catch (e) {
      // In offline mode, record to mock cache
      mockResponses[pinnedItemId] = { option: selectedOption, reply: customReply };
      return true;
    }
  },

  /**
   * Fetch custom specialized agent catalog with persisted benchmarks.
   */
  async fetchCustomAgents(): Promise<CustomAgent[]> {
    try {
      const res = await fetch(`${getPulseApiBase()}/pulse/agents`, {
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data.map((a: any) => ({
        id: a.id,
        channelSlug: a.channel_slug,
        name: a.name,
        agentType: a.agent_type,
        icon: a.icon,
        color: a.color,
        scope: a.scope,
        metricName: a.metric_name,
        targetValue: a.target_value,
        currentValue: a.current_value,
        changeValue: a.change_value,
        itemsLabel: a.items_label,
        sourceAttribution: a.source_attribution,
        status: a.status,
        didWell: a.did_well,
        improve: a.improve,
        focus: a.focus,
        win: a.win,
        goodAt: a.good_at || [],
        workOn: a.work_on || [],
      }));
    } catch {
      // Offline fallback: static catalog with explicit sample attribution
      return [
        {
          id: 'ca-1',
          channelSlug: 'callcentre-agent',
          name: 'Call Centre Agent',
          agentType: 'role',
          icon: 'Headphones',
          color: '#1d4ed8',
          scope: 'All call-centre staff',
          metricName: 'Conversion',
          targetValue: 28,
          currentValue: 29,
          changeValue: 3,
          itemsLabel: 'Leads to follow up',
          sourceAttribution: 'Sample shift benchmark · Koramangala store',
          status: 'Active',
          didWell: 'Booked 6 store visits from callbacks',
          improve: 'Greeting in the first 10 seconds on 71% of calls',
          focus: 'Opening greeting in first 10 seconds',
          win: '6 store visits booked',
          goodAt: ['Booking visits', 'Objection handling'],
          workOn: ['Opening greeting in first 10s'],
        },
        {
          id: 'ca-2',
          channelSlug: 'cross-sell-agent',
          name: 'Cross-sell & Upsell Agent',
          agentType: 'task',
          icon: 'ShoppingCart',
          color: '#7c3aed',
          scope: 'Stores, calls and field',
          metricName: 'Attach rate',
          targetValue: 25,
          currentValue: 24,
          changeValue: 2,
          itemsLabel: 'Customers to upsell',
          sourceAttribution: 'Sample shift benchmark · Koramangala store',
          status: 'Active',
          didWell: 'Added a protector in 4 of 12 sales',
          improve: 'Offer the pillow bundle before billing',
          focus: 'Bundle script adoption',
          win: '4 protector attachments',
          goodAt: ['Protector pitch'],
          workOn: ['Pillow bundle'],
        },
        {
          id: 'ca-3',
          channelSlug: 'sop-agent',
          name: 'SOP Agent',
          agentType: 'task',
          icon: 'CheckSquare',
          color: '#0e7490',
          scope: 'Stores, calls and field',
          metricName: 'SOP adherence',
          targetValue: 85,
          currentValue: 81,
          changeValue: 2,
          itemsLabel: 'Conversations to review',
          sourceAttribution: 'Sample shift benchmark · Koramangala store',
          status: 'Active',
          didWell: 'Asked for feedback on every closed sale',
          improve: 'Greet within 10 seconds',
          focus: 'Greeting QA score adherence',
          win: 'Every SOP step in 19 of 22 talks',
          goodAt: ['Feedback ask', 'Product demo'],
          workOn: ['Fast greeting'],
        },
        {
          id: 'ca-4',
          channelSlug: 'lead-conversion-agent',
          name: 'Lead Conversion Agent',
          agentType: 'task',
          icon: 'Target',
          color: '#be123c',
          scope: 'Stores, calls and field',
          metricName: 'Lead to sale',
          targetValue: 30,
          currentValue: 31,
          changeValue: 3,
          itemsLabel: 'Leads to follow up',
          sourceAttribution: 'Sample shift benchmark · Koramangala store',
          status: 'Active',
          didWell: 'Called every lead within 24h',
          improve: 'Book the revisit on the first call',
          focus: 'Assign 2 hot leads untouched for 24h',
          win: 'Closed 5 of 13 leads',
          goodAt: ['Fast follow-up'],
          workOn: ['Booking the revisit'],
        },
        {
          id: 'ca-5',
          channelSlug: 'capture-agent',
          name: 'Conversation Capture Agent',
          agentType: 'task',
          icon: 'Mic',
          color: '#0f766e',
          scope: 'Stores, calls and field',
          metricName: 'Capture coverage',
          targetValue: 90,
          currentValue: 78,
          changeValue: 1,
          itemsLabel: 'Shifts to capture',
          sourceAttribution: 'Sample shift benchmark · Koramangala store',
          status: 'Active',
          didWell: 'Recorded every afternoon talk',
          improve: 'Start recording at the greeting',
          focus: 'Opening 10s audio capture',
          win: '100% afternoon coverage',
          goodAt: ['Afternoon coverage'],
          workOn: ['Starting at the greeting'],
        },
      ];
    }
  },

  /**
   * Fetch agent-specific channel context & tasks.
   */
  async fetchChannelContext(channelSlug: string): Promise<AgentChannelContext> {
    try {
      const cleanSlug = channelSlug.replace(/^#/, '');
      const res = await fetch(`${getPulseApiBase()}/pulse/channels/${cleanSlug}/context`, {
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const d = json.data;
      return {
        channelSlug: d.channel_slug,
        channelName: d.channel_name,
        managerContext: d.manager_context,
        digestTime: d.digest_time,
        metricName: d.metric_name,
        targetValue: d.target_value,
        currentValue: d.current_value,
        changeValue: d.change_value,
        didWell: d.did_well,
        improve: d.improve,
        itemsLabel: d.items_label,
        unacknowledgedTaskCount: d.unacknowledged_task_count,
        tasks: d.tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          timeWindow: t.time_window,
          category: t.category,
          status: t.status,
          isAcknowledged: t.is_acknowledged,
          managerName: t.manager_name,
          explanation: t.explanation,
        })),
        softTasks: d.soft_tasks,
      };
    } catch {
      // Offline fallback context
      const cleanSlug = channelSlug.replace(/^#/, '');
      const isAck = mockAcknowledgedSlugs.has(cleanSlug);

      let tasks: AgentChannelTask[] = [];
      if (cleanSlug === 'callcentre-agent') {
        tasks = [
          {
            id: 'mock-cc-1',
            title: 'Priya Iyer · Billing dispute · call 4:30pm',
            description: 'Priya Iyer billing dispute enquiry — check resolution before callback',
            timeWindow: 'call 4:30pm',
            category: 'type_1',
            status: (mockTaskUpdates['mock-cc-1']?.status as any) || 'PENDING',
            isAcknowledged: isAck || !!mockTaskUpdates['mock-cc-1']?.isAcknowledged,
            explanation: mockTaskUpdates['mock-cc-1']?.explanation,
          },
          {
            id: 'mock-cc-2',
            title: "Suresh Nair · Plan upgrade · log outcome",
            description: 'Suresh Nair enquired about upgrading to SmartGRID Luxe — log call disposition',
            timeWindow: 'morning follow-up',
            category: 'type_1',
            status: (mockTaskUpdates['mock-cc-2']?.status as any) || 'PENDING',
            isAcknowledged: isAck || !!mockTaskUpdates['mock-cc-2']?.isAcknowledged,
            explanation: mockTaskUpdates['mock-cc-2']?.explanation,
          },
        ];
      } else if (cleanSlug === 'cross-sell-agent') {
        tasks = [
          {
            id: 'mock-xs-1',
            title: 'Meera S. · Bought mattress, no protector · call today',
            description: 'Cross-sell mattress protector bundle at special 15% discount',
            timeWindow: 'call before 1pm',
            category: 'type_1',
            status: (mockTaskUpdates['mock-xs-1']?.status as any) || 'PENDING',
            isAcknowledged: isAck || !!mockTaskUpdates['mock-xs-1']?.isAcknowledged,
          },
          {
            id: 'mock-xs-2',
            title: 'Karan P. · Queen to king upgrade · send quote',
            description: 'Send formal quote for King size upgrade with 12-month zero interest',
            timeWindow: 'send quote',
            category: 'type_1',
            status: (mockTaskUpdates['mock-xs-2']?.status as any) || 'PENDING',
            isAcknowledged: isAck || !!mockTaskUpdates['mock-xs-2']?.isAcknowledged,
          },
        ];
      } else if (cleanSlug === 'capture-agent') {
        tasks = [
          {
            id: 'mock-ca-1',
            title: 'Mon 11am to 1pm · App not recording · start at greeting',
            description: 'Verify microphone permissions and start capture immediately upon customer greeting',
            timeWindow: '11am to 1pm',
            category: 'type_1',
            status: (mockTaskUpdates['mock-ca-1']?.status as any) || 'PENDING',
            isAcknowledged: isAck || !!mockTaskUpdates['mock-ca-1']?.isAcknowledged,
          },
          {
            id: 'mock-ca-2',
            title: 'Tue 6pm to 8pm · Phone on silent mode',
            description: 'Keep ringtone at full volume during evening shift callback rush',
            timeWindow: '6pm to 8pm',
            category: 'type_1',
            status: (mockTaskUpdates['mock-ca-2']?.status as any) || 'PENDING',
            isAcknowledged: isAck || !!mockTaskUpdates['mock-ca-2']?.isAcknowledged,
          },
        ];
      }

      return {
        channelSlug: cleanSlug,
        channelName: `#${cleanSlug}`,
        managerContext: 'Yesterday: 29% (target 28%). Sent 9:00am by AvaniBot for your manager.',
        digestTime: '9:00am',
        metricName: 'Conversion',
        targetValue: 28,
        currentValue: 29,
        changeValue: 3,
        didWell: 'Booked 6 store visits from callbacks',
        improve: 'Greeting in the first 10 seconds on 71% of calls',
        itemsLabel: 'Leads to follow up',
        unacknowledgedTaskCount: isAck ? 0 : tasks.filter((t) => !t.isAcknowledged).length,
        tasks,
        softTasks: {
          good_at: ['Booking visits', 'Objection handling'],
          work_on: ['Opening greeting in first 10s'],
          focus: 'Opening greeting in first 10 seconds',
          win: '6 store visits booked',
        },
      };
    }
  },

  /**
   * Update task status (Done -> COMPLETED, Not yet -> IN_PROGRESS, Need help -> BLOCKED).
   */
  async updateTask(
    taskId: string,
    update: { status?: string; is_acknowledged?: boolean; explanation?: string },
  ): Promise<AgentChannelTask> {
    try {
      const res = await fetch(`${getPulseApiBase()}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const t = json.data;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        timeWindow: t.time_window,
        category: t.category,
        status: t.status,
        isAcknowledged: t.is_acknowledged,
        managerName: t.manager_name,
        explanation: t.explanation,
      };
    } catch {
      // Offline fallback
      mockTaskUpdates[taskId] = {
        ...(mockTaskUpdates[taskId] || {}),
        status: (update.status as any) || mockTaskUpdates[taskId]?.status,
        isAcknowledged: update.is_acknowledged ?? mockTaskUpdates[taskId]?.isAcknowledged,
        explanation: update.explanation ?? mockTaskUpdates[taskId]?.explanation,
      };
      return {
        id: taskId,
        title: 'Task updated',
        status: (update.status as any) || 'COMPLETED',
        isAcknowledged: true,
        explanation: update.explanation,
      };
    }
  },

  /**
   * Bulk acknowledge today's tasks without completing them.
   */
  async acknowledgeTasks(channelSlug?: string): Promise<{ acknowledged_count: number }> {
    try {
      const res = await fetch(`${getPulseApiBase()}/tasks/acknowledge`, {
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ channel_slug: channelSlug || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { acknowledged_count: json.data.acknowledged_count };
    } catch {
      if (channelSlug) mockAcknowledgedSlugs.add(channelSlug.replace(/^#/, ''));
      return { acknowledged_count: 2 };
    }
  },
};
