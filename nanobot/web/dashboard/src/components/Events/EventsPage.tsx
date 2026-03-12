/**
 * Events page - Real-time event log
 * Linear/Vercel Style
 */

import { useState, useEffect, useRef } from 'react';
import { Activity, Trash2 } from 'lucide-react';
import { sse } from '@/api/client';

interface EventEntry {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
}

export default function Events() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Track connection status
    const unsubscribeConn = sse.onConnectionChange((isConnected) => {
      setConnected(isConnected);
    });

    // Add initial event
    const addEvent = (type: string, message: string) => {
      const event: EventEntry = {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date(),
      };
      setEvents((prev) => [event, ...prev].slice(0, 1000));
    };

    // Setup SSE message handler for all types
    const handleMessage = (msg: any) => {
      if (msg.type && msg.type !== 'ping' && msg.type !== 'pong') {
        addEvent(msg.type, msg.content || JSON.stringify(msg));
      }
    };

    const unsubMessage = sse.on('message', handleMessage);
    const unsubProgress = sse.on('progress', handleMessage);
    const unsubToolCall = sse.on('tool_call', handleMessage);
    const unsubToolResult = sse.on('tool_result', handleMessage);
    const unsubStatus = sse.on('status', handleMessage);
    const unsubSystem = sse.on('system', handleMessage);

    sse.connect();

    addEvent('system', '事件页面已初始化，等待事件...');

    return () => {
      unsubscribeConn();
      unsubMessage();
      unsubProgress();
      unsubToolCall();
      unsubToolResult();
      unsubStatus();
      unsubSystem();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'tool_call': return 'text-blue-600 dark:text-blue-400';
      case 'tool_result': return 'text-green-600 dark:text-green-400';
      case 'progress': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'system': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'tool_call': return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900';
      case 'tool_result': return 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900';
      case 'progress': return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900';
      case 'error': return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900';
      case 'system': return 'bg-gray-50 dark:bg-gray-950/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-900';
      default: return 'bg-gray-50 dark:bg-gray-950/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-900';
    }
  };

  const clearEvents = () => {
    setEvents([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">事件日志</h2>
          <p className="text-sm text-muted-foreground mt-1">
            来自 nanobot 的实时事件 · 共 {events.length} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm btn btn-ghost cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            自动滚动
          </label>
          <button onClick={clearEvents} className="icon-btn text-red-500 hover:text-red-600" title="清空">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 border ${
        connected
          ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900'
          : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
      }`}>
        <Activity className="h-4 w-4" />
        <span className="text-sm font-medium">{connected ? '已连接到事件流' : '未连接'}</span>
      </div>

      {/* Events List */}
      <div
        ref={containerRef}
        className="card-elevated rounded-xl p-4 h-[calc(100vh-16rem)] overflow-y-auto scrollbar-thin font-mono text-sm bg-muted/30"
      >
        {events.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">暂无事件...</div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-muted-foreground text-xs flex-shrink-0">{event.timestamp.toLocaleTimeString()}</span>
                <span className={`text-xs font-medium uppercase flex-shrink-0 px-1.5 py-0.5 rounded border ${getEventBadge(event.type)}`}>
                  {event.type}
                </span>
                <span className={`flex-1 break-all ${getEventColor(event.type)}`}>{event.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
