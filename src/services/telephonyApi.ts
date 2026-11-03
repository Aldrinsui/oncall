/**
 * Real Outbound PSTN Telephony API Client
 * Connects frontend UI directly to the backend FastAPI telephony service.
 */

export interface CallLegDto {
  id: string;
  leg_role: 'AGENT' | 'CUSTOMER';
  attempt_number: number;
  provider: string;
  telephony_leg_id?: string;
  to_endpoint_type: string;
  to_endpoint_uri: string;
  from_endpoint_type: string;
  from_endpoint_uri: string;
  status: string;
  initiated_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds: number;
}

export interface CallDto {
  id: string;
  agent_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  lead_id?: string;
  direction: string;
  status: 'QUEUED' | 'INITIATING' | 'AGENT_RINGING' | 'CUSTOMER_RINGING' | 'CONNECTED' | 'ON_HOLD' | 'WRAPUP' | 'COMPLETED' | 'FAILED' | 'BUSY' | 'NO_ANSWER' | 'CANCELLED';
  notes?: string;
  wrapup_outcome?: string;
  created_at: string;
  initiated_at?: string;
  connected_at?: string;
  ended_at?: string;
  duration_seconds: number;
  legs: CallLegDto[];
}

export interface InitiateCallParams {
  customerPhone: string;
  customerName?: string;
  notes?: string;
  leadId?: string;
  agentId?: string;
}

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).__ONCALL_API_URL__) {
    return (window as any).__ONCALL_API_URL__;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_API_URL) {
    return import.meta.env.VITE_BACKEND_API_URL;
  }
  return '';
};

const DEV_AGENT_ID = '00000000-0000-0000-0000-000000000001';

const getHeaders = (): HeadersInit => {
  return {
    'Content-Type': 'application/json',
    'X-Dev-Agent-Id': DEV_AGENT_ID,
  };
};

/**
 * Initiates an authentic outbound PSTN phone call via the backend telephony provider (Twilio/Plivo).
 */
export async function initiateOutboundCall(params: InitiateCallParams): Promise<CallDto> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/calls`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      customer_phone: params.customerPhone,
      customer_name: params.customerName || 'Customer',
      notes: params.notes,
      lead_id: params.leadId,
      agent_id: params.agentId,
      direction: 'OUTBOUND',
    }),
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errMessage = errJson.detail || errJson.message || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetches the current live status and legs of a call.
 */
export async function fetchCallStatus(callId: string): Promise<CallDto> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/calls/${callId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errMessage = errJson.detail || errJson.message || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Terminates an ongoing or ringing PSTN call.
 */
export async function terminateCall(callId: string, reason?: string): Promise<CallDto> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/calls/${callId}/terminate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      reason: reason || 'Agent terminated call from interface',
    }),
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errMessage = errJson.detail || errJson.message || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Retrieves the recent call log from the backend database.
 */
export async function listRecentCalls(): Promise<CallDto[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/calls`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data || [];
}
