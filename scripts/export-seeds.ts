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

// ----------------------------------------------------------------------------
// Structure & Contract Validation
// ----------------------------------------------------------------------------
function validateSeedPayload(payload: typeof seedPayload) {
  const requiredKeys = [
    'version',
    'exportedAt',
    'user',
    'leads',
    'recentCalls',
    'dailyTasks',
    'calendarInvites',
    'calendarCollaborators',
    'pulseChannels',
    'pulseThreads',
    'notifications',
  ];

  for (const key of requiredKeys) {
    if (!(key in payload) || (payload as Record<string, unknown>)[key] === undefined) {
      throw new Error(`Seed validation failed: missing top-level key '${key}'`);
    }
  }

  // Validate user
  if (!payload.user?.name || !payload.user?.store || !payload.user?.brand) {
    throw new Error('Seed validation failed: invalid user profile in seed data');
  }

  // Validate leads
  if (!Array.isArray(payload.leads) || payload.leads.length === 0) {
    throw new Error('Seed validation failed: leads must be a non-empty array');
  }
  for (const lead of payload.leads) {
    if (!lead.id || !lead.name || !lead.phone || !lead.interest || !lead.product) {
      throw new Error(`Seed validation failed: incomplete lead item: ${JSON.stringify(lead)}`);
    }
  }

  // Validate recentCalls
  if (!Array.isArray(payload.recentCalls) || payload.recentCalls.length === 0) {
    throw new Error('Seed validation failed: recentCalls must be a non-empty array');
  }

  // Validate pulse channels & threads
  if (!Array.isArray(payload.pulseChannels) || payload.pulseChannels.length === 0) {
    throw new Error('Seed validation failed: pulseChannels must be a non-empty array');
  }
  for (const ch of payload.pulseChannels) {
    if (!payload.pulseThreads[ch.id]) {
      throw new Error(`Seed validation failed: missing thread definition for channel '${ch.id}'`);
    }
  }

  return true;
}

validateSeedPayload(seedPayload);

fs.writeFileSync(outputFile, JSON.stringify(seedPayload, null, 2), 'utf-8');
console.log(`✅ Successfully validated and exported seeds to ${outputFile} (${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB)`);
