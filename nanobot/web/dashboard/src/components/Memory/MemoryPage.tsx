/**
 * Memory page - View and edit MEMORY.md and HISTORY.md
 * Linear/Vercel Style with markdown rendering
 */

import { useEffect, useState } from 'react';
import { Brain, History, Edit, Save, X, RefreshCw } from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import { api } from '@/api/client';

export default function Memory() {
  const [memory, setMemory] = useState('');
  const [history, setHistory] = useState('');
  const [activeTab, setActiveTab] = useState<'memory' | 'history'>('memory');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleStartEdit = () => {
    const content = activeTab === 'memory' ? memory : history;
    setEditContent(content);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent('');
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'memory') {
        await api.updateMemory(editContent);
        setMemory(editContent);
      } else {
        await api.updateMemory(editContent);
        setHistory(editContent);
      }
      setEditing(false);
      setEditContent('');
    } catch (error) {
      console.error('Failed to save memory:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [memoryData, historyData] = await Promise.all([
        api.getMemory(),
        api.getMemoryHistory(),
      ]);
      setMemory(memoryData.content);
      setHistory(historyData.content);
    } catch (error) {
      console.error('Failed to refresh memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentContent = activeTab === 'memory' ? memory : history;
  const hasChanges = editContent !== currentContent;

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
          <h2 className="text-2xl font-semibold tracking-tight">记忆</h2>
          <p className="text-sm text-muted-foreground mt-1">
            查看 nanobot 的长期记忆和历史
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading || editing}
            className="btn btn-outline"
            title="重新加载"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">重新加载</span>
          </button>
          {!editing ? (
            <button onClick={handleStartEdit} className="btn btn-primary">
              <Edit className="h-4 w-4" />
              编辑
            </button>
          ) : (
            <>
              <button onClick={handleCancelEdit} disabled={saving} className="btn btn-secondary">
                <X className="h-4 w-4" />
                取消
              </button>
              <button onClick={handleSave} disabled={saving || !hasChanges} className="btn btn-primary">
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50">
        <button
          onClick={() => {
            if (editing && hasChanges) {
              if (!confirm('切换标签页将丢失未保存的更改，确定继续吗？')) {
                return;
              }
            }
            setActiveTab('memory');
            setEditing(false);
            setEditContent('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 transition-colors text-sm font-medium ${
            activeTab === 'memory'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          disabled={editing}
        >
          <Brain className="h-4 w-4" />
          记忆
        </button>
        <button
          onClick={() => {
            if (editing && hasChanges) {
              if (!confirm('切换标签页将丢失未保存的更改，确定继续吗？')) {
                return;
              }
            }
            setActiveTab('history');
            setEditing(false);
            setEditContent('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 transition-colors text-sm font-medium ${
            activeTab === 'history'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          disabled={editing}
        >
          <History className="h-4 w-4" />
          历史
        </button>
      </div>

      {/* Content */}
      <div className="card-elevated rounded-xl overflow-hidden">
        {editing ? (
          <div className="p-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[500px] bg-background border border-border/50 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              placeholder="在此编辑内容..."
            />
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              {hasChanges ? (
                <span className="text-yellow-600 dark:text-yellow-500">⚠️ 有未保存的更改</span>
              ) : (
                <span className="text-green-600 dark:text-green-500">✓ 内容未更改</span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            {currentContent ? (
              <div className="prose prose-sm max-w-none dark:prose-invert markdown-content">
                <Markdown>{currentContent}</Markdown>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <Brain className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>{activeTab === 'memory' ? '暂无记忆存储' : '暂无历史记录'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      {editing && (
        <div className="alert alert-warning">
          编辑模式：修改将直接保存到 {activeTab === 'memory' ? 'MEMORY.md' : 'HISTORY.md'} 文件。请谨慎修改，确保格式正确。
        </div>
      )}
    </div>
  );
}
