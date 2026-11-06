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
  is_simulated?: boolean;
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
  agentPhone?: string;
  agentEndpointUri?: string;
  notes?: string;
  leadId?: string;
  agentId?: string;
}

/**
 * Normalizes an external backend origin URL by stripping whitespace, trailing slashes,
 * and any mistakenly appended '/api/v1' or '/api' suffixes so that endpoint paths
 * (which start with '/api/v1') are constructed cleanly without duplication.
 */
export const normalizeBackendOrigin = (url: string): string => {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/api\/?$/, '');
};

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).__ONCALL_API_URL__) {
    return normalizeBackendOrigin(String((window as any).__ONCALL_API_URL__));
  }
  const storage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any).localStorage;
  if (storage) {
    const runtimeUrl = storage.getItem('onground_backend_url');
    if (runtimeUrl && runtimeUrl.trim()) {
      return normalizeBackendOrigin(runtimeUrl);
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_API_URL) {
    return normalizeBackendOrigin(String(import.meta.env.VITE_BACKEND_API_URL));
  }
  return '';
};

/**
 * Checks whether an external backend URL or local dev environment is available.
 * Returns false on production static hosts (like Vercel) if VITE_BACKEND_API_URL is omitted or invalid.
 */
export const isConfiguredBackendAvailable = (isProdOverride?: boolean): boolean => {
  const baseUrl = getApiBaseUrl();

  const isProd = isProdOverride !== undefined
    ? isProdOverride
    : (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD)) ||
      (typeof window !== 'undefined' && Boolean(window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== '[::1]'));

  if (baseUrl) {
    // In production, pointing to localhost is invalid and rejected
    if (isProd && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('[::1]'))) {
      return false;
    }
    return true;
  }

  // In production Vite build or non-localhost host without configured backend URL
  if (isProd) {
    return false;
  }

  // Local development with Vite proxy to localhost:8000 or Node test environment
  return true;
};

const DEV_AGENT_ID = '00000000-0000-0000-0000-000000000001';

const getHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = typeof window !== 'undefined'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('auth_token') : null)
    : null;

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    headers['X-Dev-Agent-Id'] = DEV_AGENT_ID;
  }

  return headers;
};

/**
 * Robust JSON request wrapper that validates response content types and provides
 * clear, actionable error messages if the backend is unreachable or returning HTML (e.g. Vercel SPA rewrites).
 */
async function requestJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  if (!isConfiguredBackendAvailable()) {
    if (baseUrl && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('[::1]'))) {
      throw new Error(
        `Invalid backend configuration: Production frontend cannot point to localhost (${baseUrl}). ` +
        `Please configure VITE_BACKEND_API_URL with a publicly accessible HTTPS backend URL in Vercel settings.`
      );
    }
    throw new Error(
      `FastAPI backend URL not configured (VITE_BACKEND_API_URL is missing). ` +
      `The production frontend at ${typeof window !== 'undefined' ? window.location.origin : 'host'} requires an external deployed FastAPI server for PSTN carrier calling. ` +
      `Please configure VITE_BACKEND_API_URL in your Vercel Project Settings.`
    );
  }

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (netErr: any) {
    const target = baseUrl || 'http://localhost:8000';
    throw new Error(
      `FastAPI backend unreachable at ${target}. ` +
      `Please ensure your backend server is running: 'uvicorn backend.app.main:app --reload --port 8000' ` +
      `(${netErr?.message || 'Connection refused'})`
    );
  }

  // Handle static hosting 405 Method Not Allowed (e.g. Vercel routing POST to index.html)
  if (res.status === 405) {
    throw new Error(
      `Production backend error: HTTP 405 Method Not Allowed from ${url}. ` +
      `The static frontend received a POST request because no external FastAPI backend URL is configured. ` +
      `Please configure VITE_BACKEND_API_URL in your Vercel Project Settings to point to your live FastAPI backend.`
    );
  }

  // Handle static hosting 404 Not Found on API routes
  if (res.status === 404) {
    const ct = res.headers?.get ? (res.headers.get('content-type') || '') : '';
    if (!ct.includes('application/json')) {
      throw new Error(
        `FastAPI backend endpoint not found (HTTP 404 from ${url}). ` +
        `No backend service answered at this URL. Ensure VITE_BACKEND_API_URL points to the correct FastAPI host.`
      );
    }
  }

  const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : 'application/json';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    if (rawText.includes('<!DOCTYPE') || rawText.includes('<html') || rawText.includes('<head')) {
      throw new Error(
        `Backend returned HTML instead of JSON from ${endpoint} (HTTP ${res.status}). ` +
        `This occurs when running on Vercel without a configured VITE_BACKEND_API_URL, or when the local dev proxy ` +
        `cannot reach port 8000. Configure VITE_BACKEND_API_URL or start FastAPI via 'uvicorn backend.app.main:app --reload --port 8000'.`
      );
    }
    throw new Error(`Unexpected non-JSON response from backend (HTTP ${res.status}): ${rawText.slice(0, 150)}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Failed to parse backend JSON response from ${endpoint} (HTTP ${res.status})`);
  }

  if (!res.ok) {
    let errMessage: string;
    if (json?.detail) {
      if (typeof json.detail === 'string') {
        errMessage = json.detail;
      } else if (Array.isArray(json.detail)) {
        errMessage = json.detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join(', ');
      } else {
        errMessage = JSON.stringify(json.detail);
      }
    } else if (json?.message) {
      errMessage = typeof json.message === 'string' ? json.message : JSON.stringify(json.message);
    } else {
      errMessage = `HTTP ${res.status} Error from telephony service`;
    }
    throw new Error(errMessage);
  }

  return json;
}

/**
 * Initiates an authentic outbound PSTN phone call via the backend telephony provider (Twilio/Plivo).
 */
export async function initiateOutboundCall(params: InitiateCallParams): Promise<CallDto> {
  const json = await requestJson<{ data: CallDto }>('/api/v1/calls', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      customer_phone: params.customerPhone,
      customer_name: params.customerName || 'Customer',
      agent_phone: params.agentPhone,
      agent_endpoint_uri: params.agentEndpointUri || params.agentPhone,
      notes: params.notes,
      lead_id: params.leadId,
      agent_id: params.agentId,
      direction: 'OUTBOUND',
    }),
  });

  return json.data;
}

/**
 * Fetches the current live status and legs of a call.
 */
export async function fetchCallStatus(callId: string): Promise<CallDto> {
  const json = await requestJson<{ data: CallDto }>(`/api/v1/calls/${callId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  return json.data;
}

/**
 * Terminates an ongoing or ringing PSTN call.
 */
export async function terminateCall(callId: string, reason?: string): Promise<CallDto> {
  const json = await requestJson<{ data: CallDto }>(`/api/v1/calls/${callId}/terminate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      reason: reason || 'Agent terminated call from interface',
    }),
  });

  return json.data;
}

/**
 * Retrieves the recent call log from the backend database.
 */
export async function listRecentCalls(): Promise<CallDto[]> {
  try {
    const json = await requestJson<{ data: CallDto[] }>('/api/v1/calls', {
      method: 'GET',
      headers: getHeaders(),
    });
    return json.data || [];
  } catch {
    return [];
  }
}

/**
 * Bridges active agent and customer legs into a shared conference room.
 */
export async function bridgeCall(callId: string): Promise<CallDto> {
  const json = await requestJson<{ data: CallDto }>(`/api/v1/calls/${callId}/bridge`, {
    method: 'POST',
    headers: getHeaders(),
  });

  return json.data;
}
