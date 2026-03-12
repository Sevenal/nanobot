/**
 * Skills Management page - View and manage nanobot skills
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { CheckCircle, Code, Eye, RefreshCw, Zap, Info, XCircle } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  source?: string;
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skillSource, setSkillSource] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);

  const fetchSkills = async () => {
    try {
      const data = await fetch('/api/skills').then(r => r.json());
      setSkills(data.skills || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      setError('获取技能列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleViewSource = async (skill: Skill) => {
    setSelectedSkill(skill);
    setLoadingSource(true);
    try {
      const data = await fetch(`/api/skills/${skill.id}/source`).then(r => r.json());
      setSkillSource(data.content || '无法加载源码');
    } catch (err) {
      console.error('Failed to fetch skill source:', err);
      setSkillSource('加载失败');
    } finally {
      setLoadingSource(false);
    }
  };

  const enabledCount = skills.length;

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
          <h2 className="text-2xl font-semibold tracking-tight">技能</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理纳米机器人的能力模块 · 共 {skills.length} 个技能
          </p>
        </div>
        <button onClick={fetchSkills} className="icon-btn" title="刷新">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总技能数</p>
              <p className="text-2xl font-semibold mt-1">{skills.length}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">已启用</p>
              <p className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">{enabledCount}</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">触发词</p>
              <p className="text-2xl font-semibold mt-1">
                {skills.reduce((sum, s) => sum + s.triggers.length, 0)}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3">
              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="alert alert-info">
        <Info className="h-4 w-4" />
        <div>
          <p>技能是 nanobot 的可扩展能力模块，通过 Markdown 文件定义。</p>
          <p className="mt-1">自定义技能放置在 <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">skills/</code> 目录下，系统会自动加载。</p>
        </div>
      </div>

      {/* Skills List */}
      {error ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-lg">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">skills/ 目录中暂无技能文件</p>
          <p className="text-sm text-muted-foreground mt-1">将 Markdown 格式的技能文件放入 skills/ 目录即可</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((skill, index) => (
            <div
              key={skill.id}
              className="scale-in card-elevated group p-4 rounded-xl"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{skill.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{skill.description || '无描述'}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleViewSource(skill)}
                  className="icon-btn"
                  title="查看源码"
                >
                  <Code className="h-4 w-4" />
                </button>
              </div>

              {skill.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skill.triggers.slice(0, 4).map((trigger) => (
                    <span key={trigger} className="status-badge status-badge-offline">
                      {trigger}
                    </span>
                  ))}
                  {skill.triggers.length > 4 && (
                    <span className="status-badge status-badge-offline">
                      +{skill.triggers.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                {skill.source || '未知来源'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skill Source Dialog */}
      {selectedSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={() => setSelectedSkill(null)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedSkill.name}</h3>
                  {selectedSkill.source && (
                    <p className="text-xs text-muted-foreground font-mono">{selectedSkill.source}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedSkill(null)} className="icon-btn">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSource ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <pre className="text-sm bg-muted/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                  {skillSource}
                </pre>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border/50">
              <button onClick={() => setSelectedSkill(null)} className="btn btn-secondary w-full">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
