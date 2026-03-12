/**
 * API types for nanobot dashboard
 */

export interface Session {
  key: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  tool_calls?: ToolCall[];
  // Tool result message fields
  tool_call_id?: string;
  name?: string;  // Tool name for result messages
}

export interface ToolCall {
  id: string;
  type: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CronJob {
  id: string;
  name: string;
  schedule_type: 'at' | 'every' | 'cron';
  schedule: string;
  payload: CronPayload;
  enabled: boolean;
  created_at: string;
  next_run?: string;
}

export interface CronPayload {
  message: string;
  deliver: boolean;
  channel: string;
  to: string;
}

export interface Tool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface SystemStatus {
  connections: number;
  running: boolean;
  host: string;
  port: number;
  inbound_queue?: number;
  outbound_queue?: number;
  sessions?: number;
  cron_jobs?: number;
}

export interface WebSocketMessage {
  type: 'message' | 'progress' | 'tool_call' | 'tool_result' | 'status' | 'event' | 'system' | 'ping' | 'pong';
  content?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface WebSocketSendMessage {
  type: 'message' | 'ping';
  content?: string;
  sender_id?: string;
  [key: string]: unknown;
}

export interface ConfigData {
  agents?: Record<string, unknown>;
  channels?: Record<string, unknown>;
  providers?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
}
