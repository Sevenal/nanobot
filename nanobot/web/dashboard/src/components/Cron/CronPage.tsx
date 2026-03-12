/**
 * Cron Jobs page - Manage scheduled tasks
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, Pause, Clock, X, Calendar } from 'lucide-react';
import { api } from '@/api/client';
import type { CronJob, CronPayload } from '@/api/types';

interface NewCronJob {
  name: string;
  schedule_type: 'at' | 'every' | 'cron';
  schedule: string;
  message: string;
  channel: string;
  to: string;
  deliver: boolean;
}

export default function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<NewCronJob>({
    name: '',
    schedule_type: 'every',
    schedule: '',
    message: '',
    channel: 'web',
    to: 'default',
    deliver: true,
  });

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await api.listCronJobs(true);
        setJobs(data.jobs);
      } catch (error) {
        console.error('Failed to fetch cron jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const handleToggle = async (job: CronJob) => {
    try {
      await api.updateCronJob(job.id, { enabled: !job.enabled });
      setJobs(jobs.map((j) => (j.id === job.id ? { ...j, enabled: !j.enabled } : j)));
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
        channel: formData.channel,
        to: formData.to,
      };

      await api.createCronJob({
        name: formData.name,
        schedule_type: formData.schedule_type,
        schedule: formData.schedule,
        payload,
        enabled: true,
      });

      const data = await api.listCronJobs(true);
      setJobs(data.jobs);

      setFormData({
        name: '',
        schedule_type: 'every',
        schedule: '',
        message: '',
        channel: 'web',
        to: 'default',
        deliver: true,
      });
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('创建任务失败');
    } finally {
      setCreating(false);
    }
  };

  const getScheduleDisplay = (job: CronJob) => {
    if (job.schedule_type === 'every') {
      return `每 ${job.schedule}`;
    } else if (job.schedule_type === 'at') {
      return `于 ${new Date(parseInt(job.schedule)).toLocaleString()}`;
    }
    return job.schedule;
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
        <button
          onClick={() => setShowCreateDialog(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          添加任务
        </button>
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
              className="scale-in card-elevated group p-4 rounded-lg"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium truncate">{job.name}</h3>
                    <span className={`status-badge ${job.enabled ? 'status-badge-online' : 'status-badge-offline'}`}>
                      <div className={`h-1 w-1 rounded-full ${job.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {job.enabled ? '活跃' : '已暂停'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="h-3.5 w-3.5" />
                    {getScheduleDisplay(job)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{job.payload.message}</p>
                </div>
                <div className="flex items-center gap-1">
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
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="font-semibold">创建定时任务</h3>
              <button onClick={() => setShowCreateDialog(false)} className="icon-btn">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
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
                  <option value="every">间隔</option>
                  <option value="at">指定时间</option>
                  <option value="cron">Cron 表达式</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  调度设置
                  <span className="text-muted-foreground font-normal ml-1">
                    {formData.schedule_type === 'every' && '（例如：1h, 30m, 1d）'}
                    {formData.schedule_type === 'at' && `（时间戳）`}
                    {formData.schedule_type === 'cron' && '（例如：0 9 * * *）'}
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder={formData.schedule_type === 'every' ? '1h' : formData.schedule_type === 'at' ? Date.now().toString() : '0 9 * * *'}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">消息内容</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="要发送的消息"
                  rows={3}
                  className="input resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">频道</label>
                <input
                  type="text"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">接收者</label>
                <input
                  type="text"
                  value={formData.to}
                  onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deliver"
                  checked={formData.deliver}
                  onChange={(e) => setFormData({ ...formData, deliver: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="deliver" className="text-sm">投递消息</label>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border/50">
              <button onClick={() => setShowCreateDialog(false)} disabled={creating} className="btn btn-secondary">
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
