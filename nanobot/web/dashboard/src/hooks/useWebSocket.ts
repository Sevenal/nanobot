/**
 * Custom hook for WebSocket connection management
 */

import { useEffect, useState, useCallback } from 'react';
import { ws } from '@/api/client';
import type { WebSocketSendMessage } from '@/api/types';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = ws.onConnectionChange((isConnected) => {
      setConnected(isConnected);
    });

    // Connect on mount
    ws.connect();

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, []);

  const sendMessage = useCallback((message: WebSocketSendMessage) => {
    ws.send(message);
  }, []);

  return {
    connected,
    sendMessage,
  };
}
