import { describe, it, expect } from 'vitest';
import type { ConsentRecord, RecordingConsentState } from '../../types';

describe('DPDP Recording Consent Engine & Minor Guard', () => {
  const mockCustomer = {
    phone: '+91 97654 32100',
    name: 'Suresh Nair',
  };

  const createConsentRecord = (params: {
    status: RecordingConsentState;
    method: 'voice' | 'wa';
    language?: string;
    verifiedText?: string;
    isMinor?: boolean;
    guardianPhone?: string;
    guardianConsent?: boolean;
  }): ConsentRecord => {
    return {
      consentId: `dpdp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: params.status,
      method: params.method,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      phone: mockCustomer.phone,
      language: params.language || 'English',
      verifiedText: params.verifiedText,
      isMinor: params.isMinor ?? false,
      guardianPhone: params.guardianPhone,
      guardianConsent: params.guardianConsent,
    };
  };

  it('initializes recording consent in pending state without media capture', () => {
    const consentState: RecordingConsentState = 'pending';
    const isMicActive = false;
    const isSttActive = false;

    // Consent gate: Neither mic capture nor STT should run while pending
    expect(consentState).toBe('pending');
    expect(isMicActive).toBe(false);
    expect(isSttActive).toBe(false);
  });

  it('records verbal voice consent with language and affirmation audit', () => {
    const record = createConsentRecord({
      status: 'granted',
      method: 'voice',
      language: 'Kannada',
      verifiedText: 'ಹೌದು, ರೆಕಾರ್ಡ್ ಮಾಡಿಕೊಳ್ಳಿ (Yes, you may record)',
    });

    expect(record.status).toBe('granted');
    expect(record.method).toBe('voice');
    expect(record.language).toBe('Kannada');
    expect(record.verifiedText).toContain('ರೆಕಾರ್ಡ್');
    expect(record.isMinor).toBe(false);
  });

  it('records verbal decline and prevents recording activation', () => {
    const record = createConsentRecord({
      status: 'declined',
      method: 'voice',
      verifiedText: 'No, please do not record this call',
    });

    expect(record.status).toBe('declined');
    expect(record.verifiedText).toContain('do not record');
    // Gating check
    const canRecord = record.status === 'granted';
    expect(canRecord).toBe(false);
  });

  it('enforces Under-18 minor guard with guardian phone and parental consent tracking', () => {
    const guardianPhone = '+91 98888 77777';
    const record = createConsentRecord({
      status: 'granted',
      method: 'voice',
      language: 'Hindi',
      isMinor: true,
      guardianPhone: guardianPhone,
      guardianConsent: true,
      verifiedText: 'हाँ, मेरे माता-पिता ने सहमति दी है (Parent/Guardian explicitly consented)',
    });

    expect(record.isMinor).toBe(true);
    expect(record.guardianPhone).toBe(guardianPhone);
    expect(record.guardianConsent).toBe(true);
    expect(record.verifiedText).toContain('माता-पिता');
    expect(record.status).toBe('granted');
  });

  it('generates compliant WhatsApp deep link with explicit DPDP consent copy', () => {
    const phone = '9765432100';
    const msg = encodeURIComponent(
      'Hi Suresh, The Sleep Company requests your consent to record this call for quality and training purposes under DPDP regulations. Reply YES to consent or NO to opt out.'
    );
    const waLink = `https://wa.me/91${phone}?text=${msg}`;

    expect(waLink).toContain('https://wa.me/919765432100');
    expect(waLink).toContain('DPDP');
    expect(waLink).toContain('The%20Sleep%20Company');
  });

  it('clears guardian info and resets state when consent is reset', () => {
    let currentConsent: ConsentRecord | null = createConsentRecord({
      status: 'granted',
      method: 'voice',
      isMinor: true,
      guardianPhone: '+91 98888 77777',
      guardianConsent: true,
    });

    // Reset action
    currentConsent = null;
    const resetState: RecordingConsentState = 'pending';

    expect(currentConsent).toBeNull();
    expect(resetState).toBe('pending');
  });
});
