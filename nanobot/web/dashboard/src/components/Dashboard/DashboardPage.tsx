/**
 * Dashboard page with real-time metrics and system status
 */

import { useEffect, useState } from 'react';
import { Activity, Clock, MessageSquare, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/api/client';
import type { SystemStatus } from '@/api/types';

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<{ uptime: string; total_connections: number; available_tools?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusData, statsData] = await Promise.all([
          api.getStatus(),
          api.getStats(),
        ]);
        setStatus(statusData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const metrics = [
    {
      title: 'Connections',
      value: status?.connections ?? 0,
      icon: Activity,
      color: 'text-blue-500',
    },
    {
      title: 'Sessions',
      value: status?.sessions ?? 0,
      icon: MessageSquare,
      color: 'text-green-500',
    },
    {
      title: 'Cron Jobs',
      value: status?.cron_jobs ?? 0,
      icon: Calendar,
      color: 'text-purple-500',
    },
    {
      title: 'Available Tools',
      value: stats?.available_tools ?? 0,
      icon: CheckCircle,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Real-time overview of your nanobot assistant
        </p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-lg border p-4 flex items-center gap-3 ${
        status?.running ? 'bg-green-950 text-green-400 border-green-900' : 'bg-red-950 text-red-400 border-red-900'
      }`}>
        {status?.running ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <XCircle className="h-5 w-5" />
        )}
        <div>
          <div className="font-semibold">
            {status?.running ? 'System Online' : 'System Offline'}
          </div>
          <div className="text-sm opacity-75">
            {status?.host}:{status?.port}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-3xl font-bold mt-2">{metric.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${metric.color} opacity-80`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Queue Status */}
      {(status?.inbound_queue !== undefined || status?.outbound_queue !== undefined) && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Message Queue Status</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>Inbound Queue</span>
              </div>
              <span className="text-2xl font-bold">{status?.inbound_queue ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>Outbound Queue</span>
              </div>
              <span className="text-2xl font-bold">{status?.outbound_queue ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <a
            href="/chat"
            className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Start Chat</div>
              <div className="text-sm text-muted-foreground">Talk to your assistant</div>
            </div>
          </a>
          <a
            href="/sessions"
            className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">View Sessions</div>
              <div className="text-sm text-muted-foreground">Browse conversation history</div>
            </div>
          </a>
          <a
            href="/cron"
            className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Manage Cron</div>
              <div className="text-sm text-muted-foreground">Schedule tasks</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
