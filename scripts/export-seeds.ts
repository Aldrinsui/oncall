import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as mockData from '../src/data/mockData.js';
import { CALENDAR_COLLABORATORS } from '../src/services/calendarService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, '../backend/fixtures');
const outputFile = path.join(outputDir, 'seed_data.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const seedPayload = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  user: mockData.USER,
  leads: mockData.LEADS,
  recentCalls: mockData.RECENT_CALLS,
  incomingCalls: mockData.INCOMING_CALLS,
  dailyTasks: mockData.DAILY_TASKS,
  calendarInvites: mockData.CALENDAR_INVITES,
  calendarCollaborators: CALENDAR_COLLABORATORS,
  pulseChannels: mockData.PULSE_CHANNELS,
  pulseThreads: mockData.PULSE_THREADS,
  notifications: mockData.NOTIFICATIONS,
  chartData: mockData.CHART_DATA,
  agentRoles: mockData.AGENT_ROLES,
  sellingPersonas: mockData.SELLING_PERSONAS,
};

fs.writeFileSync(outputFile, JSON.stringify(seedPayload, null, 2), 'utf-8');
console.log(`✅ Successfully exported seeds to ${outputFile}`);
