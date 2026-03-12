/**
 * Custom hook for SSE connection management
 */

import { useEffect, useState, useCallback } from 'react';
import { sse } from '@/api/client';
import type { WebSocketSendMessage } from '@/api/types';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = sse.onConnectionChange((isConnected) => {
      setConnected(isConnected);
    });

    // Connect on mount
    sse.connect();

    return () => {
      unsubscribe();
      sse.disconnect();
    };
  }, []);

  const sendMessage = useCallback((message: WebSocketSendMessage) => {
    sse.send(message);
  }, []);

  return {
    connected,
    sendMessage,
  };
}
