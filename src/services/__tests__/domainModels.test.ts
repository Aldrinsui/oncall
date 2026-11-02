import { describe, it, expect } from 'vitest';
import { SELLING_PERSONAS, USER, LEADS } from '../../data/mockData';
import type { SellingPersonaId } from '../../types';

describe('Domain Models & Personas Specification', () => {
  it('defines exactly the 5 required selling personas from the mock specification', () => {
    const expectedIds: SellingPersonaId[] = ['atlas', 'nyra', 'kairo', 'zephyr', 'onyx'];
    const personaIds = SELLING_PERSONAS.map(p => p.id);

    expect(personaIds).toEqual(expectedIds);
    expect(SELLING_PERSONAS.length).toBe(5);
  });

  it('ensures each selling persona has unique emojis, ring colors, and titles', () => {
    const titles = new Set(SELLING_PERSONAS.map(p => p.title));
    const emojis = new Set(SELLING_PERSONAS.map(p => p.emoji));
    const ringColors = new Set(SELLING_PERSONAS.map(p => p.ringColor));

    expect(titles.size).toBe(5);
    expect(emojis.size).toBe(5);
    expect(ringColors.size).toBe(5);
  });

  it('Atlas persona matches the Closer archetype with high-velocity badge', () => {
    const atlas = SELLING_PERSONAS.find(p => p.id === 'atlas');
    expect(atlas).toBeDefined();
    expect(atlas?.name).toBe('Atlas');
    expect(atlas?.title).toBe('The Closer');
    expect(atlas?.badge).toBe('High Velocity');
    expect(atlas?.ringColor).toBe('#1d9e75');
  });

  it('Nyra persona matches the Consultant archetype with relationship-builder badge', () => {
    const nyra = SELLING_PERSONAS.find(p => p.id === 'nyra');
    expect(nyra).toBeDefined();
    expect(nyra?.name).toBe('Nyra');
    expect(nyra?.title).toBe('The Consultant');
    expect(nyra?.badge).toBe('Relationship Builder');
  });

  it('maintains agent profile and OG score metrics', () => {
    expect(USER.name).toBe('Arvind Rajan');
    expect(USER.brand).toBe('The Sleep Company');
    expect(USER.ogScore).toBe(76);
  });

  it('validates lead attractiveness levels and properties', () => {
    expect(LEADS.length).toBeGreaterThan(0);
    LEADS.forEach(lead => {
      expect(lead.attractivenessScore).toBeGreaterThanOrEqual(0);
      expect(lead.attractivenessScore).toBeLessThanOrEqual(100);
      expect(lead.expectedValue).toBeGreaterThan(0);
      expect(typeof lead.name).toBe('string');
      expect(typeof lead.phone).toBe('string');
    });
  });
});
