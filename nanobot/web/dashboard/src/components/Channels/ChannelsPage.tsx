/**
 * Channels Monitor page - View and manage communication channels
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface ChannelInfo {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  messagesSent: number;
  messagesReceived: number;
  lastActivity?: string;
  error?: string;
}

const CHANNEL_NAMES: Record<string, { name: string; icon: string }> = {
  telegram: { name: 'Telegram', icon: '📱' },
  whatsapp: { name: 'WhatsApp', icon: '💬' },
  discord: { name: 'Discord', icon: '🎮' },
  slack: { name: 'Slack', icon: '💼' },
  feishu: { name: '飞书', icon: '🚀' },
  wecom: { name: '企业微信', icon: '🏢' },
  dingtalk: { name: '钉钉', icon: '📎' },
  qq: { name: 'QQ', icon: '🐧' },
  matrix: { name: 'Matrix', icon: '🔗' },
  email: { name: 'Email', icon: '📧' },
  web: { name: 'Web Dashboard', icon: '🌐' },
};

export default function Channels() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async () => {
    try {
      const data = await fetch('/api/channels/status').then(r => r.json());
      setChannels(data.channels || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      setError('获取渠道状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
    if (autoRefresh) {
      const interval = setInterval(fetchChannels, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusBadge = (status: ChannelInfo['status']) => {
    switch (status) {
      case 'connected':
        return <span className="status-badge status-badge-online">在线</span>;
      case 'disconnected':
        return <span className="status-badge status-badge-offline">离线</span>;
      case 'error':
        return <span className="status-badge status-badge-error">错误</span>;
    }
  };

  const connectedCount = channels.filter(c => c.status === 'connected').length;
  const errorCount = channels.filter(c => c.status === 'error').length;

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
          <h2 className="text-2xl font-semibold tracking-tight">渠道监控</h2>
          <p className="text-sm text-muted-foreground mt-1">
            监控所有通信渠道的连接状态 · 共 {channels.length} 个渠道
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm btn btn-ghost cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            自动刷新
          </label>
          <button onClick={fetchChannels} className="icon-btn" title="刷新">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总渠道数</p>
              <p className="text-2xl font-semibold mt-1">{channels.length}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">在线渠道</p>
              <p className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">{connectedCount}</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">异常渠道</p>
              <p className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{errorCount}</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Channels List */}
      {error ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">暂无渠道状态数据</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel, index) => {
            const channelInfo = CHANNEL_NAMES[channel.id] || { name: channel.id, icon: '📡' };
            return (
              <div
                key={channel.id}
                className="scale-in card-elevated p-4 rounded-xl"
                style={{ animationDelay: `${index * 25}ms` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`rounded-lg p-2.5 ${
                    channel.status === 'connected'
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : channel.status === 'error'
                      ? 'bg-red-50 dark:bg-red-950/30'
                      : 'bg-muted/50'
                  }`}>
                    <span className="text-xl">{channelInfo.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{channelInfo.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono truncate">{channel.id}</p>
                  </div>
                </div>

                <div className="mb-3">{getStatusBadge(channel.status)}</div>

                {channel.error && (
                  <div className="text-xs text-red-500 mb-3 truncate" title={channel.error}>
                    {channel.error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-border/50">
                  <div>
                    <div className="text-muted-foreground text-xs">发送</div>
                    <div className="font-medium">{(channel.messagesSent || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">接收</div>
                    <div className="font-medium">{(channel.messagesReceived || 0).toLocaleString()}</div>
                  </div>
                </div>

                {channel.lastActivity && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                    <Clock className="h-3 w-3" />
                    {new Date(channel.lastActivity).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
