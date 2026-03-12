/**
 * API client for nanobot dashboard
 */

import type {
  ConfigData,
  CronJob,
  Session,
  SessionDetail,
  SystemStatus,
  Tool,
  WebSocketMessage,
} from './types';

const API_BASE = '/api';

/**
 * REST API Client
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'API request failed');
    }

    return response.json();
  }

  // Sessions
  async listSessions(params?: { limit?: number; offset?: number }): Promise<{ total: number; sessions: Session[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    return this.request<{ total: number; sessions: Session[] }>(`/sessions?${query}`);
  }

  async getSession(key: string): Promise<SessionDetail> {
    return this.request<SessionDetail>(`/sessions/${encodeURIComponent(key)}`);
  }

  async deleteSession(key: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/sessions/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  // Cron Jobs
  async listCronJobs(includeDisabled = false): Promise<{ jobs: CronJob[]; total: number }> {
    return this.request<{ jobs: CronJob[]; total: number }>(`/cron/jobs?include_disabled=${includeDisabled}`);
  }

  async createCronJob(job: Partial<CronJob>): Promise<{ message: string; job_id: string }> {
    return this.request<{ message: string; job_id: string }>('/cron/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
  }

  async deleteCronJob(jobId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/cron/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });
  }

  async updateCronJob(jobId: string, updates: { enabled?: boolean }): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/cron/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Tools
  async listTools(): Promise<{ tools: Tool[]; total: number }> {
    return this.request<{ tools: Tool[]; total: number }>('/tools');
  }

  async getTool(name: string): Promise<Tool> {
    return this.request<Tool>(`/tools/${encodeURIComponent(name)}`);
  }

  // Memory
  async getMemory(): Promise<{ content: string }> {
    return this.request<{ content: string }>('/memory');
  }

  async getMemoryHistory(): Promise<{ content: string }> {
    return this.request<{ content: string }>('/memory/history');
  }

  async updateMemory(content: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/memory', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  // Config
  async getConfig(): Promise<ConfigData> {
    return this.request<ConfigData>('/config');
  }

  async updateConfig(updates: Partial<ConfigData>): Promise<{ message: string }> {
    return this.request<{ message: string }>('/config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Status & Stats
  async getStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/status');
  }

  async getStats(): Promise<{ uptime: string; total_connections: number; available_tools?: number }> {
    return this.request('/stats');
  }

  // Health
  async health(): Promise<{ status: string; connections: number }> {
    return this.request<{ status: string; connections: number }>('/health');
  }
}

/**
 * SSE (Server-Sent Events) Client
 */
class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, (msg: WebSocketMessage) => void> = new Map();
  private connectionChangeHandlers: ((connected: boolean) => void)[] = [];
  private manuallyDisconnected = false;
  private clientId: string;

  constructor(url: string = '/sse') {
    const protocol = window.location.protocol;
    const host = window.location.host;
    this.url = `${protocol}//${host}${url}`;
    // Generate a persistent client ID for this session
    this.clientId = `sse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.manuallyDisconnected = false;

    try {
      // Add client_id as query parameter
      const urlWithClientId = `${this.url}?client_id=${this.clientId}`;
      this.eventSource = new EventSource(urlWithClientId);

      this.eventSource.onopen = () => {
        console.log('SSE connected');
        this.reconnectAttempts = 0;
        this.notifyConnectionChange(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          if (message.type !== 'ping') {
            this.handleMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.notifyConnectionChange(false);
        // EventSource automatically reconnects, but we'll handle it manually for more control
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.manuallyDisconnected) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 10000);
      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.log('Max reconnection attempts reached');
    }
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.notifyConnectionChange(false);
    }
  }

  async send(message: WebSocketMessage | Record<string, unknown>): Promise<void> {
    try {
      // Add sse_client_id to the message
      const messageWithId = { ...message, sse_client_id: this.clientId };
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageWithId),
      });

      if (!response.ok) {
        console.error('Failed to send message via SSE POST endpoint');
      }
    } catch (error) {
      console.error('Error sending message via SSE:', error);
    }
  }

  getClientId(): string {
    return this.clientId;
  }

  on(type: string, handler: (msg: WebSocketMessage) => void): () => void {
    this.messageHandlers.set(type, handler);
    return () => this.messageHandlers.delete(type);
  }

  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionChangeHandlers.push(handler);
    return () => {
      const index = this.connectionChangeHandlers.indexOf(handler);
      if (index > -1) {
        this.connectionChangeHandlers.splice(index, 1);
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionChangeHandlers.forEach(handler => handler(connected));
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Export singleton instances
export const api = new ApiClient();
export const sse = new SSEClient();
