/**
 * Chat page - Interactive chat interface with nanobot
 * Linear/Vercel Style with enhanced thinking process visualization
 * Uses backend Session API for persistence
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader2, Search, Download, Trash2, X,
  MoreVertical, RefreshCw, ChevronDown, ChevronRight,
  Terminal, Wrench, CheckCircle, XCircle, Zap,
  Braces, FileText, GitBranch, Sparkles
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api, sse } from '@/api/client';
import type { Message } from '@/api/types';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';

// Register languages for syntax highlighting
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);

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

const QUICK_COMMANDS = [
  { label: '总结对话', prompt: '请总结我们当前的对话内容' },
  { label: '帮助', prompt: '你能帮我做什么？' },
  { label: '系统状态', prompt: '请告诉我当前系统状态' },
];

const DEFAULT_MESSAGE: ChatMessage = {
  role: 'system',
  content: '👋 欢迎使用 nanobot！我可以帮助你完成各种任务。'
};

// Icons for different thinking step types
const getStepIcon = (content: string) => {
  const lower = content.toLowerCase();
  if (lower.includes('搜索') || lower.includes('search') || lower.includes('查找')) return <Search className="h-3.5 w-3.5" />;
  if (lower.includes('工具') || lower.includes('tool') || lower.includes('调用')) return <Wrench className="h-3.5 w-3.5" />;
  if (lower.includes('分析') || lower.includes('analyze')) return <Braces className="h-3.5 w-3.5" />;
  if (lower.includes('思考') || lower.includes('think') || lower.includes('reasoning')) return <Sparkles className="h-3.5 w-3.5" />;
  if (lower.includes('读取') || lower.includes('read') || lower.includes('file')) return <FileText className="h-3.5 w-3.5" />;
  if (lower.includes('分支') || lower.includes('plan') || lower.includes('strategy')) return <GitBranch className="h-3.5 w-3.5" />;
  return <Zap className="h-3.5 w-3.5" />;
};

// Tool icon mapping
const getToolIcon = (toolName: string) => {
  const name = toolName.toLowerCase();
  if (name.includes('bash') || name.includes('shell') || name.includes('terminal')) return <Terminal className="h-4 w-4" />;
  if (name.includes('search') || name.includes('grep') || name.includes('find')) return <Search className="h-4 w-4" />;
  if (name.includes('file') || name.includes('read') || name.includes('write')) return <FileText className="h-4 w-4" />;
  return <Wrench className="h-4 w-4" />;
};

// Thinking Process Component
function ThinkingProcess({ steps }: { steps: ThinkingStep[] }) {
  const [expanded, setExpanded] = useState(true);

  if (steps.length === 0) return null;

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const hasError = steps.some(s => s.status === 'error');

  return (
    <div className={`mb-3 rounded-lg border ${hasError ? 'border-orange-500/30 bg-orange-500/5' : 'border-primary/20 bg-primary/5'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className={`h-3.5 w-3.5 ${hasError ? 'text-orange-500' : 'text-primary'} animate-pulse`} />
          <span className="text-xs font-medium">
            思考过程 {completedSteps > 0 && `(${completedSteps}/${steps.length})`}
          </span>
          {steps.some(s => s.status === 'running') && (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-start gap-2 text-xs py-1.5 px-2 rounded ${
                step.status === 'running'
                  ? 'bg-primary/10 border border-primary/20'
                  : step.status === 'error'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-muted/30'
              }`}
            >
              <div className={`flex-shrink-0 mt-0.5 ${
                step.status === 'running' ? 'text-primary' :
                step.status === 'error' ? 'text-red-500' : 'text-green-500'
              }`}>
                {step.status === 'running' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : step.status === 'error' ? (
                  <XCircle className="h-3 w-3" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {getStepIcon(step.content)}
                <span className={step.status === 'running' ? 'text-foreground' : ''}>{step.content}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tool Call Component
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

// Loading/Thinking Indicator Component
function ThinkingIndicator({ progress, currentStep }: { progress?: string; currentStep?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <Sparkles className="h-4 w-4 text-primary relative" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground">{currentStep || '思考中...'}</div>
        {progress && <div className="text-[10px] text-muted-foreground truncate">{progress}</div>}
      </div>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActions, setShowActions] = useState(false);
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

  // Filter messages for search
  const filteredMessages = searchQuery
    ? messages.filter(msg =>
        (msg.content && msg.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
        msg.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progress, currentStep, thinkingSteps, toolCalls, searchQuery]);

  // Load session from backend on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoadingSession(true);
        const session = await api.getSession(WEB_SESSION_KEY);
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

          // Then process messages and reconstruct tool calls
          // We need to collect all tool calls and associate them with the final assistant message

          // First pass: collect tool results and find which assistant messages have tool calls
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
                    status: toolResult ? 'completed' : 'completed',
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
                  // (error status would only be for actual failed steps, which we don't track in history)
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
  }, []);

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

  // Refresh session from backend
  const refreshSession = async () => {
    try {
      setLoadingSession(true);
      const session = await api.getSession(WEB_SESSION_KEY);
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

        // Process messages and reconstruct tool calls
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
                  status: toolResult ? 'completed' : 'completed',
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
                  id: `history-${Date.now()}-${steps.length}`,
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
      console.error('Failed to refresh session:', error);
    } finally {
      setLoadingSession(false);
    }
  };

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

  const handleQuickCommand = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const clearChat = async () => {
    if (!confirm('确定要清空当前对话吗？清空后，对话历史将从服务器删除。')) return;

    try {
      await api.deleteSession(WEB_SESSION_KEY);
      setMessages([{ role: 'system', content: '对话已清空' }]);
      setSearchQuery('');
      setThinkingSteps([]);
      setToolCalls([]);
    } catch (error) {
      console.error('Failed to clear session:', error);
      alert('清空对话失败');
    }
  };

  const exportAsMarkdown = () => {
    let markdown = '# nanobot 对话记录\n\n';
    markdown += `导出时间: ${new Date().toLocaleString()}\n\n---\n\n`;

    filteredMessages.forEach((msg) => {
      const roleLabel = { user: '用户', assistant: '助手', system: '系统' }[msg.role] || msg.role;
      markdown += `## ${roleLabel}\n\n${msg.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = () => {
    const blob = new Blob([JSON.stringify(filteredMessages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatContent = (content: string | null | undefined) => {
    // Handle null/undefined content
    if (!content) {
      return '';
    }
    let formatted = content;

    // Code blocks with syntax highlighting
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      const language = lang || 'text';
      try {
        const highlighted = hljs.highlight(code, { language }).value;
        return `
          <div class="group relative my-2">
            <div class="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-t text-xs text-muted-foreground border border-border/50">
              <span class="font-mono">${language}</span>
            </div>
            <pre class="bg-muted/30 p-3 rounded-b overflow-x-auto text-sm"><code class="hljs language-${language}">${highlighted}</code></pre>
          </div>
        `;
      } catch {
        return `<pre class="bg-muted/30 p-3 rounded text-sm"><code>${code}</code></pre>`;
      }
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono text-blue-600 dark:text-blue-400">$1</code>');

    // Line breaks
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
      {/* Toolbar */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`icon-btn ${searchOpen ? 'bg-accent text-accent-foreground' : ''}`}
            title="搜索"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={refreshSession}
            className="icon-btn"
            title="刷新对话"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={clearChat}
            className="icon-btn text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            title="清空对话"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportAsMarkdown}
            className="icon-btn"
            title="导出 Markdown"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5 text-xs">MD</span>
          </button>
          <button
            onClick={exportAsJSON}
            className="icon-btn"
            title="导出 JSON"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5 text-xs">JSON</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && (
        <div className="fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="搜索消息内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input h-9 pl-9 pr-8"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            找到 {filteredMessages.length} 条结果
          </p>
        </div>
      )}

      {/* Quick Commands */}
      {!searchOpen && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin -mx-4 px-4">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => handleQuickCommand(cmd.prompt)}
              className="whitespace-nowrap btn btn-ghost text-xs h-8 px-3"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <div className="space-y-4">
          {filteredMessages.map((msg, idx) => (
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

                  {/* Content - Thinking process comes FIRST (before the reply) */}
                  <div className={`flex-1 space-y-2 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                    {/* Thinking Steps (for assistant messages) - shown BEFORE reply */}
                    {msg.role === 'assistant' && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                      <ThinkingProcess steps={msg.thinkingSteps} />
                    )}

                    {/* Tool Calls (for assistant messages) - shown BEFORE reply */}
                    {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="space-y-2">
                        {msg.toolCalls.map((tool) => (
                          <ToolCallCard key={tool.id} tool={tool} />
                        ))}
                      </div>
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

                {/* Active thinking steps */}
                {thinkingSteps.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-1.5">
                    {thinkingSteps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                          step.status === 'running'
                            ? 'bg-primary/10'
                            : step.status === 'error'
                            ? 'bg-red-500/10'
                            : 'bg-muted/30'
                        }`}
                      >
                        <div className={
                          step.status === 'running' ? 'text-primary' :
                          step.status === 'error' ? 'text-red-500' : 'text-green-500'
                        }>
                          {step.status === 'running' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : step.status === 'error' ? (
                            <XCircle className="h-3 w-3" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getStepIcon(step.content)}
                          <span className={step.status === 'running' ? 'text-foreground' : ''}>{step.content}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active tool calls */}
                {toolCalls.length > 0 && (
                  <div className="space-y-2">
                    {toolCalls.map((tool) => (
                      <ToolCallCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="pt-2">
        <div className="relative flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={connected ? "输入消息..." : "连接中..."}
              disabled={loading}
              className="input pr-12 h-11 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !loading) {
                    const formEvent = new Event('submit', { bubbles: true, cancelable: true });
                    e.currentTarget.dispatchEvent(formEvent);
                  }
                }
              }}
            />
            {/* Action button */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button
                type="button"
                onClick={() => setShowActions(!showActions)}
                className="icon-btn h-7 w-7"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
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

        {/* Connection Status */}
        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {connected ? '已连接' : '连接中...'}
        </div>
      </form>
    </div>
  );
}
