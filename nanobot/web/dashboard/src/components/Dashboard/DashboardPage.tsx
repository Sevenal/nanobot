/**
 * Dashboard page with real-time metrics, charts, and system status
 */

import { useEffect, useState, useRef } from 'react';
import { Activity, Clock, MessageSquare, Calendar, CheckCircle, XCircle, TrendingUp, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '@/api/client';
import type { SystemStatus } from '@/api/types';

interface QueueHistoryData {
  timestamp: number;
  inbound: number;
  outbound: number;
}

// Animated Counter Component
function AnimatedCounter({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const startTime = Date.now();
      const startValue = prevValueRef.current;
      const endValue = value;
      const range = endValue - startValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        setDisplayValue(Math.round(startValue + range * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
      prevValueRef.current = value;
    }
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<{ uptime: string; total_connections: number; available_tools?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueHistory, setQueueHistory] = useState<QueueHistoryData[]>([]);
  const maxHistoryPoints = 30;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusData, statsData] = await Promise.all([
          api.getStatus(),
          api.getStats(),
        ]);
        setStatus(statusData);
        setStats(statsData);

        // Update queue history
        setQueueHistory(prev => {
          const newPoint = {
            timestamp: Date.now(),
            inbound: statusData.inbound_queue ?? 0,
            outbound: statusData.outbound_queue ?? 0,
          };
          const updated = [...prev, newPoint];
          return updated.slice(-maxHistoryPoints);
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      title: '连接数',
      value: status?.connections ?? 0,
      icon: Activity,
      gradient: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '会话数',
      value: status?.sessions ?? 0,
      icon: MessageSquare,
      gradient: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: '定时任务',
      value: status?.cron_jobs ?? 0,
      icon: Calendar,
      gradient: 'from-purple-500 to-violet-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: '可用工具',
      value: stats?.available_tools ?? 0,
      icon: Zap,
      gradient: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  // Chart data preparation
  const maxQueueValue = Math.max(
    ...queueHistory.map(d => Math.max(d.inbound, d.outbound)),
    10
  );
  const chartWidth = 100;
  const chartHeight = 60;

  return (
    <div className="space-y-6">
      {/* Page Header with Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight gradient-text">仪表盘</h2>
          <p className="text-muted-foreground mt-1">
            nanobot 助手实时概览
          </p>
        </div>
      </div>

      {/* Status Banner with Animation */}
      <div className={`rounded-xl border p-4 flex items-center justify-between transition-all duration-300 ${
        status?.running
          ? 'bg-gradient-to-r from-green-950/50 to-emerald-950/30 text-green-400 border-green-900/50'
          : 'bg-gradient-to-r from-red-950/50 to-rose-950/30 text-red-400 border-red-900/50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${status?.running ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {status?.running ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="font-semibold">
              {status?.running ? '系统在线' : '系统离线'}
            </div>
            <div className="text-sm opacity-75">
              {status?.host}:{status?.port}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-75">运行时间</div>
          <div className="font-semibold">{stats?.uptime || '未知'}</div>
        </div>
      </div>

      {/* Metrics Grid with Hover Effects */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.title}
              className="card-hover group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.title}</p>
                    <p className="text-3xl font-bold mt-2">
                      <AnimatedCounter value={metric.value} />
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 bg-gradient-to-br ${metric.gradient} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Queue History Chart */}
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            消息队列趋势
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
              <span className="text-muted-foreground">入队</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              <span className="text-muted-foreground">出队</span>
            </div>
          </div>
        </div>

        {queueHistory.length > 1 ? (
          <div className="relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-40" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
                <line
                  key={ratio}
                  x1="0"
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke="currentColor"
                  strokeWidth="0.2"
                  className="text-muted-foreground/10"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Gradient area for inbound */}
              <defs>
                <linearGradient id="inboundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="outboundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(34 197 94)" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity="0"/>
                </linearGradient>
              </defs>

              {/* Inbound area */}
              <polygon
                fill="url(#inboundGradient)"
                points={`0,${chartHeight} ${queueHistory.map((d, i) => {
                  const x = (i / (queueHistory.length - 1)) * chartWidth;
                  const y = chartHeight - (d.inbound / maxQueueValue) * chartHeight;
                  return `${x},${y}`;
                }).join(' ')} ${chartWidth},${chartHeight}`}
              />

              {/* Outbound area */}
              <polygon
                fill="url(#outboundGradient)"
                points={`0,${chartHeight} ${queueHistory.map((d, i) => {
                  const x = (i / (queueHistory.length - 1)) * chartWidth;
                  const y = chartHeight - (d.outbound / maxQueueValue) * chartHeight;
                  return `${x},${y}`;
                }).join(' ')} ${chartWidth},${chartHeight}`}
              />

              {/* Inbound queue line */}
              <polyline
                fill="none"
                stroke="rgb(59 130 246)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={queueHistory.map((d, i) => {
                  const x = (i / (queueHistory.length - 1)) * chartWidth;
                  const y = chartHeight - (d.inbound / maxQueueValue) * chartHeight;
                  return `${x},${y}`;
                }).join(' ')}
              />

              {/* Outbound queue line */}
              <polyline
                fill="none"
                stroke="rgb(34 197 94)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={queueHistory.map((d, i) => {
                  const x = (i / (queueHistory.length - 1)) * chartWidth;
                  const y = chartHeight - (d.outbound / maxQueueValue) * chartHeight;
                  return `${x},${y}`;
                }).join(' ')}
              />

              {/* Data points for inbound */}
              {queueHistory.map((d, i) => {
                const x = (i / (queueHistory.length - 1)) * chartWidth;
                const y = chartHeight - (d.inbound / maxQueueValue) * chartHeight;
                return (
                  <circle
                    key={`in-${i}`}
                    cx={x}
                    cy={y}
                    r="1.8"
                    fill="rgb(59 130 246)"
                    className="hover:r-2.5 transition-all"
                  />
                );
              })}

              {/* Data points for outbound */}
              {queueHistory.map((d, i) => {
                const x = (i / (queueHistory.length - 1)) * chartWidth;
                const y = chartHeight - (d.outbound / maxQueueValue) * chartHeight;
                return (
                  <circle
                    key={`out-${i}`}
                    cx={x}
                    cy={y}
                    r="1.8"
                    fill="rgb(34 197 94)"
                    className="hover:r-2.5 transition-all"
                  />
                );
              })}
            </svg>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 -mt-1 text-xs text-muted-foreground">
              {maxQueueValue}
            </div>
            <div className="absolute left-0 bottom-0 -mb-1 text-xs text-muted-foreground">
              0
            </div>

            {/* Current values */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                最近 {Math.min(queueHistory.length * 5, 60)} 秒
              </span>
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  入队: <span className="font-semibold text-blue-500"><AnimatedCounter value={queueHistory[queueHistory.length - 1]?.inbound ?? 0} /></span>
                  {queueHistory.length > 1 && (
                    queueHistory[queueHistory.length - 1]?.inbound > queueHistory[queueHistory.length - 2]?.inbound
                      ? <ArrowUpRight className="h-3 w-3 text-red-400" />
                      : <ArrowDownRight className="h-3 w-3 text-green-400" />
                  )}
                </span>
                <span className="flex items-center gap-1">
                  出队: <span className="font-semibold text-green-500"><AnimatedCounter value={queueHistory[queueHistory.length - 1]?.outbound ?? 0} /></span>
                  {queueHistory.length > 1 && (
                    queueHistory[queueHistory.length - 1]?.outbound > queueHistory[queueHistory.length - 2]?.outbound
                      ? <ArrowUpRight className="h-3 w-3 text-red-400" />
                      : <ArrowDownRight className="h-3 w-3 text-green-400" />
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            收集数据中...
          </div>
        )}
      </div>

      {/* Queue Status Cards */}
      {(status?.inbound_queue !== undefined || status?.outbound_queue !== undefined) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Inbound Queue */}
          <div className="card-hover rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-transparent p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-500/20 p-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">入队消息</div>
                  <div className="text-2xl font-bold text-blue-400">
                    <AnimatedCounter value={status?.inbound_queue ?? 0} />
                  </div>
                </div>
              </div>
              {queueHistory.length > 1 && (
                <div className="rounded-full p-2">
                  {queueHistory[queueHistory.length - 1]?.inbound > queueHistory[queueHistory.length - 2]?.inbound ? (
                    <ArrowUpRight className="h-5 w-5 text-red-400" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-green-400" />
                  )}
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-blue-950/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${Math.min(((status?.inbound_queue ?? 0) / maxQueueValue) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Outbound Queue */}
          <div className="card-hover rounded-xl border border-green-500/20 bg-gradient-to-br from-green-950/30 to-transparent p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-500/20 p-3">
                  <Clock className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">出队消息</div>
                  <div className="text-2xl font-bold text-green-400">
                    <AnimatedCounter value={status?.outbound_queue ?? 0} />
                  </div>
                </div>
              </div>
              {queueHistory.length > 1 && (
                <div className="rounded-full p-2">
                  {queueHistory[queueHistory.length - 1]?.outbound > queueHistory[queueHistory.length - 2]?.outbound ? (
                    <ArrowUpRight className="h-5 w-5 text-red-400" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-green-400" />
                  )}
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-green-950/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(((status?.outbound_queue ?? 0) / maxQueueValue) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <h3 className="text-lg font-semibold mb-4">快捷操作</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <a
            href="/chat"
            className="card-hover flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-purple-500/10 to-transparent hover:from-purple-500/20 group"
          >
            <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-medium">开始聊天</div>
              <div className="text-sm text-muted-foreground">与助手对话</div>
            </div>
            <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <a
            href="/sessions"
            className="card-hover flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20 group"
          >
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 p-2 group-hover:scale-110 transition-transform">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-medium">查看会话</div>
              <div className="text-sm text-muted-foreground">浏览对话历史</div>
            </div>
            <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <a
            href="/cron"
            className="card-hover flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20 group"
          >
            <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 p-2 group-hover:scale-110 transition-transform">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-medium">管理定时任务</div>
              <div className="text-sm text-muted-foreground">计划任务</div>
            </div>
            <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>
    </div>
  );
}
