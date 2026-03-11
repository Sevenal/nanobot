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
const WS_URL = '/ws';

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
 * WebSocket Client
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, (msg: WebSocketMessage) => void> = new Map();
  private connectionChangeHandlers: ((connected: boolean) => void)[] = [];

  constructor(url: string = WS_URL) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}${url}`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.notifyConnectionChange(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 10000);
      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage | Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
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
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instances
export const api = new ApiClient();
export const ws = new WebSocketClient();
