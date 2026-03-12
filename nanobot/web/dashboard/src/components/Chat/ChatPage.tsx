/**
 * Chat page - Interactive chat interface with nanobot
 * Linear/Vercel Style with enhanced thinking process visualization
 * Uses backend Session API for persistence
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader2, ChevronDown, ChevronRight,
  Terminal, Wrench, CheckCircle, XCircle, Zap,
  FileText, Filter
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api, sse } from '@/api/client';
import type { Message } from '@/api/types';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';

// Register languages for syntax highlighting
// Use safe registration that checks if language module is valid
const safeRegister = (name: string, langModule: any) => {
  try {
    if (langModule && typeof langModule === 'object') {
      hljs.registerLanguage(name, langModule);
      return true;
    }
  } catch (e) {
    console.warn(`Failed to register language: ${name}`, e);
  }
  return false;
};

// Language aliases map
const languageAliases: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'sh': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'c++': 'cpp',
};

// Register primary languages
safeRegister('javascript', javascript);
safeRegister('typescript', typescript);
safeRegister('python', python);
safeRegister('bash', bash);
safeRegister('json', json);
safeRegister('xml', xml);
safeRegister('html', xml);
safeRegister('css', css);
safeRegister('java', java);
safeRegister('cpp', cpp);
safeRegister('c', cpp);
safeRegister('go', go);
safeRegister('rust', rust);
safeRegister('sql', sql);
safeRegister('yaml', yaml);
safeRegister('markdown', markdown);

// Helper function to get valid language name
const getValidLanguage = (lang: string): string => {
  const normalized = lang.toLowerCase();
  // Check if language exists
  if (hljs.getLanguage(normalized)) {
    return normalized;
  }
  // Check aliases
  if (languageAliases[normalized]) {
    const alias = languageAliases[normalized];
    if (hljs.getLanguage(alias)) {
      return alias;
    }
  }
  // Fallback to plaintext (auto-detect)
  return 'plaintext';
};

// Types for enhanced chat visualization
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  thinkingSteps?: ThinkingStep[];
  toolCalls?: ToolCallDisplay[];
}

interface ThinkingStep {
  id: string;
  content: string;
  status: 'running' | 'completed' | 'error';
  timestamp: string;
}

interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: 'running' | 'completed' | 'error';
  timestamp: string;
  duration?: number;
}

const WEB_SESSION_KEY = 'web:web';

const DEFAULT_MESSAGE: ChatMessage = {
  role: 'system',
  content: '👋 欢迎使用 nanobot！我可以帮助你完成各种任务。'
};

// Get a display name for session keys
const getSessionDisplayName = (key: string): string => {
  const parts = key.split(':');
  if (parts.length >= 2) {
    const channel = parts[0];
    const identifier = parts.slice(1).join(':');
    // Truncate long identifiers
    const displayId = identifier.length > 20 ? identifier.substring(0, 20) + '...' : identifier;
    return `${channel}: ${displayId}`;
  }
  return key;
};

const Search = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

// Tool icon mapping
const getToolIcon = (toolName: string) => {
  const name = toolName.toLowerCase();
  if (name.includes('bash') || name.includes('shell') || name.includes('terminal')) return <Terminal className="h-4 w-4" />;
  if (name.includes('search') || name.includes('grep') || name.includes('find')) return <Search className="h-4 w-4" />;
  if (name.includes('file') || name.includes('read') || name.includes('write')) return <FileText className="h-4 w-4" />;
  return <Wrench className="h-4 w-4" />;
};

// Tool Call Component (collapsible with arguments and results)
function ToolCallCard({ tool }: { tool: ToolCallDisplay }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${
      tool.status === 'running'
        ? 'border-blue-500/30 bg-blue-500/5'
        : tool.status === 'error'
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-border/50 bg-muted/30'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${
            tool.status === 'running'
              ? 'bg-blue-500/20 text-blue-500'
              : tool.status === 'error'
              ? 'bg-red-500/20 text-red-500'
              : 'bg-muted text-muted-foreground'
          }`}>
            {getToolIcon(tool.name)}
          </div>
          <div>
            <div className="text-xs font-medium">{tool.name}</div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>工具调用</span>
              {tool.duration && <span>• {tool.duration}ms</span>}
              {tool.status === 'running' && <span className="text-blue-500">执行中...</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {tool.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
          {tool.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          {tool.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2">
          {/* Arguments */}
          {Object.keys(tool.arguments).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">参数</div>
              <div className="bg-background rounded p-2 text-xs font-mono overflow-x-auto">
                {JSON.stringify(tool.arguments, null, 2)}
              </div>
            </div>
          )}

          {/* Result */}
          {tool.result && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">结果</div>
              <div className="bg-background rounded p-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                {tool.result}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Execution Process Component - only shows tool calls
function ExecutionProcess({ toolCalls }: { toolCalls?: ToolCallDisplay[] }) {
  const [expanded, setExpanded] = useState(true);

  if (!toolCalls || toolCalls.length === 0) return null;

  const completedCalls = toolCalls.filter(t => t.status === 'completed').length;
  const hasError = toolCalls.some(t => t.status === 'error');
  const isRunning = toolCalls.some(t => t.status === 'running');

  return (
    <div className={`mb-3 rounded-lg border ${hasError ? 'border-orange-500/30 bg-orange-500/5' : 'border-blue-500/20 bg-blue-500/5'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wrench className={`h-3.5 w-3.5 ${hasError ? 'text-orange-500' : 'text-blue-500'} ${isRunning ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-medium">
            执行过程 {completedCalls > 0 && `(${completedCalls}/${toolCalls.length})`}
          </span>
          {isRunning && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          )}
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {toolCalls.map((tool) => (
            <ToolCallCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}

// Loading/Execution Indicator Component
function ThinkingIndicator({ progress, currentStep }: { progress?: string; currentStep?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
        <Zap className="h-4 w-4 text-blue-500 relative" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground">{currentStep || '执行中...'}</div>
        {progress && <div className="text-[10px] text-muted-foreground truncate">{progress}</div>}
      </div>
      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [progress, setProgress] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([]);
  const [allSessions, setAllSessions] = useState<string[]>([]);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>(WEB_SESSION_KEY);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refs to avoid closure issues in SSE handlers
  const thinkingStepsRef = useRef<ThinkingStep[]>([]);
  const toolCallsRef = useRef<ToolCallDisplay[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    thinkingStepsRef.current = thinkingSteps;
  }, [thinkingSteps]);

  useEffect(() => {
    toolCallsRef.current = toolCalls;
  }, [toolCalls]);

  const { connected, sendMessage } = useWebSocket();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progress, currentStep, thinkingSteps, toolCalls]);

  // Load all sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessionsData = await api.listSessions({ limit: 100, offset: 0 });
        const sessionKeys = sessionsData.sessions.map(s => s.key);
        setAllSessions(sessionKeys);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    };
    loadSessions();
  }, []);

  // Load session from backend on mount and when selected session changes
  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoadingSession(true);
        const session = await api.getSession(selectedSessionKey);
        if (session.messages && session.messages.length > 0) {
          // First, build a map of tool_call_id -> tool result
          const toolResults = new Map<string, { name: string; content: string; timestamp?: string }>();
          for (const msg of session.messages) {
            if (msg.role === 'tool' && msg.tool_call_id) {
              toolResults.set(msg.tool_call_id, {
                name: msg.name || 'unknown',
                content: msg.content,
                timestamp: msg.timestamp
              });
            }
          }

          // Second pass: build chat messages
          let accumulatedToolCalls: ToolCallDisplay[] = [];

          const chatMessages: ChatMessage[] = session.messages
            .filter((msg: Message) => {
              // Keep user messages and system messages always
              if (msg.role === 'user' || msg.role === 'system') return true;
              // Keep assistant messages if they have content OR have tool_calls
              if (msg.role === 'assistant') {
                return msg.content != null || (msg.tool_calls && msg.tool_calls.length > 0);
              }
              // Filter out tool messages
              return false;
            })
            .map((msg: Message) => {
              const chatMsg: ChatMessage = {
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content || '',
                timestamp: msg.timestamp,
              };

              // Check if this assistant message has tool calls
              if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                const toolCallsForMsg = msg.tool_calls.map((tc): ToolCallDisplay => {
                  // Parse the function structure: tc.function.name, tc.function.arguments (as JSON string)
                  const func = (tc as any).function;
                  const toolName = func?.name || tc.name;
                  let args = tc.arguments;

                  // If arguments is a string, try to parse it
                  if (typeof args === 'string') {
                    try {
                      args = JSON.parse(args);
                    } catch {
                      args = { raw: args };
                    }
                  } else if (func?.arguments) {
                    // Arguments might be in the function object as a string
                    if (typeof func.arguments === 'string') {
                      try {
                        args = JSON.parse(func.arguments);
                      } catch {
                        args = { raw: func.arguments };
                      }
                    } else {
                      args = func.arguments;
                    }
                  }

                  const toolResult = toolResults.get(tc.id);
                  return {
                    id: tc.id,
                    name: toolName,
                    arguments: args as Record<string, unknown>,
                    status: 'completed' as const,
                    result: toolResult?.content,
                    timestamp: msg.timestamp || new Date().toISOString(),
                  };
                });

                // If this message has content, attach the tool calls to it
                if (msg.content) {
                  chatMsg.toolCalls = toolCallsForMsg;
                } else {
                  // This is an intermediate message with only tool calls
                  // Accumulate them for the next assistant message with content
                  accumulatedToolCalls.push(...toolCallsForMsg);
                  // Filter out this message since it has no content
                  return null;
                }
              }

              // If we have accumulated tool calls and this message has content, attach them
              if (chatMsg.content && accumulatedToolCalls.length > 0 && msg.role === 'assistant') {
                chatMsg.toolCalls = accumulatedToolCalls;
                accumulatedToolCalls = [];
              }

              // Parse thinking steps from content if it contains thinking markers
              // For historical messages, all steps should be marked as completed
              if (msg.role === 'assistant' && msg.content) {
                const steps: ThinkingStep[] = [];
                const stepPattern = /([✅❌⏳🔧📝✨])\s*([^\n]+)/g;
                let match;
                while ((match = stepPattern.exec(msg.content)) !== null) {
                  // For historical messages, always use 'completed' status
                  steps.push({
                    id: `history-${steps.length}-${Date.now()}`,
                    content: match[2],
                    status: 'completed' as const,
                    timestamp: msg.timestamp || new Date().toISOString(),
                  });
                }
                if (steps.length > 0) {
                  chatMsg.thinkingSteps = steps;
                }
              }

              return chatMsg;
            })
            .filter((msg): msg is ChatMessage => msg !== null);  // Remove null messages

          setMessages(chatMessages.length > 0 ? chatMessages : [DEFAULT_MESSAGE]);
        } else {
          setMessages([DEFAULT_MESSAGE]);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        setMessages([DEFAULT_MESSAGE]);
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [selectedSessionKey]);

  // Set up SSE message handlers
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === 'message' && msg.content) {
        // Use refs to get the latest values
        let currentSteps = [...thinkingStepsRef.current];
        let currentTools = [...toolCallsRef.current];

        // Mark all thinking steps as completed when final message arrives
        currentSteps = currentSteps.map(step => ({
          ...step,
          status: 'completed' as const
        }));

        // Mark all tool calls as completed when final message arrives
        currentTools = currentTools.map(tool => ({
          ...tool,
          status: 'completed' as const
        }));

        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: msg.content,
          thinkingSteps: currentSteps,
          toolCalls: currentTools
        }]);
        setLoading(false);
        setProgress('');
        setCurrentStep('');
        setThinkingSteps([]);
        setToolCalls([]);
      } else if (msg.type === 'progress') {
        if (msg.content) {
          setProgress(msg.content);
          // Extract step name from progress
          const stepMatch = msg.content.match(/^(.+?):/);
          if (stepMatch) {
            setCurrentStep(stepMatch[1]);
          } else {
            setCurrentStep(msg.content);
          }
          // Add to thinking steps
          setThinkingSteps((prev) => {
            const stepId = `step-${Date.now()}`;
            const newStep: ThinkingStep = {
              id: stepId,
              content: msg.content,
              status: 'running',
              timestamp: new Date().toISOString()
            };
            // Update previous running step to completed
            const updated = prev.map(s =>
              s.status === 'running' ? { ...s, status: 'completed' as const } : s
            );
            return [...updated, newStep];
          });
        }
      } else if (msg.type === 'tool_call') {
        // New tool call started
        const newToolCall: ToolCallDisplay = {
          id: msg.tool_id || `tool-${Date.now()}`,
          name: msg.tool_name || 'unknown',
          arguments: msg.arguments || {},
          status: 'running',
          timestamp: new Date().toISOString()
        };
        setToolCalls((prev) => [...prev, newToolCall]);
        setCurrentStep(`调用工具: ${newToolCall.name}`);
      } else if (msg.type === 'tool_result') {
        // Tool call completed
        setToolCalls((prev) => prev.map(t =>
          t.id === msg.tool_id
            ? {
                ...t,
                status: msg.error ? 'error' : 'completed',
                result: msg.result || (msg.error ? String(msg.error) : undefined),
                duration: msg.duration
              }
            : t
        ));
        // Complete the current thinking step
        setThinkingSteps((prev) => prev.map(s =>
          s.status === 'running' ? { ...s, status: 'completed' as const } : s
        ));
      }
    };

    const unsubscribeMessage = sse.on('message', handleMessage);
    const unsubscribeProgress = sse.on('progress', handleMessage);
    const unsubscribeToolCall = sse.on('tool_call', handleMessage);
    const unsubscribeToolResult = sse.on('tool_result', handleMessage);

    return () => {
      unsubscribeMessage();
      unsubscribeProgress();
      unsubscribeToolCall();
      unsubscribeToolResult();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setProgress('');
    setCurrentStep('');
    setThinkingSteps([]);
    setToolCalls([]);

    sendMessage({
      type: 'message',
      content: userMessage,
      sender_id: 'web_user',
    });
  };

  const formatContent = (content: string | null | undefined) => {
    // Handle null/undefined content
    if (!content) {
      return '';
    }
    let formatted = content;

    // Escape HTML function
    const escapeHtml = (text: string) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Code blocks with syntax highlighting
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      const originalLang = lang || 'text';
      // Get valid language name
      const validLanguage = getValidLanguage(originalLang);
      const displayLanguage = originalLang || 'plaintext';

      try {
        const highlighted = hljs.highlight(code, { language: validLanguage }).value;
        return `
          <div class="group relative my-2">
            <div class="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-t text-xs text-muted-foreground border border-border/50">
              <span class="font-mono">${escapeHtml(displayLanguage)}</span>
            </div>
            <pre class="bg-muted/30 p-3 rounded-b overflow-x-auto text-sm"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
          </div>
        `;
      } catch {
        // Fallback: escape and display as plain code
        return `<pre class="bg-muted/30 p-3 rounded overflow-x-auto text-sm"><code>${escapeHtml(code)}</code></pre>`;
      }
    });

    // Inline code (process before line breaks to avoid conflicts)
    formatted = formatted.replace(/`([^`\n]+)`/g, (_match, code) => {
      return `<code class="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono text-blue-600 dark:text-blue-400">${escapeHtml(code)}</code>`;
    });

    // Line breaks (but not in code blocks - already handled)
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  };

  if (loadingSession) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">加载对话历史...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex flex-col">
      {/* Session Selector Header */}
      <div className="flex items-center gap-4 pb-3 mb-3 border-b border-border/50">
        <div className="flex items-center gap-2 flex-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedSessionKey}
            onChange={(e) => setSelectedSessionKey(e.target.value)}
            className="input flex-1 max-w-md text-sm"
          >
            {allSessions.length > 0 ? (
              allSessions.map((key) => (
                <option key={key} value={key}>{getSessionDisplayName(key)}</option>
              ))
            ) : (
              <option value={WEB_SESSION_KEY}>Web 会话</option>
            )}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {connected ? '已连接' : '未连接'}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`fade-in ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
            >
              {msg.role === 'system' ? (
                <div className="mx-auto px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
                  {msg.content}
                </div>
              ) : (
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      : 'bg-muted'
                  }`}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 space-y-2 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                    {/* Execution Process (for assistant messages) - shown BEFORE reply */}
                    {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                      <ExecutionProcess toolCalls={msg.toolCalls} />
                    )}

                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-muted/50 border border-border/50'
                    }`}>
                      <div
                        dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                        className="prose prose-sm max-w-none dark:prose-invert prose-p:text-sm prose-pre:text-xs [&_pre]:bg-muted/30 [&_pre_code]:bg-muted/30 [&_code]:bg-muted/30"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Current loading/processing state */}
          {loading && (
            <div className="fade-in flex gap-3 justify-start max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                {/* Thinking indicator */}
                <ThinkingIndicator progress={progress} currentStep={currentStep} />

                {/* Active execution process with tool calls */}
                {toolCalls.length > 0 && (
                  <ExecutionProcess toolCalls={toolCalls} />
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="pt-2">
        <div className="flex items-end gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? `发送消息到 ${getSessionDisplayName(selectedSessionKey)}... (Enter 发送)` : "连接中..."}
            disabled={loading}
            className="input flex-1 h-11"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary h-11 px-4 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
