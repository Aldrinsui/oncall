import type { CalendarInvite } from '../types';

export interface Collaborator {
  id: string;
  name: string;
  role: string;
  initials: string;
  bg: string;
  color: string;
}

export const CALENDAR_COLLABORATORS: Collaborator[] = [
  {
    id: 'sunita',
    name: 'Sunita Rao',
    role: 'Manager',
    initials: 'SR',
    bg: '#faeeda',
    color: '#854f0b',
  },
  {
    id: 'callcentre',
    name: 'Call Centre Team',
    role: '#callcentre-team',
    initials: 'CC',
    bg: '#f3e8ff',
    color: '#6d28d9',
  },
  {
    id: 'fahmy',
    name: 'Fahmy',
    role: 'Learning & Development',
    initials: 'FA',
    bg: '#e8f0fe',
    color: '#185fa5',
  },
];

/**
 * Generates a clean, URL-safe slug for a calendar session.
 * Example: "meet-nov3-sop-coaching-session"
 */
export function generateSessionSlug(invite: Pick<CalendarInvite, 'day' | 'title'>): string {
  const cleanTitle = invite.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `meet-nov${invite.day}-${cleanTitle || 'session'}`;
}

/**
 * Generates a valid SPA session URL resolving to the Calendar view.
 * Uses window.location.origin when available in browser or falls back to production origin.
 */
export function generateSessionUrl(
  invite: Pick<CalendarInvite, 'day' | 'title'>,
  originOverride?: string
): string {
  let origin = originOverride;
  if (!origin) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      origin = window.location.origin;
    } else {
      origin = 'https://oncall-ashy.vercel.app';
    }
  }
  const slug = generateSessionSlug(invite);
  return `${origin}/?view=calendar&session=${slug}`;
}

/**
 * Formats full human-readable date & time for session cards.
 * Example: "Tuesday, November 3 · 11:00 AM"
 */
export function formatSessionDateTime(
  day: number,
  time: string,
  year = 2026,
  month = 10 // November (0-indexed)
): string {
  const date = new Date(year, month, day);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday}, ${monthName} ${day} · ${time}`;
}

/**
 * Builds formatted WhatsApp invitation text.
 */
export function formatWhatsAppInvite(
  invite: CalendarInvite,
  collaborators: Collaborator[],
  sessionUrl: string
): string {
  const recipientList = collaborators.map((c) => c.name).join(', ');
  const parts = [
    `*Team Session Invitation: ${invite.title}*`,
    `📅 *When:* November ${invite.day}, 2026 at ${invite.time}`,
    `📍 *Details:* ${invite.meta}`,
  ];
  if (recipientList) {
    parts.push(`👥 *Invited:* ${recipientList}`);
  }
  parts.push(`🔗 *Join Session:* ${sessionUrl}`);
  parts.push(`\n_Sent via OnGround Call Centre_`);

  return parts.join('\n');
}

/**
 * Generates deep-link URL for WhatsApp sharing.
 */
export function generateWhatsAppShareUrl(
  invite: CalendarInvite,
  collaborators: Collaborator[],
  sessionUrl: string
): string {
  const message = formatWhatsAppInvite(invite, collaborators, sessionUrl);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Formats a message to post into a Pulse channel (#callcentre-team).
 */
export function formatPulseInviteMessage(
  invite: CalendarInvite,
  collaborators: Collaborator[],
  sessionUrl: string
): string {
  const recipientNames = collaborators.map((c) => c.name).join(', ');
  const invitedPart = recipientNames ? ` (Invited: ${recipientNames})` : '';
  return `📅 Session Invitation: "${invite.title}" on Nov ${invite.day} at ${invite.time}${invitedPart}. Join session: ${sessionUrl}`;
}

/**
 * Validates that at least one collaborator is selected.
 */
export function validateCollaboratorSelection(selectedIds: string[]): {
  isValid: boolean;
  error?: string;
} {
  if (!selectedIds || selectedIds.length === 0) {
    return {
      isValid: false,
      error: 'Please select at least one recipient to prepare the invitation.',
    };
  }
  return { isValid: true };
}
