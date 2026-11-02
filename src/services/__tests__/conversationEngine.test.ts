import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationStateMachine } from '../conversationEngine';
import type { CallTarget } from '../../types';

describe('ConversationStateMachine & Turn Management', () => {
  const sureshTarget: CallTarget = {
    id: 'l5',
    name: 'Suresh Nair',
    initials: 'SN',
    phone: '+91 97654 32100',
    avatarBg: '#e1f5ee',
    avatarColor: '#0f6e56',
    intent: 'Ortho GRID Mattress',
  };

  const priyaTarget: CallTarget = {
    id: 'l8',
    name: 'Priya Iyer',
    initials: 'PI',
    phone: '+91 98450 67890',
    avatarBg: '#faeeda',
    avatarColor: '#854f0b',
    intent: 'EMI statement dispute',
  };

  it('outbound call has clean opening line awaiting agent greeting (no fake customer speech)', () => {
    const sm = new ConversationStateMachine(sureshTarget);
    const opening = sm.getOpeningLine();

    // Outbound calls should not fabricate unprompted customer speech
    expect(opening.hasSpeech).toBe(false);
    expect(sm.getCurrentStage()).toBe('greeting');
  });

  it('inbound call provides authentic opening line from caller', () => {
    const sm = new ConversationStateMachine(priyaTarget);
    const opening = sm.getOpeningLine();

    expect(opening.hasSpeech).toBe(true);
    expect(opening.text).toContain('₹1,200');
  });

  it('progresses naturally through sales stages based on agent speech', () => {
    const sm = new ConversationStateMachine(sureshTarget);

    // Turn 1: Agent Greeting
    const turn1 = sm.processAgentSpeech(
      'Hello Suresh, this is Arvind from The Sleep Company. Calling about your enquiry on our Ortho GRID mattress.',
      '0:05'
    );
    expect(turn1.customerReply).toBeTruthy();
    expect(turn1.customerReply).toContain('Hello Arvind');
    expect(sm.getCurrentStage()).toBe('discovery');
    expect(sm.getSopChecks().opening).toBe(true);

    // Turn 2: Agent Discovery Question
    const turn2 = sm.processAgentSpeech(
      'Could you share what sleeping posture you have and if you experience any back discomfort?',
      '0:15'
    );
    expect(turn2.customerReply).toContain('lower back stiffness');
    expect(sm.getCurrentStage()).toBe('pitch');
    expect(sm.getSopChecks().discovery).toBe(true);

    // Turn 3: Agent Pitches SmartGRID & Patented Polymer
    const turn3 = sm.processAgentSpeech(
      'Our patented SmartGRID structure adapts directly to your lumbar curve while open airflow channels keep it cool.',
      '0:30'
    );
    expect(turn3.customerReply).toContain('guarantee and trial period');
    expect(sm.getCurrentStage()).toBe('objection');
    expect(sm.getSopChecks().pitch).toBe(true);

    // Turn 4: Agent Resolves Warranty & 12-Month Zero-Cost EMI
    const turn4 = sm.processAgentSpeech(
      'You get a full 10-year warranty, a 100-night risk-free trial, and we have a 12-month zero-interest EMI on your card.',
      '0:50'
    );
    expect(turn4.sopFlag).toContain('Financing');
    expect(sm.getSopChecks().warranty).toBe(true);
    expect(sm.getSopChecks().emi).toBe(true);

    // Turn 5: Agent Closes with Showroom Demo & WhatsApp Quotation
    const turn5 = sm.processAgentSpeech(
      'I will send the official quotation to your WhatsApp right now, and reserve a private firmness test at our Koramangala store for Saturday at 4 PM.',
      '1:10'
    );
    expect(sm.getCurrentStage()).toBe('closing');
    expect(turn5.customerReply).toContain('WhatsApp');
    expect(sm.getSopChecks().closing).toBe(true);

    // Turn 6: Agent Signs off
    const turn6 = sm.processAgentSpeech(
      'Thank you Suresh, looking forward to seeing you this Saturday. Have a great day!',
      '1:25'
    );
    expect(turn6.callCompleted).toBe(true);
    expect(sm.getCurrentStage()).toBe('completed');
  });

  it('calculates final SOP compliance score with verbatim evidence', () => {
    const sm = new ConversationStateMachine(sureshTarget);

    sm.processAgentSpeech('Hello Suresh, Arvind from The Sleep Company calling.', '0:05');
    sm.processAgentSpeech('What kind of mattress firmness and posture support do you need?', '0:15');
    sm.processAgentSpeech('Our patented SmartGRID provides ergonomic lumbar relief.', '0:30');
    sm.processAgentSpeech('We offer a 10-year warranty, 100 nights trial, and 12-month zero-interest EMI.', '0:45');
    sm.processAgentSpeech('Sending details to your WhatsApp and reserving your Saturday demo.', '1:00');

    const score = sm.calculateFinalSopScore();
    expect(score).toBeGreaterThanOrEqual(90);

    const warrantyEvidence = sm.getEvidenceForCriterion('warranty');
    expect(warrantyEvidence.passed).toBe(true);
    expect(warrantyEvidence.evidence).toContain('10-year warranty');
  });

  it('handles unexpected inputs without crashing and maintains state', () => {
    const sm = new ConversationStateMachine(sureshTarget);
    const result = sm.processAgentSpeech('Okay.', '0:02');

    expect(result).toBeDefined();
    expect(sm.getCurrentStage()).toBe('greeting');
  });
});
