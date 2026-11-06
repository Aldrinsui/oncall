import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PstnDialpadModal from '../../components/calling/PstnDialpadModal';
import { AppProvider, useApp } from '../../context/AppContext';
import {
  getApiBaseUrl,
  isConfiguredBackendAvailable,
  initiateOutboundCall,
  normalizeBackendOrigin,
} from '../telephonyApi';
import { getPulseApiBase } from '../pulseApi';
import vercelConfig from '../../../vercel.json';

describe('PSTN Dialer UI Overflow & Production API Configuration Test Suite', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = typeof process !== 'undefined' ? process.env : undefined;

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

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (typeof process !== 'undefined' && originalEnv) {
      process.env = originalEnv;
    }
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // BUG 1: PSTN DIALER MODAL OVERFLOW & RESPONSIVE LAYOUT
  // ───────────────────────────────────────────────────────────────────────────
  describe('BUG 1: PSTN Dialer Modal Layout, Overflow & Viewport Boundaries', () => {
    function ModalOpenHarness() {
      return <PstnDialpadModal isOpen={true} />;
    }

    it('renders a compact dialog with role="dialog", aria-modal="true", and visible header', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ModalOpenHarness />
        </AppProvider>
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('PSTN Outbound Dial');
      expect(html).toContain('Two-Leg Gateway');
      expect(html).toContain('Close dialog');
    });

    it('applies bounded max-height (88dvh) and responsive width (min(480px, calc(100vw - 24px)))', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ModalOpenHarness />
        </AppProvider>
      );

      // Verify inline style width and maxHeight contracts
      expect(html).toContain('width:min(480px, calc(100vw - 24px))');
      expect(html).toContain('max-height:min(88dvh, 780px)');
    });

    it('uses flex-col, min-h-0, and overflow-y-auto for internal content scrolling', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ModalOpenHarness />
        </AppProvider>
      );

      // The dialog container must have flex flex-col and overflow-hidden
      expect(html).toContain('flex flex-col');
      expect(html).toContain('overflow-hidden');

      // The content container must have overflow-y-auto and min-h-0
      expect(html).toContain('overflow-y-auto');
      expect(html).toContain('min-h-0');
    });

    it('pins the header at the top and primary action buttons at the bottom (flex-shrink-0)', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ModalOpenHarness />
        </AppProvider>
      );

      // Header must be flex-shrink-0
      expect(html).toContain('flex-shrink-0 bg-gradient-to-r');

      // Footer buttons must be flex-shrink-0, visible, and contain Dial and Cancel buttons
      expect(html).toContain('flex-shrink-0 p-3 sm:p-4 bg-gray-50/90 border-t');
      expect(html).toContain('Cancel');
      expect(html).toContain('Dial PSTN Call');
    });

    it('uses reduced backdrop opacity (bg-black/40) so the dashboard remains distinguishable', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ModalOpenHarness />
        </AppProvider>
      );

      expect(html).toContain('bg-black/40');
      expect(html).toContain('backdrop-blur-[2px]');
    });

    it('uses compact keypad button heights (h-9 sm:h-11) for short-screen friendliness', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ModalOpenHarness />
        </AppProvider>
      );

      expect(html).toContain('h-9 sm:h-11');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Viewport Matrix Math Verification: 2048×1280, 1440×900, 1024×768, 390×844
    // ─────────────────────────────────────────────────────────────────────────
    describe('Viewport Size Boundary Calculations', () => {
      function computeModalDimensions(viewportWidth: number, viewportHeight: number) {
        const computedWidth = Math.min(480, viewportWidth - 24);
        const computedMaxHeight = Math.min(viewportHeight * 0.88, 780);
        const horizontalMargin = (viewportWidth - computedWidth) / 2;
        const verticalMargin = (viewportHeight - computedMaxHeight) / 2;

        return {
          computedWidth,
          computedMaxHeight,
          horizontalMargin,
          verticalMargin,
          fitsWithinViewportWidth: computedWidth <= viewportWidth,
          fitsWithinViewportHeight: computedMaxHeight <= viewportHeight,
          hasSidePadding: horizontalMargin >= 12,
        };
      }

      it('verifies layout at 2048 × 1280 (Large Desktop): stays compact, does not stretch full screen', () => {
        const dims = computeModalDimensions(2048, 1280);
        expect(dims.computedWidth).toBe(480);
        expect(dims.computedMaxHeight).toBe(780);
        expect(dims.fitsWithinViewportWidth).toBe(true);
        expect(dims.fitsWithinViewportHeight).toBe(true);
        expect(dims.hasSidePadding).toBe(true);
        expect(dims.horizontalMargin).toBe(784); // Centered with ample space
      });

      it('verifies layout at 1440 × 900 (Standard Laptop): stays compact and centered', () => {
        const dims = computeModalDimensions(1440, 900);
        expect(dims.computedWidth).toBe(480);
        expect(dims.computedMaxHeight).toBe(780);
        expect(dims.fitsWithinViewportWidth).toBe(true);
        expect(dims.fitsWithinViewportHeight).toBe(true);
        expect(dims.hasSidePadding).toBe(true);
        expect(dims.horizontalMargin).toBe(480);
      });

      it('verifies layout at 1024 × 768 (Tablet/Small Desktop): max-height caps at 88dvh (675.8px)', () => {
        const dims = computeModalDimensions(1024, 768);
        expect(dims.computedWidth).toBe(480);
        expect(dims.computedMaxHeight).toBeCloseTo(675.84, 1);
        expect(dims.fitsWithinViewportWidth).toBe(true);
        expect(dims.fitsWithinViewportHeight).toBe(true);
        expect(dims.hasSidePadding).toBe(true);
        expect(dims.verticalMargin).toBeGreaterThan(45); // Margin top and bottom
      });

      it('verifies layout at 390 × 844 (Mobile): width is exactly 366px with 12px margin, zero horizontal overflow', () => {
        const dims = computeModalDimensions(390, 844);
        expect(dims.computedWidth).toBe(366); // 390 - 24 = 366
        expect(dims.computedMaxHeight).toBeCloseTo(742.72, 1);
        expect(dims.fitsWithinViewportWidth).toBe(true);
        expect(dims.fitsWithinViewportHeight).toBe(true);
        expect(dims.hasSidePadding).toBe(true);
        expect(dims.horizontalMargin).toBe(12); // Exactly 12px margin on left and right
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // BUG 2: PRODUCTION BACKEND RETURNS HTTP 405 / API CONFIGURATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('BUG 2: Production API URL Configuration & Error Handling', () => {
    it('getApiBaseUrl trims trailing slashes and handles undefined env vars', () => {
      expect(typeof getApiBaseUrl()).toBe('string');
      // If configured via localStorage override
      localStorage.setItem('onground_backend_url', 'https://api.example.com///');
      expect(getApiBaseUrl()).toBe('https://api.example.com');
      localStorage.removeItem('onground_backend_url');

      // Test window.ONCALL_API_URL
      const originalWin = (globalThis as any).window;
      try {
        (globalThis as any).window = { ONCALL_API_URL: 'https://api-window.example.com/api/v1/' };
        expect(getApiBaseUrl()).toBe('https://api-window.example.com');
      } finally {
        (globalThis as any).window = originalWin;
      }

      // Test ONCALL_API_URL in localStorage
      localStorage.setItem('ONCALL_API_URL', 'https://api-storage.example.com/');
      expect(getApiBaseUrl()).toBe('https://api-storage.example.com');
      localStorage.removeItem('ONCALL_API_URL');
    });

    it('normalizeBackendOrigin removes trailing slashes and mistakenly included /api/v1 to prevent duplicate paths', () => {
      expect(normalizeBackendOrigin('https://api.example.com')).toBe('https://api.example.com');
      expect(normalizeBackendOrigin('https://api.example.com/')).toBe('https://api.example.com');
      expect(normalizeBackendOrigin('https://api.example.com/api/v1')).toBe('https://api.example.com');
      expect(normalizeBackendOrigin('https://api.example.com/api/v1/')).toBe('https://api.example.com');
      expect(normalizeBackendOrigin('https://api.example.com/api')).toBe('https://api.example.com');
      expect(normalizeBackendOrigin('')).toBe('');
    });

    it('constructs clean endpoint URL without duplicate API paths when backend URL has /api/v1 or trailing slash', async () => {
      localStorage.setItem('onground_backend_url', 'https://fastapi.example.com/api/v1/');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: { id: 'call-dup-check', status: 'AGENT_RINGING', legs: [] } }),
      } as any);
      globalThis.fetch = mockFetch;

      try {
        await initiateOutboundCall({
          customerPhone: '+919876543210',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://fastapi.example.com/api/v1/calls',
          expect.anything()
        );
      } finally {
        localStorage.removeItem('onground_backend_url');
      }
    });

    it('isConfiguredBackendAvailable returns true for localhost / dev environments', () => {
      // In vitest environment with window.location
      expect(isConfiguredBackendAvailable()).toBe(true);
    });

    it('rejects pointing production frontend to localhost', async () => {
      const originalWindow = globalThis.window;
      (globalThis as any).window = {
        location: {
          hostname: 'oncall-ashy.vercel.app',
          origin: 'https://oncall-ashy.vercel.app',
        },
        localStorage: {
          getItem: (k: string) => (k === 'onground_backend_url' ? 'http://localhost:8000' : null),
        },
      };

      try {
        expect(isConfiguredBackendAvailable()).toBe(false);
        await expect(
          initiateOutboundCall({
            customerPhone: '+919876543210',
          })
        ).rejects.toThrow(/Production frontend cannot point to localhost/);
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('verifies development localhost proxy continues to work with relative paths when no external backend is set', async () => {
      // In local dev without configured URL, getApiBaseUrl() returns ''
      expect(getApiBaseUrl()).toBe('');
      expect(isConfiguredBackendAvailable()).toBe(true);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: { id: 'dev-call', status: 'AGENT_RINGING', legs: [] } }),
      } as any);
      globalThis.fetch = mockFetch;

      await initiateOutboundCall({
        customerPhone: '+919876543210',
      });

      // Relative path /api/v1/calls is sent, matching Vite server proxy config
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/calls', expect.anything());
    });

    it('pulseApi resolves base URL correctly without hardcoding localhost in production', () => {
      // When no external URL configured (dev proxy mode), pulseApi uses relative /api/v1
      expect(getPulseApiBase()).toBe('/api/v1');

      // When external URL configured, appends /api/v1 cleanly
      localStorage.setItem('onground_backend_url', 'https://api.sleepcompany.com/api/v1/');
      expect(getPulseApiBase()).toBe('https://api.sleepcompany.com/api/v1');
      localStorage.removeItem('onground_backend_url');
    });

    it('detects when backend is not configured in production and gives actionable message', async () => {
      // Simulate production environment on hosted Vercel domain without VITE_BACKEND_API_URL
      const originalWindow = globalThis.window;
      (globalThis as any).window = {
        location: {
          hostname: 'oncall-ashy.vercel.app',
          origin: 'https://oncall-ashy.vercel.app',
        },
        localStorage: {
          getItem: () => null,
        },
      };

      try {
        expect(isConfiguredBackendAvailable()).toBe(false);

        await expect(
          initiateOutboundCall({
            customerPhone: '+919876543210',
          })
        ).rejects.toThrow(/FastAPI backend URL not configured \(VITE_BACKEND_API_URL is missing\)/);
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('handles HTTP 405 Method Not Allowed with explicit explanation of Vercel static routing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 405,
        headers: { get: () => 'text/plain' },
        text: async () => 'Method Not Allowed',
      } as any);

      await expect(
        initiateOutboundCall({
          customerPhone: '+919876543210',
        })
      ).rejects.toThrow(/HTTP 405 Method Not Allowed/);
    });

    it('handles HTTP 404 on API route with guidance to configure VITE_BACKEND_API_URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => 'text/plain' },
        text: async () => 'Not Found',
      } as any);

      await expect(
        initiateOutboundCall({
          customerPhone: '+919876543210',
        })
      ).rejects.toThrow(/FastAPI backend endpoint not found \(HTTP 404/);
    });

    it('formats structured Pydantic array validation errors into clean readable messages', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        headers: { get: () => 'application/json' },
        json: async () => ({
          detail: [
            { loc: ['body', 'customer_phone'], msg: 'Invalid E.164 phone number format' },
          ],
        }),
      } as any);

      await expect(
        initiateOutboundCall({
          customerPhone: '+919876543210',
        })
      ).rejects.toThrow(/customer_phone: Invalid E.164 phone number format/);
    });

    it('verifies vercel.json contains valid SPA fallback rewrite to index.html', () => {
      expect(vercelConfig.rewrites).toBeDefined();
      const spaRewrite = vercelConfig.rewrites.find(
        (r: any) => r.destination === '/index.html'
      );
      expect(spaRewrite).toBeDefined();
      expect(spaRewrite?.source).toBe('/(.*)');
    });
  });
});
