/**
 * Config page - Clean, simple configuration editor with add functionality
 * Linear/Vercel Style
 */

import { useEffect, useState, createElement } from 'react';
import { Save, RefreshCw, Settings, Eye, EyeOff, Search, AlertTriangle, X, FileText, Lock, Database, MessageCircle, Cpu, Globe, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import type { ConfigData } from '@/api/types';

// Secret key patterns
const SECRET_PATTERNS = [
  /password/i, /secret/i, /token/i, /key/i, /api/i, /credential/i
];

const isSecretKey = (key: string): boolean => {
  return SECRET_PATTERNS.some(pattern => pattern.test(key));
};

const formatKeyLabel = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
};

const getConfigIcon = (_section: string, key: string) => {
  const keyLower = key.toLowerCase();
  if (keyLower.includes('url') || keyLower.includes('endpoint') || keyLower.includes('host')) return Globe;
  if (keyLower.includes('model') || keyLower.includes('provider')) return Cpu;
  if (keyLower.includes('channel') || keyLower.includes('webhook') || keyLower.includes('token')) return MessageCircle;
  if (keyLower.includes('password') || keyLower.includes('secret')) return Lock;
  return FileText;
};

const getValueType = (value: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as 'string' | 'number' | 'boolean' | 'object';
};

const getValuePreview = (value: unknown, maxLength = 50): string => {
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

interface ConfigItem {
  key: string;
  path: string[];
  value: unknown;
  type: string;
  isSecret: boolean;
  section: string;
  displayKey: string;
  parentKey?: string;
}

interface ProviderGroup {
  name: string;
  config: Record<string, unknown>;
  models: Array<{ name: string; config: Record<string, unknown> }>;
}

type ValueType = 'string' | 'number' | 'boolean' | 'object' | 'array';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModelProvider, setAddModelProvider] = useState<string | null>(null);

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

  // Add new config item
  const addConfigItem = (key: string, valueType: ValueType, value: unknown) => {
    if (!editConfig || !key.trim()) return;

    const section = activeSection;
    const sectionData = JSON.parse(JSON.stringify(editConfig[section as keyof ConfigData] || {}));

    let finalValue: unknown = value;
    if (valueType === 'number') {
      finalValue = Number(value) || 0;
    } else if (valueType === 'boolean') {
      finalValue = value === true || value === 'true';
    } else if (valueType === 'object') {
      finalValue = {};
    } else if (valueType === 'array') {
      finalValue = [];
    } else {
      finalValue = value ?? '';
    }

    sectionData[key] = finalValue;
    setEditConfig({ ...editConfig, [section]: sectionData });
  };

  // Add new provider
  const addProvider = (providerName: string, apiKey?: string, baseUrl?: string) => {
    if (!editConfig || !providerName.trim()) return;
    const providersData = JSON.parse(JSON.stringify(editConfig.providers as Record<string, unknown> || {}));
    const providerConfig: Record<string, unknown> = { models: {} };
    if (apiKey?.trim()) providerConfig.api_key = apiKey.trim();
    if (baseUrl?.trim()) providerConfig.base_url = baseUrl.trim();
    providersData[providerName] = providerConfig;
    setEditConfig({ ...editConfig, providers: providersData });
  };

  // Add model to provider
  const addModelToProvider = (providerName: string, modelName: string, apiKey?: string, baseUrl?: string, enabled?: boolean) => {
    if (!editConfig || !modelName.trim()) return;
    const providersData = JSON.parse(JSON.stringify(editConfig.providers as Record<string, unknown> || {}));
    const provider = providersData[providerName] as Record<string, unknown> | undefined;
    if (provider && typeof provider === 'object') {
      const models = provider.models as Record<string, unknown> || {};
      const modelConfig: Record<string, unknown> = { enabled: enabled ?? false };
      if (apiKey?.trim()) modelConfig.api_key = apiKey.trim();
      if (baseUrl?.trim()) modelConfig.base_url = baseUrl.trim();
      models[modelName] = modelConfig;
      provider.models = models;
    }
    setEditConfig({ ...editConfig, providers: providersData });
  };

  const sections = [
    { id: 'agents', label: '代理', icon: Cpu },
    { id: 'channels', label: '频道', icon: MessageCircle },
    { id: 'providers', label: '提供商', icon: Database },
    { id: 'tools', label: '工具', icon: Settings },
    { id: 'gateway', label: '网关', icon: Globe },
  ];

  const getProviderGroups = (): ProviderGroup[] => {
    if (!editConfig || activeSection !== 'providers') return [];
    const providersData = editConfig.providers as Record<string, unknown> || {};
    const groups: ProviderGroup[] = [];

    for (const [providerName, providerConfig] of Object.entries(providersData)) {
      if (typeof providerConfig !== 'object' || providerConfig === null) continue;
      const config = providerConfig as Record<string, unknown>;
      const models: Array<{ name: string; config: Record<string, unknown> }> = [];

      if (config.models && typeof config.models === 'object') {
        const modelsData = config.models as Record<string, unknown>;
        for (const [modelName, modelConfig] of Object.entries(modelsData)) {
          if (typeof modelConfig === 'object' && modelConfig !== null) {
            models.push({ name: modelName, config: modelConfig as Record<string, unknown> });
          }
        }
      }
      groups.push({ name: providerName, config, models });
    }

    return groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.models.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const getConfigItems = (): ConfigItem[] => {
    if (!editConfig || activeSection === 'providers') return [];
    const sectionData = editConfig[activeSection as keyof ConfigData] as Record<string, unknown> || {};
    const items: ConfigItem[] = [];

    for (const [key, value] of Object.entries(sectionData)) {
      const type = getValueType(value);
      const isObject = type === 'object' && value !== null && !Array.isArray(value);

      if (isObject) {
        const nestedObj = value as Record<string, unknown>;
        items.push({
          key,
          path: [key],
          value: nestedObj,
          type: 'object',
          isSecret: false,
          section: activeSection,
          displayKey: key,
          parentKey: key,
        });
      } else {
        items.push({
          key,
          path: [key],
          value,
          type,
          isSecret: isSecretKey(key),
          section: activeSection,
          displayKey: key,
        });
      }
    }

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
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="rounded-lg border border-border bg-muted/50 p-2">
            {createElement(getConfigIcon(item.section, item.key), { className: "h-5 w-5 text-muted-foreground" })}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{formatKeyLabel(item.path[item.path.length - 1])}</h3>
            <p className="text-sm text-muted-foreground font-mono">{item.displayKey}</p>
          </div>
        </div>

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

        <div className="space-y-2">
          {item.type === 'boolean' ? (
            <label className="flex items-center gap-3 cursor-pointer p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={editValue === 'true'}
                onChange={(e) => setEditValue(e.target.checked ? 'true' : 'false')}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm font-medium">{editValue === 'true' ? '启用' : '禁用'}</span>
            </label>
          ) : item.type === 'number' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="input w-full h-11"
            />
          ) : (
            <div className="relative">
              {item.isSecret && !isSecretVisible ? (
                <input
                  type="password"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input w-full h-11 font-mono"
                  placeholder="••••••••"
                />
              ) : (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input w-full min-h-[150px] font-mono text-sm resize-y"
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

        {(item.type === 'object' || item.type === 'array') && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border">
            <div className="text-xs text-muted-foreground mb-2">当前值预览:</div>
            <pre className="text-xs font-mono overflow-x-auto max-h-40">
              {JSON.stringify(item.value, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} className="btn btn-primary flex-1 h-10">
            <Save className="h-4 w-4" />
            保存
          </button>
          <button onClick={onClose} className="btn btn-secondary flex-1 h-10">
            取消
          </button>
        </div>
      </div>
    );
  };

  // Add Config Modal
  const AddConfigModal = () => {
    const [key, setKey] = useState('');
    const [valueType, setValueType] = useState<ValueType>('string');
    const [value, setValue] = useState('');

    const handleAdd = () => {
      if (!key.trim()) {
        alert('请输入配置键名');
        return;
      }
      addConfigItem(key, valueType, value);
      setShowAddModal(false);
      setKey('');
      setValue('');
      setValueType('string');
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowAddModal(false)}
      >
        <div
          className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="font-medium">添加配置项</span>
            <button onClick={() => setShowAddModal(false)} className="icon-btn">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">配置键名</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="例如: api_key"
                className="input w-full h-10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">值类型</label>
              <select
                value={valueType}
                onChange={(e) => setValueType(e.target.value as ValueType)}
                className="input w-full h-10"
              >
                <option value="string">字符串</option>
                <option value="number">数字</option>
                <option value="boolean">布尔值</option>
                <option value="object">对象</option>
                <option value="array">数组</option>
              </select>
            </div>

            {valueType === 'boolean' ? (
              <div>
                <label className="block text-sm font-medium mb-1.5">值</label>
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="input w-full h-10"
                >
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </div>
            ) : valueType === 'object' || valueType === 'array' ? (
              <div className="text-sm text-muted-foreground">
                将创建一个空的{valueType === 'object' ? '对象' : '数组'}，您可以之后编辑它
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">值</label>
                <input
                  type={valueType === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="输入值..."
                  className="input w-full h-10"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 px-5 pb-5">
            <button onClick={handleAdd} className="btn btn-primary flex-1 h-10">
              <Plus className="h-4 w-4" />
              添加
            </button>
            <button onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1 h-10">
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add Provider Modal
  const AddProviderModal = () => {
    const [providerName, setProviderName] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<string | null>(addModelProvider);
    const [providerApiKey, setProviderApiKey] = useState('');
    const [providerBaseUrl, setProviderBaseUrl] = useState('');
    const [modelName, setModelName] = useState('');
    const [modelApiKey, setModelApiKey] = useState('');
    const [modelBaseUrl, setModelBaseUrl] = useState('');
    const [modelEnabled, setModelEnabled] = useState(true);
    const [step, setStep] = useState<'provider' | 'model'>(addModelProvider ? 'model' : 'provider');

    const commonProviders = [
      { name: 'anthropic', label: 'Anthropic (Claude)' },
      { name: 'openai', label: 'OpenAI (GPT)' },
      { name: 'ollama', label: 'Ollama (本地)' },
      { name: 'deepseek', label: 'DeepSeek' },
      { name: 'glm', label: '智谱 GLM' },
      { name: 'qwen', label: '通义千问' },
    ];

    const handleAddProvider = () => {
      const name = selectedProvider || providerName;
      if (!name.trim()) {
        alert('请输入或选择提供商名称');
        return;
      }
      addProvider(name, providerApiKey, providerBaseUrl);
      setSelectedProvider(name);
      setStep('model');
    };

    const handleClose = () => {
      setShowAddModal(false);
      setAddModelProvider(null);
      setProviderName('');
      setSelectedProvider(null);
      setProviderApiKey('');
      setProviderBaseUrl('');
      setModelName('');
      setModelApiKey('');
      setModelBaseUrl('');
      setModelEnabled(true);
      setStep('provider');
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="font-medium">
              {step === 'provider' ? '添加提供商' : `添加模型到 ${selectedProvider}`}
            </span>
            <button onClick={handleClose} className="icon-btn">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {step === 'provider' ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">选择常用提供商</label>
                  <div className="grid grid-cols-2 gap-2">
                    {commonProviders.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setSelectedProvider(p.name)}
                        className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                          selectedProvider === p.name
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:bg-muted/50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">或输入自定义名称</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">提供商名称</label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => {
                      setProviderName(e.target.value);
                      setSelectedProvider(null);
                    }}
                    placeholder="例如: my_provider"
                    className="input w-full h-10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={providerApiKey}
                    onChange={(e) => setProviderApiKey(e.target.value)}
                    placeholder="sk-ant-xxx 或 sk-xxx"
                    className="input w-full h-10 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    可选，该提供商下的模型都会使用此配置
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Base URL</label>
                  <input
                    type="text"
                    value={providerBaseUrl}
                    onChange={(e) => setProviderBaseUrl(e.target.value)}
                    placeholder="例如: https://api.anthropic.com"
                    className="input w-full h-10 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    可选，自定义 API 端点
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm">
                    提供商: <span className="font-medium">{selectedProvider}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">模型名称 *</label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="例如: claude-3-5-sonnet-20241022"
                    className="input w-full h-10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    输入模型的标识符
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={modelApiKey}
                    onChange={(e) => setModelApiKey(e.target.value)}
                    placeholder="sk-ant-xxx 或 sk-xxx"
                    className="input w-full h-10 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    可选，留空则使用提供商级别的配置
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Base URL</label>
                  <input
                    type="text"
                    value={modelBaseUrl}
                    onChange={(e) => setModelBaseUrl(e.target.value)}
                    placeholder="例如: https://api.anthropic.com"
                    className="input w-full h-10 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    可选，用于自定义 API 端点
                  </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={modelEnabled}
                    onChange={(e) => setModelEnabled(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium">启用此模型</span>
                </label>
              </>
            )}
          </div>

          <div className="flex gap-2 px-5 pb-5">
            {step === 'provider' ? (
              <>
                <button onClick={handleAddProvider} className="btn btn-primary flex-1 h-10">
                  <Plus className="h-4 w-4" />
                  添加提供商
                </button>
                <button onClick={handleClose} className="btn btn-secondary h-10 px-4">
                  取消
                </button>
              </>
            ) : (
              <>
                <button onClick={() => {
                  if (!modelName.trim()) {
                    alert('请输入模型名称');
                    return;
                  }
                  addModelToProvider(selectedProvider!, modelName, modelApiKey, modelBaseUrl, modelEnabled);
                  setModelName('');
                  setModelApiKey('');
                  setModelBaseUrl('');
                  setModelEnabled(true);
                  // Keep modal open to add more models
                }} className="btn btn-primary flex-1 h-10">
                  <Plus className="h-4 w-4" />
                  添加模型
                </button>
                <button
                  onClick={() => {
                    setStep('provider');
                    setSelectedProvider(null);
                    setModelName('');
                    setModelApiKey('');
                    setModelBaseUrl('');
                    setModelEnabled(true);
                  }}
                  className="btn btn-secondary h-10 px-4"
                >
                  返回
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">配置</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理 nanobot 设置
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReload} className="btn btn-outline h-9">
            <RefreshCw className="h-4 w-4" />
            重新加载
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn btn-primary h-9"
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
          有未保存的配置更改
        </div>
      )}

      {/* Section Sidebar + Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => {
                    if (hasChanges && !confirm('切换区域将丢失未保存的更改，确定继续吗？')) {
                      return;
                    }
                    setActiveSection(section.id);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <SectionIcon className="h-4 w-4 flex-shrink-0" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Search & Add Bar */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索配置..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input h-10 pl-9 w-full"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">添加</span>
            </button>
          </div>

          {/* Providers Section */}
          {activeSection === 'providers' && (
            <div className="space-y-3">
              {providerGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="mb-4">{searchQuery ? '未找到匹配的提供商' : '暂无提供商配置'}</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-outline"
                  >
                    <Plus className="h-4 w-4" />
                    添加提供商
                  </button>
                </div>
              ) : (
                providerGroups.map((group) => {
                  const isExpanded = expandedProviders.has(group.name);
                  const enabledModels = group.models.filter(m => m.config.enabled === true).length;

                  return (
                    <div key={group.name} className="card-elevated rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleProviderExpanded(group.name)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-medium capitalize">{formatKeyLabel(group.name)}</div>
                            <div className="text-xs text-muted-foreground">
                              {group.models.length} 个模型 · {enabledModels} 个已启用
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border p-3 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">模型列表</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddModelProvider(group.name);
                                setShowAddModal(true);
                              }}
                              className="text-xs btn btn-ghost h-7 px-2"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              添加模型
                            </button>
                          </div>
                          {group.models.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-2">
                              此提供商暂无模型配置
                            </p>
                          ) : (
                            group.models.map((model) => {
                              const isEnabled = model.config.enabled === true;
                              const otherConfig = Object.entries(model.config)
                                .filter(([k]) => k !== 'enabled')
                                .map(([k, v]) => `${k}: ${getValuePreview(v, 15)}`)
                                .join(' · ');

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
                                  })}
                                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                    isEnabled
                                      ? 'bg-green-500/5 border-green-500/30 hover:border-green-500/50'
                                      : 'bg-muted/30 border-border hover:border-border'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{model.name}</span>
                                      <span className={`status-badge ${isEnabled ? 'status-badge-online' : 'status-badge-offline'}`}>
                                        {isEnabled ? '已启用' : '已禁用'}
                                      </span>
                                    </div>
                                    {otherConfig && (
                                      <p className="text-xs text-muted-foreground mt-1 truncate">{otherConfig}</p>
                                    )}
                                  </div>
                                  <Cpu className={`h-4 w-4 flex-shrink-0 ml-2 ${isEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Non-providers Sections */}
          {activeSection !== 'providers' && (
            <div className="space-y-2">
              {configItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="mb-4">{searchQuery ? '未找到匹配的配置项' : '此配置区域为空'}</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-outline"
                  >
                    <Plus className="h-4 w-4" />
                    添加配置项
                  </button>
                </div>
              ) : (
                configItems.map((item) => {
                  const Icon = getConfigIcon(item.section, item.key);
                  const isObject = item.type === 'object';

                  return (
                    <div
                      key={item.displayKey}
                      onClick={() => setSelectedItem(item)}
                      className={`card-elevated rounded-lg p-4 cursor-pointer transition-all hover:border-primary/50 ${
                        item.isSecret ? 'border-orange-500/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`rounded-lg border p-2 ${
                          item.isSecret
                            ? 'bg-orange-500/5 border-orange-500/30'
                            : 'bg-muted/50 border-border'
                        }`}>
                          <Icon className={`h-4 w-4 ${item.isSecret ? 'text-orange-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">{formatKeyLabel(item.key)}</h3>
                            {item.isSecret && <Lock className="h-3 w-3 text-orange-500" />}
                            <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                              {item.type}
                            </span>
                          </div>
                          {isObject ? (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {Object.keys(item.value as Record<string, unknown>).length} 个子项
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground truncate">
                              {item.isSecret ? '••••••••' : getValuePreview(item.value)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="font-medium">编辑配置</span>
              <button onClick={() => setSelectedItem(null)} className="icon-btn">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ValueEditor item={selectedItem} onClose={() => setSelectedItem(null)} />
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/20 flex gap-2">
              <button
                onClick={() => {
                  if (confirm(`确定删除配置项 "${selectedItem.displayKey}"?`)) {
                    deleteConfigItem(selectedItem.path);
                    setSelectedItem(null);
                  }
                }}
                className="btn btn-outline text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex-1 h-9"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        activeSection === 'providers' ? <AddProviderModal /> : <AddConfigModal />
      )}
    </div>
  );
}
