import { describe, it, expect } from 'vitest';
import {
  CALENDAR_COLLABORATORS,
  generateSessionSlug,
  generateSessionUrl,
  formatSessionDateTime,
  formatWhatsAppInvite,
  generateWhatsAppShareUrl,
  formatPulseInviteMessage,
  validateCollaboratorSelection,
} from '../calendarService';
import type { CalendarInvite } from '../../types';

describe('Calendar Collaboration & Invitation Service', () => {
  const sampleInvite: CalendarInvite = {
    day: 3,
    time: '11:00 AM',
    title: 'SOP coaching session',
    meta: 'With Sunita Rao (Manager) · via #callcentre-team',
  };

  describe('Collaborators Catalog', () => {
    it('defines the three required collaborators from the design specification', () => {
      expect(CALENDAR_COLLABORATORS.length).toBe(3);
      const ids = CALENDAR_COLLABORATORS.map((c) => c.id);
      expect(ids).toEqual(['sunita', 'callcentre', 'fahmy']);
    });

    it('assigns distinctive avatars, roles, and color badges to each collaborator', () => {
      const sunita = CALENDAR_COLLABORATORS.find((c) => c.id === 'sunita');
      expect(sunita?.name).toBe('Sunita Rao');
      expect(sunita?.role).toBe('Manager');
      expect(sunita?.initials).toBe('SR');
      expect(sunita?.color).toBe('#854f0b');

      const callcentre = CALENDAR_COLLABORATORS.find((c) => c.id === 'callcentre');
      expect(callcentre?.name).toBe('Call Centre Team');
      expect(callcentre?.role).toBe('#callcentre-team');
      expect(callcentre?.initials).toBe('CC');
      expect(callcentre?.color).toBe('#6d28d9');

      const fahmy = CALENDAR_COLLABORATORS.find((c) => c.id === 'fahmy');
      expect(fahmy?.name).toBe('Fahmy');
      expect(fahmy?.role).toBe('Learning & Development');
      expect(fahmy?.initials).toBe('FA');
      expect(fahmy?.color).toBe('#185fa5');
    });
  });

  describe('Session Slug & URL Generation', () => {
    it('generates a clean, kebab-case session slug based on day and title', () => {
      const slug = generateSessionSlug(sampleInvite);
      expect(slug).toBe('meet-nov3-sop-coaching-session');
    });

    it('handles special characters and symbols safely in session slug', () => {
      const specialInvite = {
        day: 12,
        title: 'Product training: SmartGRID Luxe (Special & New!)',
      };
      const slug = generateSessionSlug(specialInvite);
      expect(slug).toBe('meet-nov12-product-training-smartgrid-luxe-special-new');
    });

    it('generates a valid SPA URL resolving to calendar view with session query parameter', () => {
      const url = generateSessionUrl(sampleInvite, 'https://oncall-ashy.vercel.app');
      expect(url).toBe('https://oncall-ashy.vercel.app/?view=calendar&session=meet-nov3-sop-coaching-session');
    });

    it('falls back to default production origin if no origin or window is supplied', () => {
      const url = generateSessionUrl(sampleInvite);
      expect(url).toContain('/?view=calendar&session=meet-nov3-sop-coaching-session');
    });
  });

  describe('Session Date/Time Formatting', () => {
    it('formats human-readable date and time for November 3, 2026', () => {
      const formatted = formatSessionDateTime(3, '11:00 AM', 2026, 10);
      expect(formatted).toBe('Tuesday, November 3 · 11:00 AM');
    });

    it('formats date and time correctly for another day', () => {
      const formatted = formatSessionDateTime(14, '11:30 AM', 2026, 10);
      expect(formatted).toBe('Saturday, November 14 · 11:30 AM');
    });
  });

  describe('Multi-Channel Sharing Formats', () => {
    const selected = [CALENDAR_COLLABORATORS[0], CALENDAR_COLLABORATORS[1]]; // Sunita and Call Centre
    const sessionUrl = 'https://oncall-ashy.vercel.app/?view=calendar&session=meet-nov3-sop-coaching-session';

    it('formats structured WhatsApp message card with invited collaborators and session link', () => {
      const waText = formatWhatsAppInvite(sampleInvite, selected, sessionUrl);
      expect(waText).toContain('*Team Session Invitation: SOP coaching session*');
      expect(waText).toContain('November 3, 2026 at 11:00 AM');
      expect(waText).toContain('With Sunita Rao (Manager) · via #callcentre-team');
      expect(waText).toContain('👥 *Invited:* Sunita Rao, Call Centre Team');
      expect(waText).toContain(sessionUrl);
    });

    it('generates a valid https://wa.me/?text= deep-link with URL-encoded payload', () => {
      const waUrl = generateWhatsAppShareUrl(sampleInvite, selected, sessionUrl);
      expect(waUrl.startsWith('https://wa.me/?text=')).toBe(true);
      expect(waUrl).toContain(encodeURIComponent('SOP coaching session'));
      expect(waUrl).toContain(encodeURIComponent(sessionUrl));
    });

    it('formats clear Pulse channel invitation message with date, time, and recipients', () => {
      const pulseMsg = formatPulseInviteMessage(sampleInvite, selected, sessionUrl);
      expect(pulseMsg).toContain('📅 Session Invitation: "SOP coaching session" on Nov 3 at 11:00 AM');
      expect(pulseMsg).toContain('(Invited: Sunita Rao, Call Centre Team)');
      expect(pulseMsg).toContain(`Join session: ${sessionUrl}`);
    });
  });

  describe('Collaborator Selection Validation', () => {
    it('passes validation when at least one collaborator is selected', () => {
      const result = validateCollaboratorSelection(['sunita']);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('fails validation with descriptive message when no collaborator is selected', () => {
      const result = validateCollaboratorSelection([]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please select at least one recipient to prepare the invitation.');
    });
  });
});
