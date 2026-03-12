/**
 * Config page - Simplified module-based configuration editor
 * Groups configs by logical modules (channels, providers, etc.)
 * Each module is a card that opens a full editor
 */

import { useEffect, useState } from 'react';
import { Save, RefreshCw, Eye, EyeOff, Search, AlertTriangle, X, Lock, Database, MessageCircle, Cpu, Wrench, Server, Edit2 } from 'lucide-react';
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

// Module definitions with their field configurations
const MODULE_DEFINITIONS = {
  agents: {
    icon: Cpu,
    label: 'AI 助手',
    description: '模型与行为配置',
    color: 'blue',
    fields: [
      { key: 'model', label: '模型', type: 'text' as const, placeholder: 'anthropic/claude-opus-4-5' },
      { key: 'provider', label: '提供商', type: 'text' as const, placeholder: 'auto' },
      { key: 'maxTokens', label: '最大输出令牌', type: 'number' as const, default: 8192 },
      { key: 'contextWindowTokens', label: '上下文窗口', type: 'number' as const, default: 65536 },
      { key: 'temperature', label: '温度', type: 'number' as const, step: 0.1, default: 0.1 },
      { key: 'maxToolIterations', label: '最大工具迭代', type: 'number' as const, default: 40 },
      { key: 'workspace', label: '工作空间', type: 'text' as const, default: '~/.nanobot/workspace' },
    ],
    nestedPath: 'defaults',
  },
  providers: {
    icon: Database,
    label: 'API 提供商',
    description: '各平台 API 密钥配置',
    color: 'green',
    isProviderList: true,
  },
  channels: {
    icon: MessageCircle,
    label: '通信频道',
    description: '聊天平台接入配置',
    color: 'purple',
    isChannelList: true,
  },
  tools: {
    icon: Wrench,
    label: '工具设置',
    description: 'Web 搜索、命令执行等',
    color: 'orange',
    fields: [
      { key: 'restrictToWorkspace', label: '限制访问工作空间', type: 'boolean' as const },
    ],
    nested: {
      web: {
        label: 'Web 工具',
        fields: [
          { key: 'proxy', label: '代理 URL', type: 'text' as const, placeholder: 'http://127.0.0.1:7890' },
        ],
        nested: {
          search: {
            label: '搜索配置',
            fields: [
              { key: 'apiKey', label: 'Brave API Key', type: 'password' as const },
              { key: 'maxResults', label: '最大结果数', type: 'number' as const, default: 5 },
            ],
          },
        },
      },
      exec: {
        label: '命令执行',
        fields: [
          { key: 'timeout', label: '超时(秒)', type: 'number' as const, default: 60 },
          { key: 'pathAppend', label: '附加路径', type: 'text' as const },
        ],
      },
    },
  },
  gateway: {
    icon: Server,
    label: '网关服务',
    description: '服务器与心跳配置',
    color: 'slate',
    fields: [
      { key: 'host', label: '监听地址', type: 'text' as const, default: '0.0.0.0' },
      { key: 'port', label: '监听端口', type: 'number' as const, default: 18790 },
    ],
    nested: {
      heartbeat: {
        label: '心跳服务',
        fields: [
          { key: 'enabled', label: '启用心跳', type: 'boolean' as const, default: true },
          { key: 'intervalS', label: '间隔(秒)', type: 'number' as const, default: 1800 },
        ],
      },
    },
  },
};

// Channel configurations
const CHANNEL_CONFIGS: Record<string, {
  label: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'password' | 'select';
    placeholder?: string;
    default?: string | number | boolean;
    options?: string[];
  }>;
}> = {
  whatsapp: {
    label: 'WhatsApp',
    description: '通过 WhatsApp 桥接服务接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'bridgeUrl', label: '桥接服务 URL', type: 'text', default: 'ws://localhost:3001' },
      { key: 'bridgeToken', label: '桥接令牌', type: 'password' },
    ],
  },
  telegram: {
    label: 'Telegram',
    description: 'Telegram 机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'token', label: 'Bot Token', type: 'password', placeholder: '从 @BotFather 获取' },
      { key: 'proxy', label: '代理', type: 'text', placeholder: 'socks5://127.0.0.1:1080' },
      { key: 'replyToMessage', label: '回复引用原消息', type: 'boolean', default: false },
      { key: 'groupPolicy', label: '群组策略', type: 'select', options: ['mention', 'open'], default: 'mention' },
    ],
  },
  discord: {
    label: 'Discord',
    description: 'Discord 机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'token', label: 'Bot Token', type: 'password' },
      { key: 'gatewayUrl', label: 'Gateway URL', type: 'text', default: 'wss://gateway.discord.gg/?v=10&encoding=json' },
      { key: 'groupPolicy', label: '群组策略', type: 'select', options: ['mention', 'open'], default: 'mention' },
    ],
  },
  feishu: {
    label: '飞书',
    description: '飞书/Lark 机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'appId', label: 'App ID', type: 'password' },
      { key: 'appSecret', label: 'App Secret', type: 'password' },
      { key: 'encryptKey', label: '加密密钥', type: 'password' },
      { key: 'verificationToken', label: '验证令牌', type: 'password' },
      { key: 'reactEmoji', label: '反应表情', type: 'text', default: 'THUMBSUP' },
    ],
  },
  dingtalk: {
    label: '钉钉',
    description: '钉钉机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'clientId', label: 'Client ID (AppKey)', type: 'password' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  slack: {
    label: 'Slack',
    description: 'Slack 机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'mode', label: '模式', type: 'text', default: 'socket' },
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'xoxb-...' },
      { key: 'appToken', label: 'App Token', type: 'password', placeholder: 'xapp-...' },
      { key: 'replyInThread', label: '线程回复', type: 'boolean', default: true },
      { key: 'reactEmoji', label: '反应表情', type: 'text', default: 'eyes' },
      { key: 'groupPolicy', label: '群组策略', type: 'select', options: ['mention', 'open', 'allowlist'], default: 'mention' },
    ],
  },
  qq: {
    label: 'QQ',
    description: 'QQ 机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'appId', label: 'App ID', type: 'password' },
      { key: 'secret', label: 'App Secret', type: 'password' },
    ],
  },
  wecom: {
    label: '企业微信',
    description: '企业微信 AI 机器人接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'botId', label: 'Bot ID', type: 'password' },
      { key: 'secret', label: 'Bot Secret', type: 'password' },
      { key: 'welcomeMessage', label: '欢迎消息', type: 'text' },
    ],
  },
  email: {
    label: '邮件',
    description: 'IMAP + SMTP 邮件接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'consentGranted', label: '同意访问邮箱', type: 'boolean' },
      { key: 'imapHost', label: 'IMAP 服务器', type: 'text' },
      { key: 'imapPort', label: 'IMAP 端口', type: 'number', default: 993 },
      { key: 'imapUsername', label: 'IMAP 用户名', type: 'text' },
      { key: 'imapPassword', label: 'IMAP 密码', type: 'password' },
      { key: 'smtpHost', label: 'SMTP 服务器', type: 'text' },
      { key: 'smtpPort', label: 'SMTP 端口', type: 'number', default: 587 },
      { key: 'smtpUsername', label: 'SMTP 用户名', type: 'text' },
      { key: 'smtpPassword', label: 'SMTP 密码', type: 'password' },
      { key: 'fromAddress', label: '发件地址', type: 'text' },
      { key: 'autoReplyEnabled', label: '自动回复', type: 'boolean', default: true },
    ],
  },
  web: {
    label: 'Web 面板',
    description: 'Web 控制面板接入',
    fields: [
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'host', label: '监听地址', type: 'text', default: '127.0.0.1' },
      { key: 'port', label: '监听端口', type: 'number', default: 8080 },
      { key: 'authToken', label: '认证令牌', type: 'password' },
    ],
  },
};

// Provider configurations - keys match actual config file (camelCase from Python alias_generator)
interface ProviderInfo {
  label: string;
  color: string;
  isOAuth?: boolean;
}

const PROVIDER_CONFIGS: Record<string, ProviderInfo> = {
  custom: { label: '自定义 API', color: 'gray' },
  azureOpenai: { label: 'Azure OpenAI', color: 'sky' },
  anthropic: { label: 'Anthropic', color: 'orange' },
  openai: { label: 'OpenAI', color: 'green' },
  openrouter: { label: 'OpenRouter', color: 'blue' },
  deepseek: { label: 'DeepSeek', color: 'cyan' },
  groq: { label: 'Groq', color: 'purple' },
  zhipu: { label: '智谱 AI', color: 'indigo' },
  dashscope: { label: '阿里云通义', color: 'orange' },
  vllm: { label: 'vLLM', color: 'indigo' },
  gemini: { label: 'Google Gemini', color: 'blue' },
  moonshot: { label: 'Moonshot', color: 'slate' },
  minimax: { label: 'MiniMax', color: 'pink' },
  siliconflow: { label: '硅基流动', color: 'violet' },
  volcengine: { label: '火山引擎', color: 'red' },
  ollama: { label: 'Ollama (本地)', color: 'emerald' },
  aihubmix: { label: 'AiHubMix', color: 'amber' },
  openaiCodex: { label: 'OpenAI Codex (OAuth)', color: 'green', isOAuth: true },
  githubCopilot: { label: 'GitHub Copilot (OAuth)', color: 'gray', isOAuth: true },
};

interface ConfigItem {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'password' | 'select' | 'object' | 'array';
  placeholder?: string;
  default?: unknown;
  step?: number;
  options?: string[];
  path?: string[];
}

interface ModuleConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: string;
  fields?: ConfigItem[];
  nested?: Record<string, ModuleConfig>;
  nestedPath?: string;
  isProviderList?: boolean;
  isChannelList?: boolean;
  path?: string[];
}

export default function Config() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editConfig, setEditConfig] = useState<ConfigData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingSubKey, setEditingSubKey] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

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

  // Get value from config by path
  const getValueByPath = (obj: unknown, path: string[]): unknown => {
    let current: unknown = obj;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  };

  // Set value in config by path
  const setValueByPath = (obj: ConfigData, path: string[], value: unknown): void => {
    let current: Record<string, unknown> = obj as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
  };

  // Get module status summary
  const getModuleStatus = (moduleKey: string): { enabled: number; total: number; showCount: boolean } => {
    if (!editConfig) return { enabled: 0, total: 0, showCount: false };

    if (moduleKey === 'channels') {
      const channels = editConfig.channels as Record<string, Record<string, unknown>> || {};
      const channelKeys = Object.keys(CHANNEL_CONFIGS);
      const enabled = channelKeys.filter(k => (channels[k] as Record<string, unknown>)?.enabled === true).length;
      return { enabled, total: channelKeys.length, showCount: true };
    }

    if (moduleKey === 'providers') {
      const providers = editConfig.providers as Record<string, Record<string, unknown>> || {};
      const providerKeys = Object.keys(PROVIDER_CONFIGS);
      // Support both camelCase (apiKey, apiBase) and snake_case (api_key, api_base)
      const configured = providerKeys.filter(k => {
        const p = providers[k] as Record<string, unknown> | undefined;
        if (!p) return false;
        const apiKey = (p.apiKey ?? p.api_key) as string | undefined;
        const apiBase = (p.apiBase ?? p.api_base) as string | undefined;
        return apiKey && apiKey.trim() !== '' || apiBase && apiBase.trim() !== '';
      }).length;
      return { enabled: configured, total: providerKeys.length, showCount: true };
    }

    // For agents, tools, gateway - don't show count, just check if configured
    return { enabled: 0, total: 0, showCount: false };
  };

  // Render field editor
  const renderField = (
    field: ConfigItem,
    value: unknown,
    onChange: (val: unknown) => void,
    fullPath: string[]
  ) => {
    const isSecret = isSecretKey(field.key);
    const isVisible = visibleSecrets.has(fullPath.join('.'));
    const displayValue = value ?? field.default ?? '';

    return (
      <div key={field.key} className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm font-medium">
          {field.label}
          {isSecret && <Lock className="h-3.5 w-3.5 text-orange-500" />}
        </label>

        {field.type === 'boolean' ? (
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={displayValue === true}
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm">{displayValue === true ? '启用' : '禁用'}</span>
          </label>
        ) : field.type === 'select' ? (
          <select
            value={String(displayValue)}
            onChange={(e) => onChange(e.target.value)}
            className="input"
          >
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{formatKeyLabel(opt)}</option>
            ))}
          </select>
        ) : (
          <div className="relative">
            <input
              type={isSecret && !isVisible ? 'password' : field.type === 'number' ? 'number' : 'text'}
              step={field.step}
              value={displayValue === true ? 'true' : displayValue === false ? 'false' : String(displayValue)}
              onChange={(e) => {
                const newVal = field.type === 'number'
                  ? Number(e.target.value)
                  : e.target.value;
                onChange(newVal);
              }}
              placeholder={field.placeholder}
              className="input w-full"
            />
            {isSecret && (
              <button
                type="button"
                onClick={() => setVisibleSecrets(prev => {
                  const next = new Set(prev);
                  const key = fullPath.join('.');
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render module editor modal
  const renderModuleEditor = () => {
    if (!editingModule || !editConfig) return null;

    const moduleDef = MODULE_DEFINITIONS[editingModule as keyof typeof MODULE_DEFINITIONS] as ModuleConfig;
    const ModuleIcon = moduleDef.icon;

    // Handle provider list
    if (moduleDef.isProviderList) {
      const providers = editConfig.providers as Record<string, Record<string, unknown>> || {};

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="rounded-md border border-border bg-muted/50 p-2">
              <ModuleIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{moduleDef.label}</h3>
              <p className="text-sm text-muted-foreground">{moduleDef.description}</p>
            </div>
          </div>

          {editingSubKey ? (
            // Edit single provider
            <div className="space-y-4">
              <button
                onClick={() => setEditingSubKey(null)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                ← 返回提供商列表
              </button>

              <div className="p-4 bg-muted/20 rounded-lg">
                <h4 className="font-semibold mb-4">{formatKeyLabel(editingSubKey)}</h4>

                <div className="space-y-4">
                  {renderField(
                    { key: 'apiKey', label: 'API Key', type: 'password' },
                    (providers[editingSubKey]?.apiKey ?? providers[editingSubKey]?.api_key) || '',
                    (val) => {
                      setValueByPath(editConfig, ['providers', editingSubKey, 'apiKey'], val);
                      setEditConfig({ ...editConfig });
                    },
                    ['providers', editingSubKey, 'apiKey']
                  )}

                  {renderField(
                    { key: 'apiBase', label: 'API Base URL', type: 'text', placeholder: '可选' },
                    (providers[editingSubKey]?.apiBase ?? providers[editingSubKey]?.api_base) || '',
                    (val) => {
                      setValueByPath(editConfig, ['providers', editingSubKey, 'apiBase'], val);
                      setEditConfig({ ...editConfig });
                    },
                    ['providers', editingSubKey, 'apiBase']
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Provider list
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(PROVIDER_CONFIGS).map(([key, info]) => {
                const hasKey = !!(providers[key]?.apiKey ?? providers[key]?.api_key);
                const isOAuth = info.isOAuth;

                return (
                  <div
                    key={key}
                    onClick={() => !isOAuth && setEditingSubKey(key)}
                    className={`p-4 rounded-lg border transition-all hover:border-primary/50 ${
                      hasKey ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/30 border-border/50'
                    } ${isOAuth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{info.label}</h4>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{key}</p>
                      </div>
                      {isOAuth ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">OAuth</span>
                      ) : hasKey ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600">已配置</span>
                      ) : (
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Handle channel list
    if (moduleDef.isChannelList) {
      const channels = editConfig.channels as Record<string, Record<string, unknown>> || {};

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="rounded-md border border-border bg-muted/50 p-2">
              <ModuleIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{moduleDef.label}</h3>
              <p className="text-sm text-muted-foreground">{moduleDef.description}</p>
            </div>
          </div>

          {editingSubKey ? (
            // Edit single channel
            <div className="space-y-4">
              <button
                onClick={() => setEditingSubKey(null)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                ← 返回频道列表
              </button>

              <div className="p-4 bg-muted/20 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">{CHANNEL_CONFIGS[editingSubKey]?.label || formatKeyLabel(editingSubKey)}</h4>
                  <span className={`status-badge ${channels[editingSubKey]?.enabled ? 'status-badge-online' : 'status-badge-offline'}`}>
                    {channels[editingSubKey]?.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {CHANNEL_CONFIGS[editingSubKey]?.description}
                </p>

                <div className="space-y-4">
                  {CHANNEL_CONFIGS[editingSubKey]?.fields.map(field => {
                    const fieldPath = ['channels', editingSubKey, field.key];
                    const currentValue = getValueByPath(editConfig, fieldPath);

                    return (
                      <div key={field.key}>
                        {renderField(
                          field as ConfigItem,
                          currentValue,
                          (val) => {
                            setValueByPath(editConfig, fieldPath, val);
                            setEditConfig({ ...editConfig });
                          },
                          fieldPath
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            // Channel list
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(CHANNEL_CONFIGS).map(([key, info]) => {
                const channelConfig = channels[key] || {};
                const isEnabled = channelConfig.enabled === true;

                return (
                  <div
                    key={key}
                    onClick={() => setEditingSubKey(key)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
                      isEnabled ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/30 border-border/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{info.label}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                      </div>
                      {isEnabled ? (
                        <span className="status-badge status-badge-online">已启用</span>
                      ) : (
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Standard module with fields
    const renderModuleFields = (mod: ModuleConfig, basePath: string[]) => {
      return (
        <>
          {mod.fields?.map(field => {
            const fieldPath = [...basePath, field.key];
            const currentValue = getValueByPath(editConfig, fieldPath);

            return (
              <div key={field.key}>
                {renderField(
                  field,
                  currentValue,
                  (val) => {
                    setValueByPath(editConfig, fieldPath, val);
                    setEditConfig({ ...editConfig });
                  },
                  fieldPath
                )}
              </div>
            );
          })}
        </>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="rounded-md border border-border bg-muted/50 p-2">
            <ModuleIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{moduleDef.label}</h3>
            <p className="text-sm text-muted-foreground">{moduleDef.description}</p>
          </div>
        </div>

        <div className="space-y-4">
          {moduleDef.nestedPath ? (
            // Handle nested path (like agents.defaults)
            <div className="p-4 bg-muted/20 rounded-lg space-y-4">
              <h4 className="font-medium">默认配置</h4>
              {renderModuleFields(moduleDef, [editingModule, moduleDef.nestedPath])}
            </div>
          ) : (
            // Direct fields
            renderModuleFields(moduleDef, [editingModule])
          )}

          {moduleDef.nested && Object.entries(moduleDef.nested).map(([subKey, subMod]) => (
            <div key={subKey} className="p-4 bg-muted/20 rounded-lg space-y-4">
              <h4 className="font-medium">{subMod.label}</h4>
              {subMod.fields && renderModuleFields(subMod, [editingModule, subKey])}
              {subMod.nested && Object.entries(subMod.nested).map(([subSubKey, subSubMod]) => (
                <div key={subSubKey} className="mt-4 p-3 bg-background rounded-lg space-y-3">
                  <h5 className="text-sm font-medium text-muted-foreground">{subSubMod.label}</h5>
                  {subSubMod.fields && renderModuleFields(subSubMod, [editingModule, subKey, subSubKey])}
                </div>
              ))}
            </div>
          ))}
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

  const modules = Object.entries(MODULE_DEFINITIONS).map(([key, def]) => {
    const status = getModuleStatus(key);
    return {
      key,
      ...def,
      status,
    };
  });

  const filteredModules = searchQuery
    ? modules.filter(m =>
        m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : modules;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">配置</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理 nanobot 设置
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="搜索配置模块..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input h-10 pl-9"
        />
      </div>

      {/* Module Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredModules.map((module, index) => {
          const ModuleIcon = module.icon;
          const isEnabled = module.status.total > 0 && module.status.enabled > 0;
          const showCount = module.status.showCount;

          return (
            <div
              key={module.key}
              onClick={() => {
                setEditingModule(module.key);
                setEditingSubKey(null);
              }}
              className={`scale-in card-elevated group p-5 cursor-pointer transition-all hover:border-primary/50 ${
                isEnabled ? 'border-green-500/30 bg-green-500/5' : ''
              }`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-md border p-2.5 group-hover:border-primary/50 transition-all ${
                  isEnabled
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-muted/50 border-border'
                }`}>
                  <ModuleIcon className={`h-5 w-5 ${
                    isEnabled ? 'text-green-500' : 'text-muted-foreground'
                  } group-hover:text-primary transition-colors`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{module.label}</h3>
                    {showCount && module.status.total > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isEnabled ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {module.status.enabled}/{module.status.total}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                </div>
                <Edit2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Modal */}
      {editingModule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={() => {
            if (hasChanges && !confirm('有未保存的更改，确定关闭吗？')) {
              return;
            }
            setEditingModule(null);
            setEditingSubKey(null);
          }}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="text-sm text-muted-foreground">编辑配置</div>
              <button
                onClick={() => {
                  if (hasChanges && !confirm('有未保存的更改，确定关闭吗？')) {
                    return;
                  }
                  setEditingModule(null);
                  setEditingSubKey(null);
                }}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {renderModuleEditor()}
            </div>

            <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex justify-end">
              <button
                onClick={() => {
                  setEditingModule(null);
                  setEditingSubKey(null);
                }}
                className="btn btn-secondary"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
