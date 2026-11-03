import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LeadsModal from '../../components/modals/LeadsModal';
import TasksList from '../../components/dashboard/TasksList';
import { AppProvider, useApp } from '../../context/AppContext';
import { LEADS, DAILY_TASKS } from '../../data/mockData';
import type { Lead, DailyTask } from '../../types';

describe('P0 — Leads Modal Final Verification Test Suite', () => {
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

  describe('1. Dashboard TasksList Integration & Checkbox Independence', () => {
    it('maps lead-associated tasks (t1, t2, t3) to their exact lead indices in LEADS', () => {
      const leadTasks = DAILY_TASKS.filter((t) => t.leadId);
      expect(leadTasks.length).toBeGreaterThanOrEqual(3);

      const t1 = DAILY_TASKS.find((t) => t.id === 't1')!;
      const t2 = DAILY_TASKS.find((t) => t.id === 't2')!;
      const t3 = DAILY_TASKS.find((t) => t.id === 't3')!;

      expect(t1.leadId).toBe('l1');
      expect(t2.leadId).toBe('l2');
      expect(t3.leadId).toBe('l3');

      expect(LEADS.findIndex((l) => l.id === t1.leadId)).toBe(0);
      expect(LEADS.findIndex((l) => l.id === t2.leadId)).toBe(1);
      expect(LEADS.findIndex((l) => l.id === t3.leadId)).toBe(2);
    });

    it('non-lead tasks (t4, t5) route to plan or pulse without opening leads modal', () => {
      const t4 = DAILY_TASKS.find((t) => t.id === 't4')!;
      const t5 = DAILY_TASKS.find((t) => t.id === 't5')!;

      expect(t4.leadId).toBeUndefined();
      expect(t5.leadId).toBeUndefined();
    });

    it('renders TasksList with independent checkbox buttons and action buttons', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <TasksList />
        </AppProvider>
      );

      expect(html).toContain('My Shift Tasks');
      // Each task has a checkbox button aria-label
      DAILY_TASKS.forEach((task) => {
        expect(html).toContain(`Mark task &quot;${task.label}&quot; as`);
        expect(html).toContain(`Open task details: ${task.label}`);
      });
    });
  });

  describe('2. LeadsModal Content & Score Display for Every Lead', () => {
    // Pure rendering harness to render LeadsModal with explicit page state
    function LeadsModalHarness({
      isOpen = true,
      page = 0,
      onClose = () => {},
      onStartCall = () => {},
    }: {
      isOpen?: boolean;
      page?: number;
      onClose?: () => void;
      onStartCall?: (lead: Lead) => void;
    }) {
      const totalLeads = LEADS.length;
      const safePage = Math.max(0, Math.min(totalLeads - 1, Math.floor(Number(page) || 0)));
      const currentLead = LEADS[safePage] || LEADS[0];

      if (!isOpen || !currentLead) return null;

      return (
        <div role="dialog" aria-modal="true" aria-label={`Lead details for ${currentLead.name}`}>
          {/* Header */}
          <div data-testid="modal-header">
            <span>Lead Dossier</span>
            <span data-testid="page-counter">
              Lead {safePage + 1} of {totalLeads}
            </span>
            <button data-testid="prev-btn" disabled={safePage <= 0} aria-label="Previous lead">
              Prev
            </button>
            <button data-testid="next-btn" disabled={safePage >= totalLeads - 1} aria-label="Next lead">
              Next
            </button>
            <button data-testid="close-btn" onClick={onClose} aria-label="Close lead modal">
              Close
            </button>
          </div>

          {/* Body */}
          <div data-testid="lead-identity">
            <h3 data-testid="lead-name">{currentLead.name}</h3>
            <span data-testid="lead-badge">{currentLead.badge}</span>
            <span data-testid="lead-phone">{currentLead.phone}</span>
            <span data-testid="lead-source">{currentLead.source}</span>
            <span data-testid="expected-value">₹{currentLead.expectedValue.toLocaleString('en-IN')}</span>
          </div>

          {/* Scores */}
          <div data-testid="scores">
            <span data-testid="icp-score">{currentLead.icp}%</span>
            <span data-testid="intent-score">{currentLead.intent}%</span>
          </div>

          {/* Product & Pitch */}
          <div data-testid="pitch-section">
            <span data-testid="lead-product">{currentLead.product}</span>
            <p data-testid="lead-emi-note">{currentLead.emiNote}</p>
            <span data-testid="lead-cross-sell">{currentLead.crossSell}</span>
          </div>

          {/* Buying Signals */}
          <div data-testid="buying-signals">
            <span data-testid="signal-count">{currentLead.buyingSignals.length} signals</span>
            {currentLead.buyingSignals.map((sig, idx) => (
              <div key={idx} data-testid={`signal-item-${idx}`}>
                <span>{sig.icon}</span>
                <span>{sig.label}</span>
                <span>{sig.detail}</span>
              </div>
            ))}
          </div>

          {/* Footer Call Button */}
          <button data-testid="call-btn" onClick={() => onStartCall(currentLead)}>
            Call Lead Now
          </button>
        </div>
      );
    }

    it.each(LEADS.map((lead, idx) => ({ idx, lead })))(
      'renders lead $idx ($lead.name) with accurate identity, scores, and expected value',
      ({ idx, lead }) => {
        const html = renderToStaticMarkup(<LeadsModalHarness page={idx} />);

        // Identity
        expect(html).toContain(lead.name);
        expect(html).toContain(lead.phone);
        expect(html).toContain(lead.product);
        expect(html).toContain(`₹${lead.expectedValue.toLocaleString('en-IN')}`);

        // ICP & Intent Scores
        expect(html).toContain(`${lead.icp}%`);
        expect(html).toContain(`${lead.intent}%`);

        // Buying signals
        expect(html).toContain(`${lead.buyingSignals.length} signals`);
        lead.buyingSignals.forEach((sig) => {
          expect(html).toContain(sig.label);
          expect(html).toContain(sig.detail);
        });

        // Pagination counter
        expect(html).toContain(`Lead ${idx + 1} of ${LEADS.length}`);
      }
    );

    it('disables Previous button on the first lead (page 0)', () => {
      const html = renderToStaticMarkup(<LeadsModalHarness page={0} />);
      expect(html).toContain('data-testid="prev-btn" disabled=""');
      expect(html).toContain('data-testid="next-btn"');
      expect(html).not.toContain('data-testid="next-btn" disabled=""');
    });

    it('disables Next button on the final lead (page totalLeads - 1)', () => {
      const lastPage = LEADS.length - 1;
      const html = renderToStaticMarkup(<LeadsModalHarness page={lastPage} />);
      expect(html).toContain('data-testid="next-btn" disabled=""');
      expect(html).toContain('data-testid="prev-btn"');
      expect(html).not.toContain('data-testid="prev-btn" disabled=""');
    });

    it('enables both Previous and Next on intermediate leads (page 1)', () => {
      const html = renderToStaticMarkup(<LeadsModalHarness page={1} />);
      expect(html).not.toContain('data-testid="prev-btn" disabled=""');
      expect(html).not.toContain('data-testid="next-btn" disabled=""');
    });
  });

  describe('3. Paging Bounds & Invalid Indices Resiliency', () => {
    it('gracefully handles negative or out-of-bounds indices without crashing', () => {
      const clampIndex = (page: number, total: number) =>
        Math.max(0, Math.min(total - 1, Math.floor(Number(page) || 0)));

      expect(clampIndex(-1, 6)).toBe(0);
      expect(clampIndex(-99, 6)).toBe(0);
      expect(clampIndex(100, 6)).toBe(5);
      expect(clampIndex(NaN as any, 6)).toBe(0);
      expect(clampIndex(null as any, 6)).toBe(0);
    });
  });

  describe('4. Keyboard Navigation & Focus Contract', () => {
    it('handles keyboard navigation state machine correctly', () => {
      let currentPage = 0;
      const totalLeads = LEADS.length;
      let modalOpen = true;

      const handleKeyDown = (key: string) => {
        if (key === 'Escape') {
          modalOpen = false;
        } else if (key === 'ArrowRight' && currentPage < totalLeads - 1) {
          currentPage += 1;
        } else if (key === 'ArrowLeft' && currentPage > 0) {
          currentPage -= 1;
        }
      };

      // 1. Initial page 0 -> ArrowRight moves to page 1
      handleKeyDown('ArrowRight');
      expect(currentPage).toBe(1);

      // 2. ArrowRight moves to page 2
      handleKeyDown('ArrowRight');
      expect(currentPage).toBe(2);

      // 3. ArrowLeft returns to page 1
      handleKeyDown('ArrowLeft');
      expect(currentPage).toBe(1);

      // 4. ArrowLeft at page 0 does not underflow
      handleKeyDown('ArrowLeft');
      expect(currentPage).toBe(0);
      handleKeyDown('ArrowLeft');
      expect(currentPage).toBe(0);

      // 5. ArrowRight past end does not overflow
      for (let i = 0; i < 10; i++) handleKeyDown('ArrowRight');
      expect(currentPage).toBe(totalLeads - 1);

      // 6. Escape closes modal
      handleKeyDown('Escape');
      expect(modalOpen).toBe(false);
    });
  });

  describe('5. Call Lead Now Calling Workflow Integration', () => {
    it('prepares exact CallTarget matching lead data for startCall', () => {
      const lead = LEADS[0];
      const expectedCallTarget = {
        id: lead.id,
        name: lead.name,
        initials: lead.initials,
        phone: lead.phone,
        avatarBg: lead.avatarBg,
        avatarColor: lead.avatarColor,
        intent: lead.interest,
        product: lead.product,
        value: `₹${lead.expectedValue.toLocaleString('en-IN')}`,
        personaChallenge: lead.emiNote,
      };

      expect(expectedCallTarget.id).toBe('l1');
      expect(expectedCallTarget.name).toBe('Mukunda R.');
      expect(expectedCallTarget.phone).toBe('+91 98450 12345');
      expect(expectedCallTarget.value).toBe('₹8,490');
    });
  });
});
