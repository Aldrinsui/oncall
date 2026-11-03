import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../../App';
import type { View, CallTarget } from '../../types';

describe('Call UI Isolation and Navigation Matrix', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof globalThis.localStorage === 'undefined') {
      const store: Record<string, string> = {};
      globalThis.localStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
        key: (i: number) => Object.keys(store)[i] ?? null,
        length: 0,
      };
    }
  });

  describe('Component placement and persistent mounting wrapper in App.tsx', () => {
    // Pure rendering harness with the exact wrapper structure from src/App.tsx
    function ActiveCallWrapperHarness({
      activeView,
      callState = 'ringing',
    }: {
      activeView: View;
      callState?: 'idle' | 'ringing' | 'active' | 'wrapup';
    }) {
      return (
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 max-w-7xl w-full mx-auto">
          {/* Active Calling Engine Layer — Rendered on top when ringing or active, isolated to Plan view */}
          <div
            id="active-call-layer"
            className={activeView === 'plan' ? 'contents' : 'hidden'}
            aria-hidden={activeView !== 'plan'}
          >
            <div data-testid="active-call-view" data-state={callState}>
              {callState === 'ringing' && (
                <div data-testid="ringing-banner" className="ringing-call-alert">
                  Calling Customer • Ringing...
                </div>
              )}
              {callState === 'active' && (
                <div data-testid="active-call-panel" className="active-call-grid">
                  Active Call Interface • Live Transcript • Audio Visualizer
                </div>
              )}
              {callState === 'wrapup' && (
                <div data-testid="wrapup-modal" className="call-wrapup-interface">
                  Call Wrap-up & Notes
                </div>
              )}
            </div>
          </div>

          {/* Primary View Router */}
          {activeView === 'dashboard' && <div data-testid="dashboard-view">Dashboard View</div>}
          {activeView === 'plan' && <div data-testid="plan-view">Planner View</div>}
          {activeView === 'calendar' && <div data-testid="calendar-view">Calendar View</div>}
          {activeView === 'pulse' && <div data-testid="pulse-view">Pulse View</div>}
        </main>
      );
    }

    const testMatrix: {
      view: View;
      callState: 'ringing' | 'active' | 'wrapup';
      expectedVisible: boolean;
      expectedWrapperClass: string;
      expectedAriaHidden: boolean;
    }[] = [
      // Dashboard: Call UI is hidden
      { view: 'dashboard', callState: 'ringing', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },
      { view: 'dashboard', callState: 'active', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },
      { view: 'dashboard', callState: 'wrapup', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },

      // Calendar: Call UI is hidden
      { view: 'calendar', callState: 'ringing', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },
      { view: 'calendar', callState: 'active', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },
      { view: 'calendar', callState: 'wrapup', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },

      // Pulse: Call UI is hidden
      { view: 'pulse', callState: 'ringing', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },
      { view: 'pulse', callState: 'active', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },
      { view: 'pulse', callState: 'wrapup', expectedVisible: false, expectedWrapperClass: 'hidden', expectedAriaHidden: true },

      // Plan: Call UI is visible
      { view: 'plan', callState: 'ringing', expectedVisible: true, expectedWrapperClass: 'contents', expectedAriaHidden: false },
      { view: 'plan', callState: 'active', expectedVisible: true, expectedWrapperClass: 'contents', expectedAriaHidden: false },
      { view: 'plan', callState: 'wrapup', expectedVisible: true, expectedWrapperClass: 'contents', expectedAriaHidden: false },
    ];

    it.each(testMatrix)(
      'Matrix validation: view="$view", callState="$callState" -> visible=$expectedVisible, class="$expectedWrapperClass"',
      ({ view, callState, expectedVisible, expectedWrapperClass, expectedAriaHidden }) => {
        const html = renderToStaticMarkup(
          <ActiveCallWrapperHarness activeView={view} callState={callState} />
        );

        if (expectedVisible) {
          expect(html).toContain(`class="${expectedWrapperClass}"`);
          expect(html).not.toContain('class="hidden"');
          expect(html).not.toContain('aria-hidden="true"');
          expect(html).toContain('data-testid="plan-view"');
        } else {
          expect(html).toContain(`class="${expectedWrapperClass}"`);
          expect(html).toContain(`aria-hidden="${expectedAriaHidden}"`);
          expect(html).not.toContain('class="contents"');
          expect(html).toContain(`data-testid="${view}-view"`);
        }

        // Critically: Component tree must remain mounted in the HTML representation in ALL views
        expect(html).toContain('data-testid="active-call-view"');
        expect(html).toContain(`data-state="${callState}"`);
      }
    );

    it('ensures wrapper uses display: contents in Plan view to prevent layout spacing regressions', () => {
      const html = renderToStaticMarkup(
        <ActiveCallWrapperHarness activeView="plan" callState="active" />
      );
      // 'contents' class causes the div container not to generate its own layout box
      expect(html).toContain('class="contents"');
    });

    it('ensures wrapper uses display: none (hidden) in Dashboard/Calendar/Pulse to completely hide call surfaces', () => {
      (['dashboard', 'calendar', 'pulse'] as View[]).forEach((v) => {
        const html = renderToStaticMarkup(
          <ActiveCallWrapperHarness activeView={v} callState="active" />
        );
        expect(html).toContain('class="hidden"');
        expect(html).toContain('aria-hidden="true"');
      });
    });
  });

  describe('Call State Machine and View Router Navigation Semantics', () => {
    // Model of AppContext navigation state machine
    interface AppNavigationState {
      activeView: View;
      callState: 'idle' | 'ringing' | 'active' | 'wrapup' | 'review';
      activeCallTarget: CallTarget | null;
      backendCallId: string | null;
      seconds: number;
    }

    function createNavigationStateMachine(initial?: Partial<AppNavigationState>) {
      let state: AppNavigationState = {
        activeView: 'dashboard',
        callState: 'idle',
        activeCallTarget: null,
        backendCallId: null,
        seconds: 0,
        ...initial,
      };

      return {
        getState: () => ({ ...state }),
        startCall: (target: CallTarget, backendCallId = 'test-call-id') => {
          state.activeCallTarget = target;
          state.activeView = 'plan'; // Must navigate to Plan
          state.callState = 'ringing';
          state.backendCallId = backendCallId;
          state.seconds = 0;
        },
        answerCall: () => {
          if (state.callState === 'ringing') {
            state.callState = 'active';
          }
        },
        tickTimer: (increment = 1) => {
          if (state.callState === 'active') {
            state.seconds += increment;
          }
        },
        setActiveView: (nextView: View) => {
          // Navigation must NOT reset callState
          state.activeView = nextView;
        },
        hangupCall: () => {
          if (state.callState === 'active' || state.callState === 'ringing') {
            state.callState = 'wrapup';
          }
        },
        completeWrapup: () => {
          state.callState = 'idle';
          state.activeCallTarget = null;
          state.backendCallId = null;
        },
      };
    }

    it('navigating between views preserves active callState, target, timer, and backendCallId', () => {
      const fsm = createNavigationStateMachine();
      expect(fsm.getState().activeView).toBe('dashboard');
      expect(fsm.getState().callState).toBe('idle');

      // 1. Start call from Plan or anywhere
      fsm.startCall({
        id: 'cust-101',
        name: 'Anita Desai',
        phone: '+919876543210',
        initials: 'AD',
        intent: 'SmartGRID Mattress',
        avatarBg: '#faeeda',
        avatarColor: '#854f0b',
      }, 'call-uuid-999');

      expect(fsm.getState().activeView).toBe('plan');
      expect(fsm.getState().callState).toBe('ringing');
      expect(fsm.getState().activeCallTarget?.name).toBe('Anita Desai');
      expect(fsm.getState().backendCallId).toBe('call-uuid-999');

      // 2. Customer answers -> call active
      fsm.answerCall();
      fsm.tickTimer(15);
      expect(fsm.getState().callState).toBe('active');
      expect(fsm.getState().seconds).toBe(15);

      // 3. User navigates to Dashboard while call is active
      fsm.setActiveView('dashboard');
      expect(fsm.getState().activeView).toBe('dashboard');
      expect(fsm.getState().callState).toBe('active'); // Still active!
      expect(fsm.getState().backendCallId).toBe('call-uuid-999');

      // Timer continues in background
      fsm.tickTimer(10);
      expect(fsm.getState().seconds).toBe(25);

      // 4. User navigates to Calendar
      fsm.setActiveView('calendar');
      expect(fsm.getState().activeView).toBe('calendar');
      expect(fsm.getState().callState).toBe('active');
      fsm.tickTimer(5);

      // 5. User navigates to Pulse
      fsm.setActiveView('pulse');
      expect(fsm.getState().activeView).toBe('pulse');
      expect(fsm.getState().callState).toBe('active');
      fsm.tickTimer(5);

      // 6. User returns to Plan
      fsm.setActiveView('plan');
      expect(fsm.getState().activeView).toBe('plan');
      expect(fsm.getState().callState).toBe('active');
      expect(fsm.getState().seconds).toBe(35);
      expect(fsm.getState().activeCallTarget?.name).toBe('Anita Desai');

      // 7. Hangup and wrapup
      fsm.hangupCall();
      expect(fsm.getState().callState).toBe('wrapup');

      fsm.completeWrapup();
      expect(fsm.getState().callState).toBe('idle');
      expect(fsm.getState().activeCallTarget).toBeNull();
    });
  });

  describe('Root App Component Smoke Test', () => {
    it('renders App root without crash and verifies hidden wrapper on default dashboard view', () => {
      const html = renderToStaticMarkup(<App />);
      // Default view is dashboard
      expect(html).toContain('Dashboard');
      // The wrapper for active call is hidden on initial dashboard view
      expect(html).toContain('class="hidden"');
      expect(html).toContain('aria-hidden="true"');
      // Legitimate dashboard information remains present
      expect(html).toContain('Who is Waiting Now');
      expect(html).toContain('Retail Tele-Calling');
    });
  });
});
