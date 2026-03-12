/**
 * Subagent Tasks page - Monitor and manage background subagent tasks
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { XCircle, Loader2, CheckCircle, Clock, Play, RefreshCw, Users, Eye, Info } from 'lucide-react';

interface SubagentTask {
  id: string;
  parentMessageId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  progress: string;
  startedAt: string;
  completedAt?: string;
  result?: string;
  error?: string;
}

export default function Subagents() {
  const [tasks, setTasks] = useState<SubagentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTask, setSelectedTask] = useState<SubagentTask | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const data = await fetch('/api/subagents/tasks').then(r => r.json());
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch subagent tasks:', err);
      setError('获取子代理任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (autoRefresh) {
      const interval = setInterval(fetchTasks, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('确定要取消此任务吗？')) return;
    try {
      await fetch(`/api/subagents/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to cancel task:', err);
      alert('取消任务失败');
    }
  };

  const getStatusBadge = (status: SubagentTask['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="status-badge status-badge-online">
            <Loader2 className="h-3 w-3 animate-spin" />
            运行中
          </span>
        );
      case 'completed':
        return <span className="status-badge status-badge-online">已完成</span>;
      case 'failed':
        return <span className="status-badge status-badge-error">失败</span>;
      case 'cancelled':
        return <span className="status-badge status-badge-offline">已取消</span>;
    }
  };

  const runningCount = tasks.filter(t => t.status === 'running').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;

  const getDuration = (task: SubagentTask) => {
    const start = new Date(task.startedAt).getTime();
    const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);
    if (duration < 60) return `${duration}秒`;
    return `${Math.floor(duration / 60)}分${duration % 60}秒`;
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
          <h2 className="text-2xl font-semibold tracking-tight">子代理任务</h2>
          <p className="text-sm text-muted-foreground mt-1">
            监控后台运行的子代理任务 · 共 {tasks.length} 个任务
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
          <button onClick={fetchTasks} className="icon-btn" title="刷新">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总任务数</p>
              <p className="text-2xl font-semibold mt-1">{tasks.length}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">运行中</p>
              <p className="text-2xl font-semibold mt-1 text-blue-600 dark:text-blue-400">{runningCount}</p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3">
              <Play className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">已完成</p>
              <p className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">{completedCount}</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">失败</p>
              <p className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{failedCount}</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="alert alert-info">
        <Info className="h-4 w-4" />
        <div>
          <p>子代理允许 nanobot 在后台执行长时间运行的任务，不会阻塞主对话。</p>
          <p className="mt-1">使用 <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">spawn</code> 命令或在对话中请求后台任务来创建子代理。</p>
        </div>
      </div>

      {/* Tasks List */}
      {error ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-lg">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">暂无子代理任务</p>
          <p className="text-sm text-muted-foreground mt-1">后台任务会自动显示在此处</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="scale-in card-elevated p-4 rounded-xl"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium truncate">{task.prompt}</h3>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {getDuration(task)}
                    </span>
                    <span className="font-mono text-xs">{task.id.slice(0, 8)}</span>
                  </div>
                  <div className="inline-flex items-center text-xs bg-muted/50 px-2 py-1 rounded">
                    {task.progress}
                  </div>
                  {task.error && (
                    <div className="mt-2 text-sm text-red-500">错误: {task.error}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="icon-btn"
                    title="查看详情"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {task.status === 'running' && (
                    <button
                      onClick={() => handleCancelTask(task.id)}
                      className="icon-btn text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      title="取消任务"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail Dialog */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="font-semibold">任务详情</h3>
              <button onClick={() => setSelectedTask(null)} className="icon-btn">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex">
                <span className="text-muted-foreground w-24 flex-shrink-0">任务 ID:</span>
                <span className="font-mono">{selectedTask.id}</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-24 flex-shrink-0">提示词:</span>
                <span className="flex-1">{selectedTask.prompt}</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-24 flex-shrink-0">状态:</span>
                <div>{getStatusBadge(selectedTask.status)}</div>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-24 flex-shrink-0">进度:</span>
                <span>{selectedTask.progress}</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-24 flex-shrink-0">开始时间:</span>
                <span>{new Date(selectedTask.startedAt).toLocaleString()}</span>
              </div>
              {selectedTask.completedAt && (
                <div className="flex">
                  <span className="text-muted-foreground w-24 flex-shrink-0">完成时间:</span>
                  <span>{new Date(selectedTask.completedAt).toLocaleString()}</span>
                </div>
              )}
              {selectedTask.result && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground w-24 flex-shrink-0">结果:</span>
                  <div className="ml-24 mt-1 p-2 bg-muted/50 rounded text-xs">{selectedTask.result}</div>
                </div>
              )}
              {selectedTask.error && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground w-24 flex-shrink-0">错误:</span>
                  <div className="ml-24 mt-1 p-2 bg-red-950/30 border border-red-900/50 text-red-400 rounded text-xs">
                    {selectedTask.error}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border/50">
              <button onClick={() => setSelectedTask(null)} className="btn btn-secondary w-full">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
