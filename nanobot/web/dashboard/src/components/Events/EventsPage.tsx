/**
 * Events page - Real-time event log
 */

import { useState, useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { ws } from '@/api/client';

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
    const unsubscribeConn = ws.onConnectionChange((isConnected) => {
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
      setEvents((prev) => [event, ...prev].slice(0, 1000)); // Keep last 1000 events
    };

    // Setup WebSocket message handler for all types
    const handleMessage = (msg: any) => {
      if (msg.type && msg.type !== 'ping' && msg.type !== 'pong') {
        addEvent(msg.type, msg.content || JSON.stringify(msg));
      }
    };

    // Listen to all WebSocket messages
    ws.on('message', handleMessage);
    ws.on('progress', handleMessage);
    ws.on('tool_call', handleMessage);
    ws.on('tool_result', handleMessage);
    ws.on('status', handleMessage);
    ws.on('system', handleMessage);

    addEvent('system', 'Events page initialized. Waiting for events...');

    return () => {
      unsubscribeConn();
    };
  }, []);

  // Auto-scroll to top (newest events)
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'tool_call': return 'text-blue-400';
      case 'tool_result': return 'text-green-400';
      case 'progress': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'system': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const clearEvents = () => {
    setEvents([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Event Log</h2>
          <p className="text-muted-foreground">
            Real-time events from nanobot
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearEvents}
            className="rounded-lg border px-4 py-2 hover:bg-muted transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`flex items-center gap-2 rounded-lg px-4 py-2 border ${
        connected ? 'bg-green-950 text-green-400 border-green-900' : 'bg-red-950 text-red-400 border-red-900'
      }`}>
        <Activity className="h-4 w-4" />
        <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* Events List */}
      <div
        ref={containerRef}
        className="rounded-lg border bg-card p-4 h-[calc(100vh-16rem)] overflow-y-auto scrollbar-thin font-mono text-sm"
      >
        {events.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No events yet...</div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-2 py-1">
                <span className="text-muted-foreground text-xs">{event.timestamp.toLocaleTimeString()}</span>
                <span className={`text-xs font-medium uppercase ${getEventColor(event.type)}`}>[{event.type}]</span>
                <span className="text-foreground flex-1 break-all">{event.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
