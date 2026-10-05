// ============================================================
// MEDCORE HMS - RESILIENT FETCH API CLIENT WITH AUTO-REFRESH
// ============================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const TOKEN_KEY = 'medcore_access_token';

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string | null) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export class ApiError extends Error {
  statusCode: number;
  data: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipAuth, headers: customHeaders, ...customConfig } = options;

  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const token = getStoredToken();
  if (!skipAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
    credentials: 'include', // Needed for refreshToken cookie
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(
      'Unable to connect to the hospital server. Please check your network connection.',
      0,
      err,
    );
  }

  // Handle 401 Unauthorized - Attempt Token Refresh
  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          const data = (await refreshResponse.json()) as { accessToken: string };
          setStoredToken(data.accessToken);
          onRefreshed(data.accessToken);
          isRefreshing = false;

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${data.accessToken}`;
          return apiClient<T>(endpoint, { ...options, headers });
        } else {
          setStoredToken(null);
          onRefreshed(null);
          isRefreshing = false;
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.replace('/login?expired=1');
          }
        }
      } catch {
        setStoredToken(null);
        onRefreshed(null);
        isRefreshing = false;
      }
    } else {
      // Queue requests waiting for refresh
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            resolve(apiClient<T>(endpoint, { ...options, headers }));
          } else {
            reject(new ApiError('Session expired. Please log in again.', 401));
          }
        });
      });
    }
  }

  // Parse response
  let responseData: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    let errorMessage = 'An unexpected error occurred';
    if (responseData && typeof responseData === 'object') {
      const dataObj = responseData as { message?: string | string[]; error?: string };
      if (Array.isArray(dataObj.message)) {
        errorMessage = dataObj.message.join(', ');
      } else if (typeof dataObj.message === 'string') {
        errorMessage = dataObj.message;
      } else if (typeof dataObj.error === 'string') {
        errorMessage = dataObj.error;
      }
    } else if (typeof responseData === 'string' && responseData.length > 0) {
      errorMessage = responseData;
    } else {
      errorMessage = `Server error (${response.status}: ${response.statusText})`;
    }

    throw new ApiError(errorMessage, response.status, responseData);
  }

  // Transparently unwrap standard MedCore backend { success: true, data: ... } envelopes
  if (
    responseData &&
    typeof responseData === 'object' &&
    'success' in responseData &&
    'data' in responseData &&
    (responseData as Record<string, unknown>).success === true
  ) {
    const rawData = (responseData as Record<string, unknown>).data;
    if (rawData && (typeof rawData === 'object' || Array.isArray(rawData))) {
      try {
        Object.assign(rawData, {
          data: rawData,
          success: true,
          message: (responseData as Record<string, unknown>).message,
        });
      } catch {
        // In case object is sealed or frozen
      }
    }
    return (rawData !== undefined ? rawData : responseData) as T;
  }

  return responseData as T;
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
