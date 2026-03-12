/**
 * Session Detail page - View full conversation history
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, Download, User, Bot, Wrench, FileText } from 'lucide-react';
import { api } from '@/api/client';
import type { SessionDetail, Message } from '@/api/types';

export default function SessionDetail() {
  const { key } = useParams<{ key: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'assistant' | 'tool' | 'system'>('all');

  useEffect(() => {
    const fetchSession = async () => {
      if (!key) return;
      try {
        const data = await api.getSession(key);
        setSession(data);
      } catch (error) {
        console.error('Failed to fetch session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [key]);

  const filteredMessages = session?.messages.filter((msg) => {
    const matchesSearch = !search || msg.content.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || msg.role === filterRole;
    return matchesSearch && matchesRole;
  }) || [];

  const exportAsMarkdown = () => {
    if (!session) return;

    let markdown = `# 会话: ${session.key}\n\n`;
    markdown += `创建时间: ${new Date(session.created_at).toLocaleString()}\n`;
    markdown += `更新时间: ${new Date(session.updated_at).toLocaleString()}\n`;
    markdown += `消息数量: ${session.messages.length}\n\n---\n\n`;

    filteredMessages.forEach((msg) => {
      const roleLabel = {
        user: '用户',
        assistant: '助手',
        system: '系统',
        tool: '工具',
      }[msg.role] || msg.role;

      markdown += `## ${roleLabel}\n\n${msg.content}\n\n`;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        markdown += `### 工具调用\n\n`;
        msg.tool_calls.forEach((call) => {
          markdown += `- **${call.name}** (${call.type})\n`;
          markdown += `  \`\`\`json\n${JSON.stringify(call.arguments, null, 2)}\n  \`\`\`\n\n`;
        });
      }

      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.key.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = () => {
    if (!session) return;

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.key.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMessage = (msg: Message) => {
    let content = msg.content;

    // Handle code blocks for all message types
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', content: match[2], language: match[1] || 'text' });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return (
      <div className="space-y-2">
        {parts.map((part) =>
          part.type === 'code' ? (
            <div key={Math.random()} className="relative group">
              <div className="flex items-center justify-between bg-muted px-3 py-1 rounded-t text-xs text-muted-foreground">
                <span>{part.language}</span>
              </div>
              <pre className="bg-muted p-3 rounded-b overflow-x-auto text-sm">
                <code>{part.content}</code>
              </pre>
            </div>
          ) : (
            <p key={Math.random()} className="whitespace-pre-wrap">{part.content}</p>
          )
        )}
      </div>
    );
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user': return <User className="h-4 w-4" />;
      case 'assistant': return <Bot className="h-4 w-4" />;
      case 'tool': return <Wrench className="h-4 w-4" />;
      case 'system': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user': return 'bg-blue-950 text-blue-400 border-blue-900';
      case 'assistant': return 'bg-green-950 text-green-400 border-green-900';
      case 'tool': return 'bg-purple-950 text-purple-400 border-purple-900';
      case 'system': return 'bg-gray-950 text-gray-400 border-gray-900';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载会话详情中...</div>;
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">会话不存在</p>
        <Link to="/sessions" className="text-primary hover:underline">返回会话列表</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/sessions"
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">会话详情</h2>
            <p className="text-muted-foreground text-sm mt-1">{session.key}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAsMarkdown}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-muted transition-colors"
            title="导出为 Markdown"
          >
            <Download className="h-4 w-4" />
            导出 MD
          </button>
          <button
            onClick={exportAsJSON}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-muted transition-colors"
            title="导出为 JSON"
          >
            <Download className="h-4 w-4" />
            导出 JSON
          </button>
        </div>
      </div>

      {/* Session Info */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">创建时间:</span>
            <span className="ml-2">{new Date(session.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">更新时间:</span>
            <span className="ml-2">{new Date(session.updated_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">消息数量:</span>
            <span className="ml-2">{session.messages.length}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索消息内容..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'user', 'assistant', 'tool', 'system'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                filterRole === role
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-muted'
              }`}
            >
              {role === 'all' ? '全部' :
               role === 'user' ? '用户' :
               role === 'assistant' ? '助手' :
               role === 'tool' ? '工具' : '系统'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search || filterRole !== 'all' ? '未找到匹配的消息' : '此会话暂无消息'}
          </div>
        ) : (
          filteredMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className={`flex-shrink-0 rounded-full p-2 border ${getRoleColor(msg.role)}`}>
                  {getRoleIcon(msg.role)}
                </div>
              )}
              <div className={`max-w-2xl rounded-lg border p-4 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card'
              }`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="font-medium capitalize">
                    {msg.role === 'user' ? '用户' :
                     msg.role === 'assistant' ? '助手' :
                     msg.role === 'tool' ? '工具' : '系统'}
                  </span>
                  {msg.timestamp && (
                    <>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
                <div className={msg.role === 'user' ? 'text-foreground' : 'text-foreground'}>
                  {renderMessage(msg)}
                </div>
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                      工具调用 ({msg.tool_calls.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {msg.tool_calls.map((call, callIdx) => (
                        <div key={callIdx} className="bg-muted p-3 rounded text-sm">
                          <div className="font-medium">{call.name}</div>
                          <div className="text-xs text-muted-foreground">{call.type}</div>
                          <pre className="mt-2 text-xs overflow-x-auto">
                            {JSON.stringify(call.arguments, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              {msg.role === 'user' && (
                <div className={`flex-shrink-0 rounded-full p-2 border ${getRoleColor(msg.role)}`}>
                  {getRoleIcon(msg.role)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
