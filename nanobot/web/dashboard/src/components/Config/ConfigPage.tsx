/**
 * Config page - Card-style configuration editor
 * Linear/Vercel Style - Similar to Tools page
 * Shows flattened nested config items, providers grouped by provider name
 */

import { useEffect, useState, createElement } from 'react';
import { Save, RefreshCw, Settings, Eye, EyeOff, Search, AlertTriangle, Trash2, X, FileText, Lock, Database, MessageCircle, Cpu, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/api/client';
import type { ConfigData } from '@/api/types';

// Secret key patterns to detect sensitive data
const SECRET_PATTERNS = [
  /password/i, /secret/i, /token/i, /key/i, /api/i, /credential/i
];

// Check if a key might contain sensitive data
const isSecretKey = (key: string): boolean => {
  return SECRET_PATTERNS.some(pattern => pattern.test(key));
};

// Get display label for config keys
const formatKeyLabel = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
};

// Get icon for config section/key
const getConfigIcon = (_section: string, key: string) => {
  const keyLower = key.toLowerCase();
  if (keyLower.includes('url') || keyLower.includes('endpoint') || keyLower.includes('host')) return Globe;
  if (keyLower.includes('model') || keyLower.includes('provider')) return Cpu;
  if (keyLower.includes('channel') || keyLower.includes('webhook') || keyLower.includes('token')) return MessageCircle;
  if (keyLower.includes('password') || keyLower.includes('secret')) return Lock;
  return FileText;
};

// Value type detection
const getValueType = (value: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as 'string' | 'number' | 'boolean' | 'object';
};

// Get value preview
const getValuePreview = (value: unknown, maxLength = 60): string => {
  const type = getValueType(value);

  if (type === 'null') return 'null';
  if (type === 'boolean') return value ? '启用' : '禁用';
  if (type === 'array') return `[${(value as unknown[]).length} 项]`;
  if (type === 'object') return `{${Object.keys(value as Record<string, unknown>).length} 键}`;
  if (type === 'string') {
    const str = String(value);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }
  return String(value);
};

// Section icons
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  agents: Cpu,
  channels: MessageCircle,
  providers: Database,
  tools: Settings,
  gateway: Globe,
};

interface ConfigItem {
  key: string;
  path: string[];
  value: unknown;
  type: string;
  isSecret: boolean;
  section: string;
  displayKey: string;
  providerName?: string; // For providers section
  modelName?: string; // For provider models
}

interface ProviderGroup {
  name: string;
  config: Record<string, unknown>;
  models: Array<{ name: string; config: Record<string, unknown> }>;
}

export default function Config() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('channels');
  const [hasChanges, setHasChanges] = useState(false);
  const [editConfig, setEditConfig] = useState<ConfigData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ConfigItem | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

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

  // Update nested config value
  const updateConfigValue = (path: string[], value: unknown) => {
    if (!editConfig) return;
    const section = activeSection;
    const sectionData = JSON.parse(JSON.stringify(editConfig[section as keyof ConfigData] || {}));

    let current: Record<string, unknown> = sectionData;
    for (let i = 0; i < path.length - 1; i++) {
      const part = path[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
    setEditConfig({ ...editConfig, [section]: sectionData });
  };

  // Delete config item
  const deleteConfigItem = (path: string[]) => {
    if (!editConfig) return;
    const section = activeSection;
    const sectionData = JSON.parse(JSON.stringify(editConfig[section as keyof ConfigData] || {}));

    if (path.length === 1) {
      delete sectionData[path[0]];
    } else {
      let current: Record<string, unknown> = sectionData;
      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]] && typeof current[path[i]] === 'object') {
          current = current[path[i]] as Record<string, unknown>;
        }
      }
      if (current[path[path.length - 1]]) {
        delete current[path[path.length - 1]];
      }
    }

    setEditConfig({ ...editConfig, [section]: sectionData });
  };

  const sections = [
    { id: 'agents', label: '代理', description: 'AI 助手配置' },
    { id: 'channels', label: '频道', description: '通信渠道设置' },
    { id: 'providers', label: '提供商', description: 'LLM 提供商 API' },
    { id: 'tools', label: '工具', description: '可用工具配置' },
    { id: 'gateway', label: '网关', description: '网关服务设置' },
  ];

  // Get provider groups for providers section
  const getProviderGroups = (): ProviderGroup[] => {
    if (!editConfig || activeSection !== 'providers') return [];
    const providersData = editConfig.providers as Record<string, unknown> || {};
    const groups: ProviderGroup[] = [];

    for (const [providerName, providerConfig] of Object.entries(providersData)) {
      if (typeof providerConfig !== 'object' || providerConfig === null) continue;

      const config = providerConfig as Record<string, unknown>;
      const models: Array<{ name: string; config: Record<string, unknown> }> = [];

      // Extract models if they exist
      if (config.models && typeof config.models === 'object') {
        const modelsData = config.models as Record<string, unknown>;
        for (const [modelName, modelConfig] of Object.entries(modelsData)) {
          if (typeof modelConfig === 'object' && modelConfig !== null) {
            models.push({ name: modelName, config: modelConfig as Record<string, unknown> });
          }
        }
      }

      groups.push({
        name: providerName,
        config: config,
        models: models,
      });
    }

    return groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.models.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  // Get flattened config items for non-providers sections
  const getConfigItems = (): ConfigItem[] => {
    if (!editConfig || activeSection === 'providers') return [];
    const sectionData = editConfig[activeSection as keyof ConfigData] as Record<string, unknown> || {};
    const items: ConfigItem[] = [];

    const flatten = (obj: Record<string, unknown>, path: string[] = []) => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        const type = getValueType(value);

        if (type === 'object' && value !== null && !Array.isArray(value)) {
          const nestedObj = value as Record<string, unknown>;
          // Show enabled field prominently
          if (nestedObj.enabled !== undefined) {
            items.push({
              key: key,
              path: [...path, key, 'enabled'],
              value: nestedObj.enabled,
              type: 'boolean',
              isSecret: false,
              section: activeSection,
              displayKey: [...path, key, 'enabled'].join('.'),
            });
          }
          // Show other fields
          for (const [subKey, subValue] of Object.entries(nestedObj)) {
            if (subKey === 'enabled') continue;
            items.push({
              key: subKey,
              path: [...path, key, subKey],
              value: subValue,
              type: getValueType(subValue),
              isSecret: isSecretKey(subKey),
              section: activeSection,
              displayKey: [...path, key, subKey].join('.'),
            });
          }
        } else {
          items.push({
            key: key,
            path: currentPath,
            value: value,
            type: type,
            isSecret: isSecretKey(key),
            section: activeSection,
            displayKey: currentPath.join('.'),
          });
        }
      }
    };

    flatten(sectionData);

    return items.filter(item =>
      item.displayKey.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const providerGroups = getProviderGroups();
  const configItems = getConfigItems();

  const toggleProviderExpanded = (providerName: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerName)) {
        next.delete(providerName);
      } else {
        next.add(providerName);
      }
      return next;
    });
  };

  // Value editor component for modal
  const ValueEditor = ({ item, onClose }: { item: ConfigItem; onClose: () => void }) => {
    const [editValue, setEditValue] = useState<string>('');

    useEffect(() => {
      if (item.type === 'object' || item.type === 'array') {
        setEditValue(JSON.stringify(item.value, null, 2));
      } else {
        setEditValue(String(item.value ?? ''));
      }
    }, [item]);

    const handleSave = () => {
      let parsedValue: unknown = editValue;

      if (item.type === 'number') {
        parsedValue = Number(editValue) || 0;
      } else if (item.type === 'boolean') {
        parsedValue = editValue === 'true';
      } else if (item.type === 'object' || item.type === 'array') {
        try {
          parsedValue = JSON.parse(editValue);
        } catch {
          alert('JSON 格式错误');
          return;
        }
      }

      updateConfigValue(item.path, parsedValue);
      onClose();
    };

    const isSecretVisible = visibleSecrets.has(item.displayKey);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="rounded-md border border-border bg-muted/50 p-2">
            {createElement(getConfigIcon(item.section, item.key), { className: "h-4 w-4 text-muted-foreground" })}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{formatKeyLabel(item.path[item.path.length - 1])}</h3>
            <p className="text-xs text-muted-foreground font-mono">{item.displayKey}</p>
          </div>
        </div>

        {/* Type Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
            类型: {item.type}
          </span>
          {item.isSecret && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              敏感信息
            </span>
          )}
        </div>

        {/* Editor */}
        <div className="space-y-2">
          {item.type === 'boolean' ? (
            <label className="flex items-center gap-3 cursor-pointer p-4 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={editValue === 'true'}
                onChange={(e) => setEditValue(e.target.checked ? 'true' : 'false')}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm">{editValue === 'true' ? '启用' : '禁用'}</span>
            </label>
          ) : item.type === 'number' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="input w-full"
            />
          ) : (
            <div className="relative">
              {item.isSecret && !isSecretVisible ? (
                <input
                  type="password"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input w-full font-mono"
                  placeholder="••••••••"
                />
              ) : (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input w-full min-h-[200px] font-mono text-sm resize-y"
                  placeholder="输入值..."
                />
              )}
              {item.isSecret && (
                <button
                  type="button"
                  onClick={() => setVisibleSecrets(prev => {
                    const next = new Set(prev);
                    if (next.has(item.displayKey)) next.delete(item.displayKey);
                    else next.add(item.displayKey);
                    return next;
                  })}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {isSecretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Current value preview for complex types */}
        {(item.type === 'object' || item.type === 'array') && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="text-xs text-muted-foreground mb-2">当前值预览:</div>
            <pre className="text-xs font-mono overflow-x-auto max-h-40">
              {JSON.stringify(item.value, null, 2)}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-border/50">
          <button onClick={handleSave} className="btn btn-primary flex-1">
            <Save className="h-4 w-4" />
            保存更改
          </button>
          <button onClick={onClose} className="btn btn-secondary flex-1">
            取消
          </button>
        </div>
      </div>
    );
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
          <h2 className="text-2xl font-semibold tracking-tight">配置</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理 nanobot 设置 · 共 {activeSection === 'providers' ? providerGroups.length : configItems.length} 项配置
          </p>
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

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <div className="alert alert-warning">
          <AlertTriangle className="h-4 w-4" />
          有未保存的配置更改，请记得保存
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {sections.map((section) => {
          const SectionIcon = SECTION_ICONS[section.id] || Settings;
          const sectionData = editConfig?.[section.id as keyof ConfigData] as Record<string, unknown> || {};
          const itemCount = Object.keys(sectionData).length;

          return (
            <button
              key={section.id}
              onClick={() => {
                if (hasChanges && !confirm('切换配置区域将丢失未保存的更改，确定继续吗？')) {
                  return;
                }
                setActiveSection(section.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                activeSection === section.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover:bg-muted/50 border-border/50'
              }`}
            >
              <SectionIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{section.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                activeSection === section.id
                  ? 'bg-primary-foreground/20'
                  : 'bg-muted'
              }`}>
                {itemCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder={`搜索${sections.find(s => s.id === activeSection)?.label}配置...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input h-10 pl-9"
        />
      </div>

      {/* Providers Section - Grouped by provider */}
      {activeSection === 'providers' && (
        <>
          {providerGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? '未找到匹配的提供商' : '暂无提供商配置'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {providerGroups.map((group, index) => {
                const isExpanded = expandedProviders.has(group.name);
                const enabledModels = group.models.filter(m => m.config.enabled === true).length;

                return (
                  <div
                    key={group.name}
                    className="card-elevated rounded-xl overflow-hidden scale-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Provider Header */}
                    <button
                      onClick={() => toggleProviderExpanded(group.name)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-md border border-border bg-muted/50 p-2">
                          <Database className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold capitalize">{formatKeyLabel(group.name)}</h3>
                          <p className="text-xs text-muted-foreground">
                            {group.models.length} 个模型 · {enabledModels} 个已启用
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{group.name}</span>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Provider Models */}
                    {isExpanded && (
                      <div className="border-t border-border/50 p-4">
                        {group.models.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-4">
                            此提供商暂无模型配置
                          </p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {group.models.map((model) => {
                              const isEnabled = model.config.enabled === true;
                              return (
                                <div
                                  key={model.name}
                                  onClick={() => setSelectedItem({
                                    key: 'enabled',
                                    path: [group.name, 'models', model.name, 'enabled'],
                                    value: isEnabled,
                                    type: 'boolean',
                                    isSecret: false,
                                    section: 'providers',
                                    displayKey: `${group.name}.models.${model.name}.enabled`,
                                    providerName: group.name,
                                    modelName: model.name,
                                  })}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
                                    isEnabled
                                      ? 'bg-green-500/5 border-green-500/30'
                                      : 'bg-muted/30 border-border/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-sm truncate">{model.name}</h4>
                                        <span className={`status-badge ${isEnabled ? 'status-badge-online' : 'status-badge-offline'}`}>
                                          {isEnabled ? '已启用' : '已禁用'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1 truncate">
                                        {Object.entries(model.config)
                                          .filter(([k]) => k !== 'enabled')
                                          .map(([k, v]) => `${k}: ${getValuePreview(v, 20)}`)
                                          .join(' · ') || '无其他配置'}
                                      </p>
                                    </div>
                                    <Cpu className={`h-4 w-4 ${isEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Non-providers sections - Flattened cards */}
      {activeSection !== 'providers' && (
        <>
          {configItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? '未找到匹配的配置项' : '此配置区域为空'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {configItems.map((item, index) => {
                const Icon = getConfigIcon(item.section, item.key);
                const isBoolean = item.type === 'boolean';

                return (
                  <div
                    key={item.displayKey}
                    onClick={() => setSelectedItem(item)}
                    className={`scale-in card-elevated group p-4 cursor-pointer ${
                      item.isSecret ? 'border-orange-500/30' : ''
                    } ${isBoolean && item.value ? 'border-green-500/30 bg-green-500/5' : ''}`}
                    style={{ animationDelay: `${index * 25}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-md border p-2 group-hover:border-primary/50 transition-all ${
                        item.isSecret
                          ? 'bg-orange-500/5 border-orange-500/30 group-hover:bg-orange-500/10'
                          : isBoolean && item.value
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-muted/50 border-border group-hover:bg-primary/10'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          item.isSecret
                            ? 'text-orange-500'
                            : isBoolean && item.value
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                        } group-hover:text-primary transition-colors`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate">{formatKeyLabel(item.key)}</h3>
                          {item.isSecret && <Lock className="h-3 w-3 text-orange-500 flex-shrink-0" />}
                          {isBoolean && (
                            <span className={`status-badge ${item.value ? 'status-badge-online' : 'status-badge-offline'}`}>
                              {item.value ? '已启用' : '已禁用'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{item.displayKey}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs flex-wrap">
                      {!isBoolean && (
                        <span className={`px-2 py-0.5 rounded-full ${
                          item.type === 'array'
                            ? 'bg-purple-500/10 text-purple-600'
                            : item.type === 'object'
                            ? 'bg-orange-500/10 text-orange-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {item.type}
                        </span>
                      )}
                      <span className="text-muted-foreground flex-1 truncate">
                        {item.isSecret ? '••••••••' : getValuePreview(item.value, 30)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="text-sm text-muted-foreground">编辑配置</div>
              <button
                onClick={() => setSelectedItem(null)}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ValueEditor item={selectedItem} onClose={() => setSelectedItem(null)} />
            </div>

            <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
              <button
                onClick={() => {
                  if (confirm(`确定删除配置项 "${selectedItem.displayKey}"?`)) {
                    deleteConfigItem(selectedItem.path);
                    setSelectedItem(null);
                  }
                }}
                className="btn btn-outline text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 w-full"
              >
                <Trash2 className="h-4 w-4" />
                删除此配置项
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
