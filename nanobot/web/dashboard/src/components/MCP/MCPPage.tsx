/**
 * MCP (Model Context Protocol) Management page
 * Manage MCP server connections and their tools
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Server, Wrench, RefreshCw, Info } from 'lucide-react';

interface MCPServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  tools: string[];
  error?: string;
}

export default function MCP() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = async () => {
    try {
      const data = await fetch('/api/mcp/servers').then(r => r.json());
      setServers(data.servers || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err);
      setError('获取 MCP 服务器列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">MCP 管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Model Context Protocol 服务器管理 · 共 {servers.length} 个服务器
          </p>
        </div>
        <button onClick={fetchServers} className="icon-btn" title="刷新">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">MCP 服务器</p>
              <p className="text-2xl font-semibold mt-1">{servers.length}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <Server className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">已连接</p>
              <p className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">
                {servers.filter(s => s.status === 'connected').length}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">可用工具</p>
              <p className="text-2xl font-semibold mt-1">{totalTools}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
              <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="alert alert-info">
        <Info className="h-4 w-4" />
        <div>
          <p>MCP 服务器通过配置文件或环境变量进行配置。</p>
          <p className="mt-1">当前显示的是已连接的 MCP 服务器及其提供的工具。</p>
        </div>
      </div>

      {/* Servers List */}
      {error ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-lg">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">暂无 MCP 服务器连接</p>
          <p className="text-sm text-muted-foreground mt-1">请在配置文件中配置 MCP 服务器</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {servers.map((server, index) => (
            <div
              key={server.id}
              className="scale-in card-elevated p-5 rounded-xl"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${
                    server.status === 'connected'
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : 'bg-muted/50'
                  }`}>
                    <Server className={`h-5 w-5 ${
                      server.status === 'connected'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-medium">{server.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{server.id}</p>
                  </div>
                </div>
                <span className={`status-badge ${
                  server.status === 'connected'
                    ? 'status-badge-online'
                    : server.status === 'error'
                    ? 'status-badge-error'
                    : 'status-badge-offline'
                }`}>
                  {server.status === 'connected' ? '已连接' : server.status === 'error' ? '错误' : '未连接'}
                </span>
              </div>

              <div className="text-sm text-muted-foreground mb-3">
                传输方式: stdio / SSE / HTTP
              </div>

              {server.tools.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    查看工具 ({server.toolCount})
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {server.tools.map((tool) => (
                      <span
                        key={tool}
                        className="text-xs px-2 py-1 rounded bg-muted/50 font-mono"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </details>
              )}

              {server.error && (
                <div className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-1.5 rounded">
                  {server.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
