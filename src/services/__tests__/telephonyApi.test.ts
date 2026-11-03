import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initiateOutboundCall,
  fetchCallStatus,
  terminateCall,
  listRecentCalls,
  bridgeCall,
  type CallDto,
} from '../telephonyApi';

describe('telephonyApi client service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('initiateOutboundCall sends valid payload and returns CallDto', async () => {
    const mockCallDto: Partial<CallDto> = {
      id: 'call-1234-uuid',
      customer_name: 'Vikram Mehta',
      direction: 'OUTBOUND',
      status: 'CUSTOMER_RINGING',
      duration_seconds: 0,
      legs: [
        {
          id: 'leg-1',
          leg_role: 'CUSTOMER',
          attempt_number: 1,
          provider: 'twilio',
          telephony_leg_id: 'CA123456789',
          to_endpoint_type: 'PSTN',
          to_endpoint_uri: '+919876543210',
          from_endpoint_type: 'PSTN',
          from_endpoint_uri: '+919000000001',
          status: 'RINGING',
          initiated_at: new Date().toISOString(),
          duration_seconds: 0,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockCallDto, meta: { request_id: 'req-1', timestamp: new Date().toISOString() } }),
    } as any);

    const result = await initiateOutboundCall({
      customerPhone: '+919876543210',
      customerName: 'Vikram Mehta',
      notes: 'Testing SmartGRID',
    });

    expect(result.id).toBe('call-1234-uuid');
    expect(result.status).toBe('CUSTOMER_RINGING');
    expect(result.legs[0].telephony_leg_id).toBe('CA123456789');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/calls'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Dev-Agent-Id': expect.any(String),
        }),
      })
    );
  });

  it('initiateOutboundCall propagates backend error message on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Invalid E.164 phone number' }),
    } as any);

    await expect(
      initiateOutboundCall({
        customerPhone: 'invalid-number',
      })
    ).rejects.toThrow('Invalid E.164 phone number');
  });

  it('fetchCallStatus retrieves updated status by call ID', async () => {
    const mockCallDto: Partial<CallDto> = {
      id: 'call-1234-uuid',
      status: 'CONNECTED',
      duration_seconds: 12,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockCallDto }),
    } as any);

    const result = await fetchCallStatus('call-1234-uuid');
    expect(result.status).toBe('CONNECTED');
    expect(result.duration_seconds).toBe(12);
  });

  it('terminateCall issues termination request to backend', async () => {
    const mockCallDto: Partial<CallDto> = {
      id: 'call-1234-uuid',
      status: 'WRAPUP',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockCallDto }),
    } as any);

    const result = await terminateCall('call-1234-uuid', 'Agent finished call');
    expect(result.status).toBe('WRAPUP');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/calls/call-1234-uuid/terminate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Agent finished call' }),
      })
    );
  });

  it('listRecentCalls retrieves call history list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'c1' }, { id: 'c2' }] }),
    } as any);

    const result = await listRecentCalls();
    expect(result).toHaveLength(2);
  });

  it('bridgeCall issues bridge request to backend', async () => {
    const mockCallDto: Partial<CallDto> = {
      id: 'call-1234-uuid',
      status: 'CONNECTED',
      is_simulated: false,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockCallDto }),
    } as any);

    const result = await bridgeCall('call-1234-uuid');
    expect(result.status).toBe('CONNECTED');
    expect(result.is_simulated).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/calls/call-1234-uuid/bridge'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
