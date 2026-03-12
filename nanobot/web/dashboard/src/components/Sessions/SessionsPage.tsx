/**
 * Sessions page - View and manage conversation history
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, MessageSquare, Eye, Clock, Calendar, Filter } from 'lucide-react';
import { api } from '@/api/client';
import type { Session, Channel } from '@/api/types';

// Helper to extract channel from session key
const getSessionChannel = (key: string): string => {
  const parts = key.split(':');
  return parts.length >= 2 ? parts[0] : 'unknown';
};

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load channels
        const channelsData = await api.getChannels();
        setChannels(channelsData.channels);

        // Load sessions
        const sessionsData = await api.listSessions({ limit: 100, offset: 0 });
        setSessions(sessionsData.sessions);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter sessions by search term and channel
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.key.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = selectedChannel === 'all' || getSessionChannel(session.key) === selectedChannel;
    return matchesSearch && matchesChannel;
  });

  const paginatedSessions = filteredSessions.slice(page * pageSize, (page + 1) * pageSize);

  const handleDelete = async (key: string) => {
    if (!confirm(`确定删除会话 "${key}"?`)) return;

    try {
      await api.deleteSession(key);
      setSessions(sessions.filter((s) => s.key !== key));
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除会话失败');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    }
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

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

  const totalPages = Math.ceil(filteredSessions.length / pageSize);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">会话</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理对话历史 · 共 {filteredSessions.length} 个会话{selectedChannel !== 'all' && ` · 已筛选: ${channels.find(c => c.id === selectedChannel)?.name || selectedChannel}`}
          </p>
        </div>
        {/* Channel Filter */}
        {channels.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value);
                setPage(0); // Reset page when changing channel
              }}
              className="input w-32 text-sm"
            >
              <option value="all">全部渠道</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="搜索会话..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input h-10 pl-9"
        />
      </div>

      {/* Sessions List */}
      {paginatedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {search ? '未找到匹配的会话' : '暂无会话记录'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedSessions.map((session, index) => (
            <div
              key={session.key}
              className="scale-in card-elevated group flex items-center gap-4 p-4 rounded-lg"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Icon */}
              <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-medium truncate">{session.key}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                    {getSessionChannel(session.key)}
                  </span>
                  <span className="status-badge status-badge-online">
                    {session.message_count || 0} 消息
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    创建: {formatDate(session.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    更新: {formatDate(session.updated_at)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Link
                  to={`/sessions/${encodeURIComponent(session.key)}`}
                  className="icon-btn"
                  title="查看详情"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => handleDelete(session.key)}
                  className="icon-btn text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  title="删除会话"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            显示 {page * pageSize + 1} 到 {Math.min((page + 1) * pageSize, filteredSessions.length)} 条
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn btn-outline h-8 px-3 disabled:opacity-50"
            >
              上一页
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`btn h-8 w-8 ${
                    page === i
                      ? 'btn-primary'
                      : 'btn-ghost'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn btn-outline h-8 px-3 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
