/**
 * Cron Jobs page - Manage scheduled tasks
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, Pause, Clock } from 'lucide-react';
import { api } from '@/api/client';
import type { CronJob } from '@/api/types';

export default function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

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
      alert('Failed to update job');
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this cron job?')) return;

    try {
      await api.deleteCronJob(jobId);
      setJobs(jobs.filter((j) => j.id !== jobId));
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job');
    }
  };

  const getScheduleDisplay = (job: CronJob) => {
    if (job.schedule_type === 'every') {
      return `Every ${job.schedule}`;
    } else if (job.schedule_type === 'at') {
      return `At ${new Date(parseInt(job.schedule)).toLocaleString()}`;
    }
    return job.schedule;
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading cron jobs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cron Jobs</h2>
          <p className="text-muted-foreground">
            Schedule and manage recurring tasks
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Add Job
        </button>
      </div>

      {/* Jobs List */}
      <div className="rounded-lg border bg-card">
        <div className="grid grid-cols-12 gap-4 p-4 border-b font-medium text-sm text-muted-foreground">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Schedule</div>
          <div className="col-span-4">Message</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No cron jobs configured. Add one to get started.
          </div>
        ) : (
          <div className="divide-y">
            {jobs.map((job) => (
              <div key={job.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors">
                <div className="col-span-3">
                  <div className="font-medium">{job.name}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit ${
                    job.enabled ? 'bg-green-950 text-green-400' : 'bg-muted text-muted-foreground'
                  }`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${job.enabled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                    {job.enabled ? 'Active' : 'Paused'}
                  </div>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {getScheduleDisplay(job)}
                </div>
                <div className="col-span-4 text-sm truncate">{job.payload.message}</div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleToggle(job)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={job.enabled ? 'Pause' : 'Resume'}
                  >
                    {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
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
    </div>
  );
}
