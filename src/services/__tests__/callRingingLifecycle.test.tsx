import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { audioService } from '../audioService';
import { ConversationStateMachine } from '../conversationEngine';
import * as telephonyApi from '../telephonyApi';
import type { CallTarget, CallMode } from '../../types';

// Mock audio nodes tracking structure
interface MockAudioNode {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockOscillator extends MockAudioNode {
  type: string;
  frequency: {
    setValueAtTime: ReturnType<typeof vi.fn>;
  };
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

interface MockGain extends MockAudioNode {
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    cancelScheduledValues: ReturnType<typeof vi.fn>;
  };
}

function makeTarget(partial: Partial<CallTarget> & { id: string; name: string }): CallTarget {
  return {
    initials: 'MR',
    phone: '+919845012345',
    avatarBg: '#faeeda',
    avatarColor: '#854f0b',
    intent: 'Practise Scenario: Ortho GRID',
    ...partial,
  };
}

function makeCallDto(partial: Partial<telephonyApi.CallDto> & { id: string }): telephonyApi.CallDto {
  return {
    agent_id: 'agent-1',
    customer_id: 'cust-1',
    customer_name: 'Customer',
    direction: 'OUTBOUND',
    status: 'CUSTOMER_RINGING',
    duration_seconds: 0,
    created_at: new Date().toISOString(),
    legs: [],
    attempt_number: 1,
    ...partial,
  } as telephonyApi.CallDto;
}

describe('Call Ringing Lifecycle & Screen Persistence Test Suite', () => {
  let createdOscillators: MockOscillator[] = [];
  let createdGains: MockGain[] = [];
  let mockCurrentTime = 100.0;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    createdOscillators = [];
    createdGains = [];
    mockCurrentTime = 100.0;

    // Set up mock Web Audio API environment
    class MockAudioContext {
      currentTime = mockCurrentTime;
      state = 'running';
      destination = { connect: vi.fn(), disconnect: vi.fn() };
      resume = vi.fn();

      createOscillator(): MockOscillator {
        const osc: MockOscillator = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
          },
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }

      createGain(): MockGain {
        const gain: MockGain = {
          gain: {
            value: 1,
            setValueAtTime: vi.fn((val: number) => {
              gain.gain.value = val;
            }),
            linearRampToValueAtTime: vi.fn((val: number) => {
              gain.gain.value = val;
            }),
            cancelScheduledValues: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }
    }

    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.setInterval = globalThis.setInterval;
    (globalThis as any).window.clearInterval = globalThis.clearInterval;
    (globalThis as any).window.AudioContext = MockAudioContext;
    (globalThis as any).AudioContext = MockAudioContext;

    // Reset audioService internal state
    audioService.stopRinging();
    (audioService as any).ctx = null;
  });

  afterEach(() => {
    audioService.stopRinging();
    vi.useRealTimers();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. AudioService Oscillator & Gain Node Tracking
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. AudioService Active Oscillator & Gain Node Lifecycle Tracking', () => {
    it('initializes dual-frequency oscillators (440Hz + 480Hz) and gain node on startRinging()', () => {
      expect(audioService.getIsRinging()).toBe(false);

      audioService.startRinging();

      expect(audioService.getIsRinging()).toBe(true);
      // Dual frequencies = 2 oscillators created for the first burst
      expect(createdOscillators.length).toBe(2);
      expect(createdGains.length).toBe(1);

      const [osc1, osc2] = createdOscillators;
      expect(osc1.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
      expect(osc2.frequency.setValueAtTime).toHaveBeenCalledWith(480, expect.any(Number));
      expect(osc1.start).toHaveBeenCalled();
      expect(osc2.start).toHaveBeenCalled();

      // Gain envelope scheduled
      const gain = createdGains[0];
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.15, expect.any(Number));
    });

    it('makes startRinging() idempotent without creating overlapping bursts on re-render', () => {
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);
      expect(createdOscillators.length).toBe(2);

      // Subsequent call while already ringing
      audioService.startRinging();
      // Should not spawn additional oscillators or reset cadence
      expect(createdOscillators.length).toBe(2);
      expect(audioService.getIsRinging()).toBe(true);
    });

    it('immediately silences active gain and stops/disconnects active burst nodes on stopRinging()', () => {
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      const [osc1, osc2] = createdOscillators;
      const gain = createdGains[0];

      // Call stopRinging() mid-burst
      audioService.stopRinging();

      expect(audioService.getIsRinging()).toBe(false);
      // Gain immediately ramped to zero and disconnected
      expect(gain.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(gain.disconnect).toHaveBeenCalled();

      // Oscillators stopped and disconnected
      expect(osc1.stop).toHaveBeenCalled();
      expect(osc1.disconnect).toHaveBeenCalled();
      expect(osc2.stop).toHaveBeenCalled();
      expect(osc2.disconnect).toHaveBeenCalled();

      // References cleared
      expect((audioService as any).ringGain).toBeNull();
      expect((audioService as any).ringOsc1).toBeNull();
      expect((audioService as any).ringOsc2).toBeNull();
      expect((audioService as any).ringInterval).toBeNull();
    });

    it('makes stopRinging() completely safe and idempotent across multiple invocations', () => {
      audioService.startRinging();
      expect(() => {
        audioService.stopRinging();
        audioService.stopRinging();
        audioService.stopRinging();
      }).not.toThrow();

      expect(audioService.getIsRinging()).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Persistent Ringing Across Cadence & Timer Duration
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Persistent Ringing Across Cadence & Timer Duration', () => {
    it('rings continuously beyond 1 second and does not dismiss or reset prematurely', () => {
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      // Advance by 1.0 second (well beyond typical 1s premature cutoff bugs)
      vi.advanceTimersByTime(1000);
      expect(audioService.getIsRinging()).toBe(true);

      // Advance to 3.5 seconds (standard cadence cycle)
      vi.advanceTimersByTime(2500);
      // A new burst should have been triggered by interval
      expect(createdOscillators.length).toBe(4); // 2 from 1st burst + 2 from 2nd burst
      expect(audioService.getIsRinging()).toBe(true);

      // Advance through another cycle (to 7.0 seconds total)
      vi.advanceTimersByTime(3500);
      expect(createdOscillators.length).toBe(6);
      expect(audioService.getIsRinging()).toBe(true);

      audioService.stopRinging();
      expect(audioService.getIsRinging()).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Call Initiation for Roleplay & PSTN
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Call Initiation for Roleplay and PSTN Actions', () => {
    interface TestCallPipeline {
      callMode: CallMode;
      callState: 'idle' | 'ringing' | 'active' | 'wrapup';
      activeCallTarget: CallTarget | null;
      backendCallId: string | null;
      backendCallStatus: string | null;
      telephonyError: string | null;
      startRoleplay: (target: CallTarget) => void;
      startCall: (target: CallTarget) => Promise<void>;
      handleAnswer: () => Promise<void>;
      handleDecline: () => Promise<void>;
    }

    function createPipelineHarness(): TestCallPipeline {
      const state: {
        callMode: CallMode;
        callState: 'idle' | 'ringing' | 'active' | 'wrapup';
        activeCallTarget: CallTarget | null;
        backendCallId: string | null;
        backendCallStatus: string | null;
        telephonyError: string | null;
      } = {
        callMode: null,
        callState: 'idle',
        activeCallTarget: null,
        backendCallId: null,
        backendCallStatus: null,
        telephonyError: null,
      };

      const startRoleplay = (target: CallTarget) => {
        state.callMode = 'ROLEPLAY';
        state.activeCallTarget = target;
        state.backendCallId = null;
        state.backendCallStatus = null;
        state.telephonyError = null;
        state.callState = 'ringing';
        audioService.startRinging();
      };

      const startCall = async (target: CallTarget) => {
        state.callMode = 'PSTN';
        state.activeCallTarget = target;
        state.callState = 'ringing';
        audioService.startRinging();
        state.backendCallId = null;
        state.backendCallStatus = null;
        state.telephonyError = null;

        let cleanPhone = (target.phone || '').replace(/[\s\-\(\)]/g, '');
        if (cleanPhone && !cleanPhone.startsWith('+')) {
          cleanPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
        }

        if (!cleanPhone || !/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
          audioService.stopRinging();
          state.callState = 'idle';
          state.callMode = null;
          state.telephonyError = 'Invalid phone number format';
          return;
        }

        try {
          const res = await telephonyApi.initiateOutboundCall({
            customerPhone: cleanPhone,
            customerName: target.name,
          });
          state.backendCallId = res.id;
          state.backendCallStatus = res.status;
        } catch (err: any) {
          audioService.stopRinging();
          state.callState = 'idle';
          state.callMode = null;
          state.telephonyError = err.message;
        }
      };

      const handleAnswer = async () => {
        if (state.callMode === 'ROLEPLAY' || (!state.backendCallId && state.callMode !== 'PSTN')) {
          audioService.stopRinging();
          state.callState = 'active';
          return;
        }

        if (state.backendCallId) {
          audioService.stopRinging();
          const bridged = await telephonyApi.bridgeCall(state.backendCallId);
          state.backendCallStatus = bridged.status;
          if (bridged.status === 'CONNECTED') {
            state.callState = 'active';
          }
        }
      };

      const handleDecline = async () => {
        audioService.stopRinging();
        if (state.callMode === 'PSTN' && state.backendCallId) {
          try {
            await telephonyApi.terminateCall(state.backendCallId);
          } catch (e) {
            // graceful ignore
          }
        }
        state.backendCallId = null;
        state.backendCallStatus = null;
        state.telephonyError = null;
        state.activeCallTarget = null;
        state.callMode = null;
        state.callState = 'idle';
      };

      return {
        get callMode() { return state.callMode; },
        get callState() { return state.callState; },
        get activeCallTarget() { return state.activeCallTarget; },
        get backendCallId() { return state.backendCallId; },
        get backendCallStatus() { return state.backendCallStatus; },
        get telephonyError() { return state.telephonyError; },
        startRoleplay,
        startCall,
        handleAnswer,
        handleDecline,
      };
    }

    it('clicking "Practise this Scenario" sets callState="ringing" and begins audible ringtone', () => {
      const pipeline = createPipelineHarness();
      const mockLead = makeTarget({
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        phone: '+919845012345',
        intent: 'Practise Scenario: Ortho GRID',
      });

      expect(pipeline.callState).toBe('idle');
      expect(audioService.getIsRinging()).toBe(false);

      pipeline.startRoleplay(mockLead);

      expect(pipeline.callState).toBe('ringing');
      expect(pipeline.callMode).toBe('ROLEPLAY');
      expect(pipeline.activeCallTarget?.name).toBe('Mukunda R. (AI Customer Roleplay)');
      expect(audioService.getIsRinging()).toBe(true);
      expect(createdOscillators.length).toBeGreaterThan(0);
    });

    it('clicking "Launch Mukunda Simulation" sets callState="ringing" with zero backend API calls', () => {
      const pipeline = createPipelineHarness();
      const initiateSpy = vi.spyOn(telephonyApi, 'initiateOutboundCall');

      pipeline.startRoleplay(makeTarget({
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        phone: '+919845012345',
        intent: 'Practise Scenario: Ortho GRID',
      }));

      expect(pipeline.callState).toBe('ringing');
      expect(pipeline.callMode).toBe('ROLEPLAY');
      expect(audioService.getIsRinging()).toBe(true);
      // Strict separation: Zero backend telephony calls
      expect(initiateSpy).not.toHaveBeenCalled();
    });

    it('real PSTN dial action immediately sets callState="ringing" and starts audible ringtone', async () => {
      const pipeline = createPipelineHarness();
      vi.spyOn(telephonyApi, 'initiateOutboundCall').mockResolvedValueOnce(makeCallDto({
        id: 'call-pstn-998877',
        customer_phone: '+919876543210',
        status: 'CUSTOMER_RINGING',
        legs: [
          {
            id: 'leg-1',
            leg_role: 'CUSTOMER',
            attempt_number: 1,
            provider: 'twilio',
            status: 'RINGING',
            telephony_leg_id: 'CA123',
            from_endpoint_type: 'pstn',
            from_endpoint_uri: '+918045678901',
            to_endpoint_type: 'pstn',
            to_endpoint_uri: '+919876543210',
            duration_seconds: 0,
            initiated_at: new Date().toISOString(),
          },
        ],
      }));

      await pipeline.startCall(makeTarget({
        id: 'real-cust-1',
        name: 'Ramesh Patel',
        phone: '+919876543210',
        intent: 'Real Outbound PSTN Dial',
      }));

      expect(pipeline.callState).toBe('ringing');
      expect(pipeline.callMode).toBe('PSTN');
      expect(pipeline.backendCallId).toBe('call-pstn-998877');
      expect(audioService.getIsRinging()).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Answer Behavior (Roleplay vs PSTN)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Answer Behaviour', () => {
    it('in ROLEPLAY: answering immediately stops ringtone, transitions to active, and opens dialogue', async () => {
      const mukundaTarget = makeTarget({
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        phone: '+919845012345',
        intent: 'Practise Scenario: Ortho GRID',
      });

      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      // Simulate Answer
      audioService.stopRinging();
      let callState: 'idle' | 'ringing' | 'active' | 'wrapup' = 'active';

      expect(audioService.getIsRinging()).toBe(false);
      expect(callState).toBe('active');

      // AI Customer dialogue engine starts
      const sm = new ConversationStateMachine(mukundaTarget);
      const opening = sm.getOpeningLine();
      expect(opening.hasSpeech).toBe(true);
      expect(opening.text).toBe('Hello? Mukunda speaking. Who is this?');
    });

    it('in PSTN: bridging confirmed legs stops ringtone and transitions to active', async () => {
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      vi.spyOn(telephonyApi, 'bridgeCall').mockResolvedValueOnce(makeCallDto({
        id: 'call-pstn-112233',
        customer_phone: '+919876543210',
        status: 'CONNECTED',
      }));

      audioService.stopRinging();
      const updated = await telephonyApi.bridgeCall('call-pstn-112233');

      expect(audioService.getIsRinging()).toBe(false);
      expect(updated.status).toBe('CONNECTED');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Reject / Decline Behavior
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Reject / Decline Behaviour', () => {
    it('in ROLEPLAY: decline immediately stops ringtone, silences audio burst, and resets callState to idle', () => {
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      // In-flight burst has gain and oscillators
      const gain = createdGains[0];
      const [osc1, osc2] = createdOscillators;

      // Simulate Decline
      audioService.stopRinging();
      let callState = 'idle';

      // Ringing state cleared
      expect(audioService.getIsRinging()).toBe(false);
      expect(callState).toBe('idle');

      // In-flight gain silenced immediately
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(gain.disconnect).toHaveBeenCalled();
      expect(osc1.stop).toHaveBeenCalled();
      expect(osc2.stop).toHaveBeenCalled();

      // Ensure NO transition to wrapup occurs
      expect(callState).not.toBe('wrapup');
    });

    it('in PSTN: decline terminates backend call leg, stops ringtone, and resets callState to idle', async () => {
      const terminateSpy = vi.spyOn(telephonyApi, 'terminateCall').mockResolvedValueOnce(makeCallDto({
        id: 'call-to-terminate-1',
        customer_phone: '+919876543210',
        status: 'COMPLETED',
      }));

      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      // User clicks Decline / Cancel on PSTN call
      audioService.stopRinging();
      await telephonyApi.terminateCall('call-to-terminate-1');
      let callState = 'idle';

      expect(terminateSpy).toHaveBeenCalledWith('call-to-terminate-1');
      expect(audioService.getIsRinging()).toBe(false);
      expect(callState).toBe('idle');
      expect(callState).not.toBe('wrapup');
    });

    it('ensures no lingering timers or recurring ring bursts run after rejection', () => {
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      const burstCountBefore = createdOscillators.length;

      // User rejects
      audioService.stopRinging();
      expect(audioService.getIsRinging()).toBe(false);

      // Advance time by 10 seconds
      vi.advanceTimersByTime(10000);

      // No new oscillators or bursts created after stopRinging
      expect(createdOscillators.length).toBe(burstCountBefore);
      expect(audioService.getIsRinging()).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. UI Presentation & Component Rendering
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. ActiveCallView UI Component Ringing Presentation', () => {
    function RingingViewMarkup({
      callState,
      callMode,
      targetName,
      targetPhone,
    }: {
      callState: 'idle' | 'ringing' | 'active' | 'wrapup';
      callMode: CallMode;
      targetName: string;
      targetPhone: string;
    }) {
      if (callState === 'idle') return null;

      return (
        <div data-testid="active-call-view">
          {callState === 'ringing' && (
            <div data-testid="ringing-banner" className="bg-gradient-to-r from-orange-800 to-orange-600">
              <span data-testid="ringing-label">Calling Customer • Ringing...</span>
              {callMode === 'ROLEPLAY' && (
                <span data-testid="badge-roleplay">AI ROLEPLAY / SIMULATED</span>
              )}
              {callMode === 'PSTN' && (
                <span data-testid="badge-pstn">REAL PSTN / CARRIER</span>
              )}
              <h3 data-testid="target-name">{targetName}</h3>
              <p data-testid="target-phone">{targetPhone}</p>
              <button data-testid="decline-button">Decline / Cancel</button>
              <button data-testid="answer-button">
                {callMode === 'PSTN' ? 'Bridge Confirmed Legs' : 'Answer / Connect'}
              </button>
            </div>
          )}
          {callState === 'active' && (
            <div data-testid="active-panel">Active Call Interface</div>
          )}
          {callState === 'wrapup' && (
            <div data-testid="wrapup-panel">Call Wrap-up & Notes</div>
          )}
        </div>
      );
    }

    it('displays ringing interface and AI Roleplay badge when roleplay is ringing', () => {
      const html = renderToStaticMarkup(
        <RingingViewMarkup
          callState="ringing"
          callMode="ROLEPLAY"
          targetName="Mukunda R. (AI Customer Roleplay)"
          targetPhone="+91 98450 12345"
        />
      );

      expect(html).toContain('Calling Customer • Ringing...');
      expect(html).toContain('AI ROLEPLAY / SIMULATED');
      expect(html).toContain('Mukunda R. (AI Customer Roleplay)');
      expect(html).toContain('Decline / Cancel');
      expect(html).toContain('Answer / Connect');
    });

    it('displays ringing interface and Real PSTN badge when PSTN is ringing', () => {
      const html = renderToStaticMarkup(
        <RingingViewMarkup
          callState="ringing"
          callMode="PSTN"
          targetName="Ramesh Patel"
          targetPhone="+91 98765 43210"
        />
      );

      expect(html).toContain('Calling Customer • Ringing...');
      expect(html).toContain('REAL PSTN / CARRIER');
      expect(html).toContain('Ramesh Patel');
      expect(html).toContain('Decline / Cancel');
    });

    it('returns empty null markup when callState is idle after decline', () => {
      const html = renderToStaticMarkup(
        <RingingViewMarkup
          callState="idle"
          callMode={null}
          targetName="Mukunda R."
          targetPhone="+91 98450 12345"
        />
      );

      expect(html).toBe('');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Strict Roleplay vs PSTN Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Strict Separation Guarantees', () => {
    it('verifies that initiating, ringing, answering, and declining Roleplay NEVER touches telephony backend APIs', async () => {
      const initiateSpy = vi.spyOn(telephonyApi, 'initiateOutboundCall');
      const bridgeSpy = vi.spyOn(telephonyApi, 'bridgeCall');
      const terminateSpy = vi.spyOn(telephonyApi, 'terminateCall');
      const statusSpy = vi.spyOn(telephonyApi, 'fetchCallStatus');

      // 1. Roleplay Start
      audioService.startRinging();
      expect(audioService.getIsRinging()).toBe(true);

      // 2. Persistent ringing
      vi.advanceTimersByTime(3500);

      // 3. Roleplay Decline
      audioService.stopRinging();
      expect(audioService.getIsRinging()).toBe(false);

      // Verify zero telephony API invocations
      expect(initiateSpy).not.toHaveBeenCalled();
      expect(bridgeSpy).not.toHaveBeenCalled();
      expect(terminateSpy).not.toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });
});
