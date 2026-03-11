/**
 * Sessions page - View and manage conversation history
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, MessageSquare, Eye } from 'lucide-react';
import { api } from '@/api/client';
import type { Session } from '@/api/types';

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.listSessions({ limit: 100, offset: 0 });
        setSessions(data.sessions);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const filteredSessions = sessions.filter((session) =>
    session.key.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedSessions = filteredSessions.slice(page * pageSize, (page + 1) * pageSize);

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete session "${key}"?`)) return;

    try {
      await api.deleteSession(key);
      setSessions(sessions.filter((s) => s.key !== key));
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sessions</h2>
          <p className="text-muted-foreground">
            Manage your conversation history
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Sessions List */}
      <div className="rounded-lg border bg-card">
        <div className="grid grid-cols-12 gap-4 p-4 border-b font-medium text-sm text-muted-foreground">
          <div className="col-span-4">Session Key</div>
          <div className="col-span-3">Created</div>
          <div className="col-span-3">Updated</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {paginatedSessions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No sessions found</div>
        ) : (
          <div className="divide-y">
            {paginatedSessions.map((session) => (
              <div key={session.key} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors">
                <div className="col-span-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{session.key}</span>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {new Date(session.created_at).toLocaleString()}
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {new Date(session.updated_at).toLocaleString()}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Link
                    to={`/sessions/${encodeURIComponent(session.key)}`}
                    className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(session.key)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredSessions.length > pageSize && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filteredSessions.length)} of {filteredSessions.length} sessions
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-lg border px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(Math.ceil(filteredSessions.length / pageSize) - 1, page + 1))}
              disabled={(page + 1) * pageSize >= filteredSessions.length}
              className="rounded-lg border px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
