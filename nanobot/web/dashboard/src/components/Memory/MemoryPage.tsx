/**
 * Memory page - View MEMORY.md and HISTORY.md
 */

import { useEffect, useState } from 'react';
import { Brain, History } from 'lucide-react';
import { api } from '@/api/client';

export default function Memory() {
  const [memory, setMemory] = useState('');
  const [history, setHistory] = useState('');
  const [activeTab, setActiveTab] = useState<'memory' | 'history'>('memory');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [memoryData, historyData] = await Promise.all([
          api.getMemory(),
          api.getMemoryHistory(),
        ]);
        setMemory(memoryData.content);
        setHistory(historyData.content);
      } catch (error) {
        console.error('Failed to fetch memory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading memory...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Memory</h2>
        <p className="text-muted-foreground">
          View nanobot's long-term memory and history
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'memory'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Brain className="h-4 w-4" />
          Memory
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-4 w-4" />
          History
        </button>
      </div>

      {/* Content */}
      <div className="rounded-lg border bg-card p-6">
        {activeTab === 'memory' ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {memory ? (
              <div className="whitespace-pre-wrap">{memory}</div>
            ) : (
              <div className="text-center text-muted-foreground">No memory stored yet.</div>
            )}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {history ? (
              <div className="whitespace-pre-wrap">{history}</div>
            ) : (
              <div className="text-center text-muted-foreground">No history stored yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
