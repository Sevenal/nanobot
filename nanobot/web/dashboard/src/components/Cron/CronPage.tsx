/**
 * Cron Jobs page - Manage scheduled tasks
 * Linear/Vercel Style - Enhanced with channel selection
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Play, Pause, Clock, X, Calendar, AlertCircle,
  CheckCircle2, RefreshCw, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '@/api/client';
import type { CronJob, CronPayload, Session, Channel } from '@/api/types';

interface NewCronJob {
  name: string;
  schedule_type: 'at' | 'every' | 'cron';
  schedule: string;
  message: string;
  channel: string;
  to: string;
  deliver: boolean;
}

// Interval presets for quick selection
const INTERVAL_PRESETS = [
  { label: '每分钟', value: '1m' },
  { label: '每5分钟', value: '5m' },
  { label: '每15分钟', value: '15m' },
  { label: '每30分钟', value: '30m' },
  { label: '每小时', value: '1h' },
  { label: '每6小时', value: '6h' },
  { label: '每天', value: '1d' },
  { label: '每周', value: '7d' },
];

// Cron presets
const CRON_PRESETS = [
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每月1号 9:00', value: '0 9 1 * *' },
  { label: '工作日 9:00', value: '0 9 * * 1-5' },
];

function formatTimestamp(ms: string | number | undefined): string {
  if (!ms) return '-';
  const timestamp = typeof ms === 'string' ? parseInt(ms) : ms;
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = timestamp - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (diffMins < 1) return '即将执行';
  if (diffMins < 60) return `${diffMins}分钟后`;
  if (diffHours < 24) return `${diffHours}小时后`;
  if (diffDays < 7) return `${diffDays}天后`;
  return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLastRun(ms: string | number | undefined): string {
  if (!ms) return '从未运行';
  const timestamp = typeof ms === 'string' ? parseInt(ms) : ms;
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric' });
}

function parseInterval(schedule: string): string {
  // Parse human-readable interval like "1h", "30m", "1d"
  const match = schedule.match(/^(\d+)([mhd])$/);
  if (!match) return schedule;

  const [, num, unit] = match;
  const n = parseInt(num);
  switch (unit) {
    case 'm': return n === 1 ? '每分钟' : `每${n}分钟`;
    case 'h': return n === 1 ? '每小时' : `每${n}小时`;
    case 'd': return n === 1 ? '每天' : `每${n}天`;
    default: return schedule;
  }
}

export default function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewCronJob>({
    name: '',
    schedule_type: 'every',
    schedule: '1h',
    message: '',
    channel: '',
    to: '',
    deliver: true,
  });

  const refreshJobs = useCallback(async () => {
    try {
      const data = await api.listCronJobs(true);
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error);
    }
  }, []);

  const loadChannelsAndSessions = useCallback(async () => {
    try {
      const [channelsData, sessionsData] = await Promise.all([
        api.getChannels(),
        api.listSessions({ limit: 1000 }),
      ]);
      setChannels(channelsData.channels);
      setSessions(sessionsData.sessions);

      // Set default channel if available
      if (channelsData.channels.length > 0 && !formData.channel) {
        setFormData(prev => ({ ...prev, channel: channelsData.channels[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch channels/sessions:', error);
    }
  }, [formData.channel]);

  useEffect(() => {
    Promise.all([refreshJobs(), loadChannelsAndSessions()])
      .finally(() => setLoading(false));

    // Refresh every 30 seconds to update next run times
    const interval = setInterval(refreshJobs, 30000);
    return () => clearInterval(interval);
  }, [refreshJobs, loadChannelsAndSessions]);

  const handleToggle = async (job: CronJob) => {
    try {
      await api.updateCronJob(job.id, { enabled: !job.enabled });
      setJobs(jobs.map((j) => (j.id === job.id ? { ...j, enabled: !job.enabled } : j)));
    } catch (error) {
      console.error('Failed to toggle job:', error);
      alert('更新任务失败');
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('确定删除此定时任务？')) return;

    try {
      await api.deleteCronJob(jobId);
      setJobs(jobs.filter((j) => j.id !== jobId));
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('删除任务失败');
    }
  };

  const handleRun = async (jobId: string) => {
    setRunningJobId(jobId);
    try {
      await api.runCronJob(jobId);
      await refreshJobs();
    } catch (error) {
      console.error('Failed to run job:', error);
      alert('运行任务失败');
    } finally {
      setRunningJobId(null);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.schedule || !formData.message) {
      alert('请填写必填字段（名称、调度、消息）');
      return;
    }

    setCreating(true);
    try {
      const payload: CronPayload = {
        message: formData.message,
        deliver: formData.deliver,
        channel: formData.channel || undefined,
        to: formData.to || undefined,
      };

      await api.createCronJob({
        name: formData.name,
        schedule_type: formData.schedule_type,
        schedule: formData.schedule,
        payload,
        enabled: true,
      });

      await refreshJobs();

      setFormData({
        name: '',
        schedule_type: 'every',
        schedule: '1h',
        message: '',
        channel: channels.length > 0 ? channels[0].id : '',
        to: '',
        deliver: true,
      });
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('创建任务失败: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const getScheduleDisplay = (job: CronJob) => {
    if (job.schedule_type === 'every') {
      return parseInterval(job.schedule);
    } else if (job.schedule_type === 'at') {
      const timestamp = parseInt(job.schedule);
      return `于 ${new Date(timestamp).toLocaleString('zh-CN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })}`;
    }
    return job.schedule;
  };

  const getStatusBadge = (job: CronJob) => {
    if (!job.enabled) {
      return (
        <span className="status-badge status-badge-offline">
          <div className="h-1 w-1 rounded-full bg-gray-400" />
          已暂停
        </span>
      );
    }

    if (job.last_status === 'error') {
      return (
        <span className="status-badge status-badge-error">
          <AlertCircle className="h-3 w-3" />
          错误
        </span>
      );
    }

    if (job.last_status === 'ok') {
      return (
        <span className="status-badge status-badge-online">
          <CheckCircle2 className="h-3 w-3" />
          正常
        </span>
      );
    }

    return (
      <span className="status-badge status-badge-online">
        <div className="h-1 w-1 rounded-full bg-green-500" />
        活跃
      </span>
    );
  };

  // Filter sessions by selected channel
  const filteredSessions = sessions.filter(session => {
    if (!formData.channel) return false;
    return session.key.startsWith(`${formData.channel}:`);
  });

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
          <h2 className="text-2xl font-semibold tracking-tight">定时任务</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理和调度周期性任务 · 共 {jobs.length} 个任务
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshJobs}
            className="btn btn-outline"
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            添加任务
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">未配置定时任务</p>
          <p className="text-sm text-muted-foreground mt-1">添加一个任务来开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, index) => (
            <div
              key={job.id}
              className="scale-in card-elevated group rounded-lg overflow-hidden"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              {/* Main Card */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-medium truncate">{job.name}</h3>
                      {getStatusBadge(job)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {getScheduleDisplay(job)}
                      </span>
                      {job.next_run && (
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          下次: {formatTimestamp(job.next_run)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{job.payload.message}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                      className="icon-btn"
                      title="详情"
                    >
                      {expandedJobId === job.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRun(job.id)}
                      disabled={runningJobId === job.id}
                      className="icon-btn"
                      title="立即运行"
                    >
                      <Play className={`h-4 w-4 ${runningJobId === job.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleToggle(job)}
                      className="icon-btn"
                      title={job.enabled ? '暂停' : '恢复'}
                    >
                      {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="icon-btn text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedJobId === job.id && (
                <div className="border-t border-border/50 bg-muted/30 p-4 fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">任务 ID:</span>
                      <span className="ml-2 font-mono text-xs">{job.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">创建时间:</span>
                      <span className="ml-2">{new Date(job.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">最后运行:</span>
                      <span className="ml-2">{formatLastRun(job.last_run)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">运行状态:</span>
                      <span className="ml-2">
                        {job.last_status === 'ok' && (
                          <span className="text-green-600 dark:text-green-400">成功</span>
                        )}
                        {job.last_status === 'error' && (
                          <span className="text-red-600 dark:text-red-400">失败</span>
                        )}
                        {!job.last_status && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">频道:</span>
                      <span className="ml-2">{job.payload.channel || 'default'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">接收者:</span>
                      <span className="ml-2">{job.payload.to || 'default'}</span>
                    </div>
                  </div>
                  {job.last_error && (
                    <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-red-700 dark:text-red-400">{job.last_error}</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-3">
                    <span className="text-muted-foreground text-sm">消息内容:</span>
                    <p className="mt-1 text-sm bg-background rounded border border-border/50 p-2">
                      {job.payload.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Job Dialog */}
      {showCreateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md scale-in max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0">
              <h3 className="font-semibold">创建定时任务</h3>
              <button onClick={() => setShowCreateDialog(false)} className="icon-btn">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium mb-1.5">任务名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：每日提醒"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">调度类型</label>
                <select
                  value={formData.schedule_type}
                  onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as 'at' | 'every' | 'cron' })}
                  className="input"
                >
                  <option value="every">间隔执行</option>
                  <option value="at">指定时间</option>
                  <option value="cron">Cron 表达式</option>
                </select>
              </div>

              {formData.schedule_type === 'every' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">快速选择</label>
                    <div className="flex flex-wrap gap-2">
                      {INTERVAL_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, schedule: preset.value })}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            formData.schedule === preset.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">自定义间隔</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={formData.schedule.replace(/[mhd]/, '')}
                        onChange={(e) => {
                          const unit = formData.schedule.slice(-1) || 'h';
                          const value = e.target.value || '1';
                          setFormData({ ...formData, schedule: value + unit });
                        }}
                        className="input flex-1"
                        placeholder="1"
                      />
                      <select
                        value={formData.schedule.slice(-1)}
                        onChange={(e) => {
                          const num = formData.schedule.replace(/[mhd]/, '') || '1';
                          setFormData({ ...formData, schedule: num + e.target.value });
                        }}
                        className="input w-20"
                      >
                        <option value="m">分钟</option>
                        <option value="h">小时</option>
                        <option value="d">天</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {formData.schedule_type === 'at' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">执行时间</label>
                  <input
                    type="datetime-local"
                    value={(() => {
                      if (!formData.schedule || isNaN(parseInt(formData.schedule))) {
                        return '';
                      }
                      const date = new Date(parseInt(formData.schedule));
                      // Format for datetime-local input: YYYY-MM-DDTHH:mm
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const hours = String(date.getHours()).padStart(2, '0');
                      const minutes = String(date.getMinutes()).padStart(2, '0');
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    })()}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      const timestamp = date.getTime();
                      setFormData({ ...formData, schedule: timestamp.toString() });
                    }}
                    className="input"
                  />
                </div>
              )}

              {formData.schedule_type === 'cron' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">快速选择</label>
                    <div className="flex flex-wrap gap-2">
                      {CRON_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, schedule: preset.value })}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            formData.schedule === preset.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Cron 表达式</label>
                    <input
                      type="text"
                      value={formData.schedule}
                      onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                      placeholder="0 9 * * *"
                      className="input font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      格式: 分 时 日 月 周 (例如: 0 9 * * * = 每天9点)
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">消息内容</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="要发送的消息或指令"
                  rows={3}
                  className="input resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Agent 会根据此消息执行相应操作
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">频道</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value, to: '' })}
                    className="input"
                    disabled={channels.length === 0}
                  >
                    {channels.length === 0 ? (
                      <option value="">无可用频道</option>
                    ) : (
                      channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">接收者</label>
                  <select
                    value={formData.to}
                    onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                    className="input"
                    disabled={!formData.channel || filteredSessions.length === 0}
                  >
                    <option value="">默认</option>
                    {filteredSessions.map((session) => (
                      <option key={session.key} value={session.key}>
                        {session.key}
                      </option>
                    ))}
                  </select>
                  {!formData.channel && (
                    <p className="text-xs text-muted-foreground mt-1">请先选择频道</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deliver"
                  checked={formData.deliver}
                  onChange={(e) => setFormData({ ...formData, deliver: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="deliver" className="text-sm">将响应投递到指定频道/接收者</label>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border/50 flex-shrink-0">
              <button
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
