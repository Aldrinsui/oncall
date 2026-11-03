import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationStateMachine, CUSTOMER_PERSONAS } from '../conversationEngine';
import type { CallMode, CallTarget, RecentCall } from '../../types';
import { Sparkles, Phone, PhoneOff } from 'lucide-react';

describe('Roleplay vs PSTN Calling Separation Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. ConversationStateMachine Roleplay Detection & Prompt Pickup', () => {
    it('sets isRoleplay=true when target intent or name contains roleplay or practise', () => {
      const roleplayTarget = {
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        intent: 'Practise Scenario: Ortho GRID Mattress',
      };
      const sm = new ConversationStateMachine(roleplayTarget);
      expect((sm as any).isRoleplay).toBe(true);
    });

    it('sets isRoleplay=false for regular outbound leads', () => {
      const realTarget = {
        id: 'l1',
        name: 'Mukunda R.',
        intent: 'High Intent Outbound Call',
      };
      const sm = new ConversationStateMachine(realTarget);
      expect((sm as any).isRoleplay).toBe(false);
    });

    it('returns roleplayOpening on getOpeningLine for roleplay simulation', () => {
      const mukundaTarget = {
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        intent: 'Practise Scenario: Ortho GRID',
      };
      const smMukunda = new ConversationStateMachine(mukundaTarget);
      const openingMukunda = smMukunda.getOpeningLine();
      expect(openingMukunda.hasSpeech).toBe(true);
      expect(openingMukunda.text).toBe('Hello? Mukunda speaking. Who is this?');
      expect(smMukunda.getState()).toBe('agent_listening');

      const sureshTarget = {
        id: 'l5',
        name: 'Suresh Nair (AI Customer Roleplay)',
        intent: 'Practise Scenario',
      };
      const smSuresh = new ConversationStateMachine(sureshTarget);
      const openingSuresh = smSuresh.getOpeningLine();
      expect(openingSuresh.hasSpeech).toBe(true);
      expect(openingSuresh.text).toBe('Hello? Suresh here.');
    });

    it('prevents customer speech leak for regular outbound PSTN calls', () => {
      const outboundTarget = {
        id: 'l1',
        name: 'Mukunda R.',
        intent: 'Interested in Ortho GRID',
      };
      const sm = new ConversationStateMachine(outboundTarget);
      const opening = sm.getOpeningLine();
      expect(opening.hasSpeech).toBe(false);
      expect(opening.text).toBe('');
      expect(sm.getState()).toBe('agent_listening');
    });

    it('handles agent greeting after roleplay opening and achieves Opening & Intent Confirm SOP', () => {
      const roleplayTarget = {
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        intent: 'Practise Scenario: Ortho GRID',
      };
      const sm = new ConversationStateMachine(roleplayTarget);
      const res = sm.processAgentSpeech('Hello Mukunda! Arvind from The Sleep Company Koramangala.', '0:05');
      expect(res.sopFlag).toBe('Opening & Intent Confirm');
      expect(res.customerReply).toContain('Hello Arvind! Thanks for following up.');
      expect(sm.getCurrentStage()).toBe('discovery');
    });
  });

  describe('2. Pure Simulation State & Dispatch Separation (startRoleplay vs startCall)', () => {
    interface AppCallStateHarness {
      callMode: CallMode;
      callState: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review';
      activeView: string;
      planTab: string;
      activeCallTarget: CallTarget | null;
      backendCallId: string | null;
      backendCallStatus: string | null;
      telephonyError: string | null;
    }

    function createCallPipelineEngine() {
      let state: AppCallStateHarness = {
        callMode: null,
        callState: 'idle',
        activeView: 'dashboard',
        planTab: 'outgoing',
        activeCallTarget: null,
        backendCallId: null,
        backendCallStatus: null,
        telephonyError: null,
      };

      const outboundInitiatorMock = vi.fn();
      const outboundTerminatorMock = vi.fn();

      return {
        getState: () => ({ ...state }),
        outboundInitiatorMock,
        outboundTerminatorMock,
        startRoleplay: (target: CallTarget) => {
          state.callMode = 'ROLEPLAY';
          state.activeCallTarget = target;
          state.activeView = 'plan';
          state.planTab = 'practise';
          state.backendCallId = null;
          state.backendCallStatus = null;
          state.telephonyError = null;
          state.callState = 'ringing';
          // Strictly 0 network or backend calls
        },
        startCall: async (target: CallTarget) => {
          state.callMode = 'PSTN';
          state.activeCallTarget = target;
          state.activeView = 'plan';
          state.callState = 'ringing';
          state.backendCallId = null;
          state.backendCallStatus = null;
          state.telephonyError = null;

          let cleanPhone = (target.phone || '').replace(/[\s\-\(\)]/g, '');
          if (cleanPhone && !cleanPhone.startsWith('+')) {
            if (cleanPhone.length === 10) {
              cleanPhone = `+91${cleanPhone}`;
            } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
              cleanPhone = `+${cleanPhone}`;
            } else {
              cleanPhone = `+91${cleanPhone}`;
            }
          }

          if (!cleanPhone || !cleanPhone.startsWith('+') || !/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
            state.callState = 'idle';
            state.callMode = null;
            state.telephonyError = 'Invalid phone number format: Destination must be in E.164 format (e.g. +919876543210)';
            return;
          }

          try {
            const res = await outboundInitiatorMock({
              customerPhone: cleanPhone,
              customerName: target.name,
            });
            state.backendCallId = res.id;
            state.backendCallStatus = res.status;
          } catch (err: any) {
            state.callState = 'idle';
            state.callMode = null;
            state.telephonyError = err?.message || 'Carrier error';
          }
        },
        answerCall: () => {
          if (state.callMode === 'ROLEPLAY') {
            state.callState = 'active';
            return;
          }
          if (state.callMode === 'PSTN' && state.backendCallId) {
            state.callState = 'active';
          }
        },
        endCall: async () => {
          if (state.callMode === 'PSTN' && state.backendCallId) {
            await outboundTerminatorMock(state.backendCallId);
          }
          state.callState = 'wrapup';
        },
        closeWrapup: () => {
          state.callState = 'idle';
          state.callMode = null;
          state.activeCallTarget = null;
          state.backendCallId = null;
        },
      };
    }

    it('startRoleplay transitions to ringing with callMode ROLEPLAY and 0 network calls', () => {
      const pipeline = createCallPipelineEngine();
      const mukundaTarget: CallTarget = {
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        initials: 'MR',
        phone: '+91 98450 12345',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
        intent: 'Practise Scenario: Ortho GRID Mattress',
      };

      pipeline.startRoleplay(mukundaTarget);
      const state = pipeline.getState();

      expect(state.callMode).toBe('ROLEPLAY');
      expect(state.callState).toBe('ringing');
      expect(state.activeView).toBe('plan');
      expect(state.planTab).toBe('practise');
      expect(state.backendCallId).toBeNull();
      expect(state.backendCallStatus).toBeNull();
      expect(state.telephonyError).toBeNull();
      expect(pipeline.outboundInitiatorMock).not.toHaveBeenCalled();
    });

    it('startRoleplay remains unaffected even if backend telephony service is unavailable', () => {
      const pipeline = createCallPipelineEngine();
      // Configure mock to throw simulate backend down
      pipeline.outboundInitiatorMock.mockRejectedValue(new Error('Connection refused (Docker stopped)'));

      const mukundaTarget: CallTarget = {
        id: 'l1',
        name: 'Mukunda R. (AI Customer Roleplay)',
        initials: 'MR',
        phone: '+91 98450 12345',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
        intent: 'Practise Scenario',
      };

      pipeline.startRoleplay(mukundaTarget);
      expect(pipeline.getState().callState).toBe('ringing');
      expect(pipeline.getState().callMode).toBe('ROLEPLAY');
      expect(pipeline.outboundInitiatorMock).not.toHaveBeenCalled();
    });

    it('startCall invokes initiateOutboundCall and sets callMode to PSTN', async () => {
      const pipeline = createCallPipelineEngine();
      pipeline.outboundInitiatorMock.mockResolvedValue({
        id: 'call-pstn-12345',
        status: 'RINGING',
      });

      const realTarget: CallTarget = {
        id: 'lead-100',
        name: 'Rajesh Sharma',
        initials: 'RS',
        phone: '+91 98765 43210',
        avatarBg: '#e1f5ee',
        avatarColor: '#0f6e56',
        intent: 'Ortho GRID Inquiry',
      };

      await pipeline.startCall(realTarget);
      const state = pipeline.getState();

      expect(state.callMode).toBe('PSTN');
      expect(state.callState).toBe('ringing');
      expect(state.backendCallId).toBe('call-pstn-12345');
      expect(pipeline.outboundInitiatorMock).toHaveBeenCalledWith({
        customerPhone: '+919876543210',
        customerName: 'Rajesh Sharma',
      });
    });

    it('startCall resets callState to idle and callMode to null on invalid phone number', async () => {
      const pipeline = createCallPipelineEngine();
      const invalidTarget: CallTarget = {
        id: 'lead-invalid',
        name: 'Invalid Phone',
        initials: 'IP',
        phone: 'invalid-string',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
        intent: 'Invalid',
      };

      await pipeline.startCall(invalidTarget);
      const state = pipeline.getState();

      expect(state.callMode).toBeNull();
      expect(state.callState).toBe('idle');
      expect(state.telephonyError).toContain('Invalid phone number format');
      expect(pipeline.outboundInitiatorMock).not.toHaveBeenCalled();
    });

    it('endCall in ROLEPLAY mode does not invoke terminateCall', async () => {
      const pipeline = createCallPipelineEngine();
      pipeline.startRoleplay({
        id: 'l1',
        name: 'Mukunda R.',
        initials: 'MR',
        phone: '+91 98450 12345',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
        intent: 'Roleplay',
      });

      pipeline.answerCall();
      expect(pipeline.getState().callState).toBe('active');

      await pipeline.endCall();
      expect(pipeline.getState().callState).toBe('wrapup');
      expect(pipeline.outboundTerminatorMock).not.toHaveBeenCalled();
    });

    it('endCall in PSTN mode with backendCallId invokes terminateCall', async () => {
      const pipeline = createCallPipelineEngine();
      pipeline.outboundInitiatorMock.mockResolvedValue({
        id: 'call-carrier-999',
        status: 'CONNECTED',
      });

      await pipeline.startCall({
        id: 'l1',
        name: 'Customer',
        initials: 'CU',
        phone: '+919845012345',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
        intent: 'Live PSTN',
      });

      await pipeline.endCall();
      expect(pipeline.getState().callState).toBe('wrapup');
      expect(pipeline.outboundTerminatorMock).toHaveBeenCalledWith('call-carrier-999');
    });

    it('closeWrapup resets callMode to null and callState to idle', () => {
      const pipeline = createCallPipelineEngine();
      pipeline.startRoleplay({
        id: 'l1',
        name: 'Mukunda R.',
        initials: 'MR',
        phone: '+91 98450 12345',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
        intent: 'Roleplay',
      });
      pipeline.answerCall();
      pipeline.endCall();
      pipeline.closeWrapup();

      expect(pipeline.getState().callMode).toBeNull();
      expect(pipeline.getState().callState).toBe('idle');
      expect(pipeline.getState().activeCallTarget).toBeNull();
    });
  });

  describe('3. UI Presentation & Badge Verification in ActiveCallView', () => {
    function ActiveCallHeaderHarness({
      callState,
      callMode,
      backendCallId,
      backendCallStatus,
      customerName = 'Mukunda R.',
    }: {
      callState: 'ringing' | 'active';
      callMode: CallMode;
      backendCallId: string | null;
      backendCallStatus: string | null;
      customerName?: string;
    }) {
      return (
        <div data-testid="active-call-header">
          {callState === 'ringing' && (
            <div data-testid="ringing-header">
              <span>Calling Customer • Ringing...</span>
              {callMode === 'ROLEPLAY' ? (
                <span data-testid="roleplay-badge">
                  AI ROLEPLAY / SIMULATED
                </span>
              ) : callMode === 'PSTN' && backendCallId ? (
                <span data-testid="pstn-badge">
                  REAL PSTN / CARRIER: {backendCallStatus || 'RINGING'}
                </span>
              ) : null}
              <h3>{customerName}</h3>
              {callMode === 'PSTN' && backendCallId ? (
                <button data-testid="answer-btn">Awaiting Handset Pickups...</button>
              ) : (
                <button data-testid="answer-btn">Answer / Connect</button>
              )}
            </div>
          )}

          {callState === 'active' && (
            <div data-testid="active-header">
              <h3>{customerName}</h3>
              {callMode === 'ROLEPLAY' ? (
                <span data-testid="roleplay-badge">
                  AI ROLEPLAY / SIMULATED
                </span>
              ) : callMode === 'PSTN' && backendCallId ? (
                <span data-testid="pstn-badge">
                  REAL PSTN / CARRIER: {backendCallStatus || 'CONNECTED'}
                </span>
              ) : null}
            </div>
          )}
        </div>
      );
    }

    it('renders AI ROLEPLAY / SIMULATED badge during roleplay ringing', () => {
      const html = renderToStaticMarkup(
        <ActiveCallHeaderHarness
          callState="ringing"
          callMode="ROLEPLAY"
          backendCallId={null}
          backendCallStatus={null}
          customerName="Mukunda R. (AI Customer Roleplay)"
        />
      );

      expect(html).toContain('AI ROLEPLAY / SIMULATED');
      expect(html).not.toContain('REAL PSTN / CARRIER');
      expect(html).toContain('Answer / Connect');
      expect(html).not.toContain('Awaiting Handset Pickups');
    });

    it('renders AI ROLEPLAY / SIMULATED badge during roleplay active call', () => {
      const html = renderToStaticMarkup(
        <ActiveCallHeaderHarness
          callState="active"
          callMode="ROLEPLAY"
          backendCallId={null}
          backendCallStatus={null}
          customerName="Mukunda R. (AI Customer Roleplay)"
        />
      );

      expect(html).toContain('AI ROLEPLAY / SIMULATED');
      expect(html).not.toContain('REAL PSTN / CARRIER');
    });

    it('renders REAL PSTN / CARRIER only when in PSTN mode with confirmed backendCallId', () => {
      const html = renderToStaticMarkup(
        <ActiveCallHeaderHarness
          callState="ringing"
          callMode="PSTN"
          backendCallId="call-mock-pstn-1"
          backendCallStatus="RINGING"
          customerName="Sunita Rao"
        />
      );

      expect(html).toContain('REAL PSTN / CARRIER: RINGING');
      expect(html).not.toContain('AI ROLEPLAY / SIMULATED');
      expect(html).toContain('Awaiting Handset Pickups...');
    });
  });
});
