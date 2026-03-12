/**
 * Config page - Visual configuration editor with form and JSON views
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { Save, RefreshCw, Code, Settings, Eye, EyeOff } from 'lucide-react';
import { api } from '@/api/client';
import type { ConfigData } from '@/api/types';

export default function Config() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('agents');
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [hasChanges, setHasChanges] = useState(false);
  const [editConfig, setEditConfig] = useState<ConfigData | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await api.getConfig();
        setConfig(data);
        setEditConfig(JSON.parse(JSON.stringify(data)));
      } catch (error) {
        console.error('Failed to fetch config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (config && editConfig) {
      setHasChanges(JSON.stringify(config) !== JSON.stringify(editConfig));
    }
  }, [editConfig, config]);

  const handleSave = async () => {
    if (!editConfig) return;

    setSaving(true);
    try {
      await api.updateConfig(editConfig);
      setConfig(JSON.parse(JSON.stringify(editConfig)));
      setHasChanges(false);
      alert('配置已保存。重启 gateway 以使更改生效。');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      const data = await api.getConfig();
      setConfig(data);
      setEditConfig(JSON.parse(JSON.stringify(data)));
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to reload config:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSectionConfig = (section: string, updates: Record<string, unknown>) => {
    if (!editConfig) return;
    setEditConfig({
      ...editConfig,
      [section]: {
        ...(editConfig[section as keyof ConfigData] as Record<string, unknown> || {}),
        ...updates,
      },
    });
  };

  const sections = [
    { id: 'agents', label: '代理', icon: '🤖', description: 'AI 助手配置' },
    { id: 'channels', label: '频道', icon: '💬', description: '通信渠道设置' },
    { id: 'providers', label: '提供商', icon: '🔑', description: 'LLM 提供商 API' },
    { id: 'tools', label: '工具', icon: '🛠️', description: '可用工具配置' },
    { id: 'gateway', label: '网关', icon: '🌐', description: '网关服务设置' },
  ];

  const renderFormEditor = () => {
    const sectionData = editConfig?.[activeSection as keyof ConfigData] as Record<string, unknown> || {};

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{sections.find(s => s.id === activeSection)?.label} 配置</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {sections.find(s => s.id === activeSection)?.description}
            </p>
          </div>
          <button
            onClick={() => setViewMode('json')}
            className="btn btn-outline text-sm"
          >
            <Code className="h-4 w-4" />
            编辑 JSON
          </button>
        </div>

        <div className="space-y-3">
          {Object.entries(sectionData).map(([key, value]) => (
            <div key={key} className="card-flat p-4 rounded-lg">
              <label className="block text-sm font-medium mb-2">{key}</label>

              {typeof value === 'boolean' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={key}
                    checked={value as boolean}
                    onChange={(e) => updateSectionConfig(activeSection, { [key]: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor={key} className="text-sm text-muted-foreground">
                    {value ? '启用' : '禁用'}
                  </label>
                </div>
              )}

              {typeof value === 'string' && (
                <input
                  type="text"
                  value={value as string}
                  onChange={(e) => updateSectionConfig(activeSection, { [key]: e.target.value })}
                  className="input"
                />
              )}

              {typeof value === 'number' && (
                <input
                  type="number"
                  value={value as number}
                  onChange={(e) => updateSectionConfig(activeSection, { [key]: Number(e.target.value) })}
                  className="input"
                />
              )}

              {typeof value === 'object' && value !== null && !Array.isArray(value) && (
                <div className="space-y-2">
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      展开配置 ({Object.keys(value).length} 项)
                    </summary>
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-border/50">
                      {Object.entries(value as Record<string, unknown>).map(([subKey, subValue]) => (
                        <div key={subKey}>
                          <label className="block text-xs text-muted-foreground mb-1">{subKey}</label>
                          {typeof subValue === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={subValue as boolean}
                              onChange={(e) => {
                                const updated = { ...value, [subKey]: e.target.checked };
                                updateSectionConfig(activeSection, { [key]: updated });
                              }}
                              className="rounded"
                            />
                          ) : typeof subValue === 'string' || typeof subValue === 'number' ? (
                            <input
                              type="text"
                              value={String(subValue)}
                              onChange={(e) => {
                                let newVal: string | number = e.target.value;
                                if (typeof subValue === 'number') {
                                  newVal = Number(e.target.value) || 0;
                                }
                                const updated = { ...value, [subKey]: newVal };
                                updateSectionConfig(activeSection, { [key]: updated });
                              }}
                              className="input text-xs"
                            />
                          ) : (
                            <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(subValue, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {Array.isArray(value) && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    数组配置 ({value.length} 项)
                  </summary>
                  <div className="mt-2">
                    <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-60">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          ))}

          {Object.keys(sectionData).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              此配置区域为空
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderJsonEditor = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{sections.find(s => s.id === activeSection)?.label} JSON</h3>
          <p className="text-sm text-muted-foreground mt-0.5">直接编辑 JSON 配置</p>
        </div>
        <button onClick={() => setViewMode('form')} className="btn btn-outline text-sm">
          <Settings className="h-4 w-4" />
          表单视图
        </button>
      </div>

      <textarea
        value={JSON.stringify(editConfig?.[activeSection as keyof ConfigData] || {}, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            setEditConfig({
              ...editConfig,
              [activeSection]: parsed,
            } as ConfigData);
          } catch {
            // Invalid JSON, don't update
          }
        }}
        className="w-full min-h-[400px] bg-muted/50 border border-border/50 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
      />

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Eye className="h-4 w-4" />
        <span>JSON 编辑模式 - 确保格式正确</span>
      </div>
    </div>
  );

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">配置</h2>
          <p className="text-sm text-muted-foreground mt-1">管理 nanobot 设置</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReload} className="btn btn-outline">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">重新加载</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn btn-primary"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="alert alert-warning">
          <EyeOff className="h-4 w-4" />
          有未保存的配置更改
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section Navigation */}
        <div className="lg:w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  if (hasChanges && !confirm('切换配置区域将丢失未保存的更改，确定继续吗？')) {
                    return;
                  }
                  setActiveSection(section.id);
                  setViewMode('form');
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="text-lg">{section.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{section.label}</div>
                  <div className={`text-xs truncate ${activeSection === section.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {section.description}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Configuration Content */}
        <div className="flex-1 card-elevated rounded-xl p-6">
          {viewMode === 'form' ? renderFormEditor() : renderJsonEditor()}
        </div>
      </div>
    </div>
  );
}
