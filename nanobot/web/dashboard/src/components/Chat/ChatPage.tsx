/**
 * Chat page - Interactive chat interface with nanobot
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';

// Register languages for syntax highlighting
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'Connected to nanobot. Send a message to start chatting!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { connected, sendMessage } = useWebSocket();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setProgress('');

    sendMessage({
      type: 'message',
      content: userMessage,
      sender_id: 'web_user',
    });
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    let formatted = content;

    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      const language = lang || 'text';
      try {
        const highlighted = hljs.highlight(code, { language }).value;
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
      } catch {
        return `<pre><code>${code}</code></pre>`;
      }
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded">$1</code>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'system' ? (
                <div className="mx-auto rounded-lg bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
                  {msg.content}
                </div>
              ) : (
                <>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {msg.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                  </div>
                  <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    <div
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                      className="prose prose-sm max-w-none"
                    />
                  </div>
                </>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-5 w-5" />
              </div>
              <div className="rounded-lg bg-muted px-4 py-2">
                {progress ? (
                  <div className="text-sm text-muted-foreground">{progress}</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connected ? "Type your message..." : "Connecting..."}
          disabled={loading}
          className="flex-1 rounded-lg border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>

      {/* Status */}
      <div className="mt-2 text-center text-sm text-muted-foreground">
        {connected ? 'Connected to nanobot' : 'Connecting...'}
      </div>
    </div>
  );
}
