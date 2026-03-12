/**
 * Tools page - View available nanobot tools with details
 * Linear/Vercel Style
 */

import { useEffect, useState } from 'react';
import { Wrench, FileText, Search, X, Info, Copy, Check, Code, Zap } from 'lucide-react';
import { api } from '@/api/client';
import type { Tool } from '@/api/types';

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const data = await api.listTools();
        setTools(data.tools);
      } catch (error) {
        console.error('Failed to fetch tools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  const handleToolClick = async (toolName: string) => {
    try {
      const detail = await api.getTool(toolName);
      setSelectedTool(detail);
    } catch (error) {
      console.error('Failed to fetch tool detail:', error);
    }
  };

  const handleCloseDetail = () => {
    setSelectedTool(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderParameterSchema = (schema: any, path = '') => {
    if (!schema) return null;

    if (schema.type === 'object' && schema.properties) {
      return (
        <div className="space-y-3">
          {Object.entries(schema.properties).map(([key, value]: [string, any]) => (
            <div key={path + key} className="group">
              <div className="flex items-center gap-2 py-1">
                <span className="font-mono text-sm font-medium">{key}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {value.type || 'unknown'}
                </span>
                {value.description && (
                  <span className="text-xs text-muted-foreground truncate flex-1">- {value.description}</span>
                )}
              </div>
              {renderParameterSchema(value, path + key + '.')}
            </div>
          ))}
        </div>
      );
    }

    if (schema.type === 'array' && schema.items) {
      return (
        <div className="ml-4">
          <div className="text-sm text-muted-foreground mb-1">数组项：</div>
          {renderParameterSchema(schema.items, path + '[]')}
        </div>
      );
    }

    if (schema.enum) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">可选值:</span>
          <div className="flex flex-wrap gap-1">
            {schema.enum.map((val: string) => (
              <span key={val} className="font-mono text-xs px-2 py-1 rounded-md bg-muted">
                {val}
              </span>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(search.toLowerCase())
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">工具</h2>
          <p className="text-sm text-muted-foreground mt-1">
            nanobot 可用工具 · 共 {filteredTools.length} 个
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="搜索工具..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input h-10 pl-9"
        />
      </div>

      {/* Tools Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool, index) => (
          <div
            key={tool.name}
            onClick={() => handleToolClick(tool.name)}
            className="scale-in card-elevated group p-4 cursor-pointer"
            style={{ animationDelay: `${index * 25}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-border bg-muted/50 p-2 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all">
                <Wrench className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm truncate">{tool.name}</h3>
                </div>
                {tool.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                )}
              </div>
            </div>
            {tool.parameters && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>{Object.keys(tool.parameters).length} 个参数</span>
                <Info className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {search ? `未找到匹配 "${search}" 的工具` : '暂无可用工具'}
          </p>
        </div>
      )}

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={handleCloseDetail}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-border bg-muted/50 p-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedTool.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedTool.description || '无描述'}</p>
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="icon-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Parameters */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  参数定义
                </h4>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  {selectedTool.parameters?.type ? (
                    <div className="space-y-3">
                      {renderParameterSchema(selectedTool.parameters)}
                    </div>
                  ) : (
                    <pre className="text-xs text-muted-foreground font-mono">
                      {JSON.stringify(selectedTool.parameters, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              {/* Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    使用示例
                  </h4>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedTool.parameters, null, 2))}
                    className="text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-all rounded-md px-2 py-1"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono text-muted-foreground">
{`{
  "type": "tool_call",
  "name": "${selectedTool.name}",
  "arguments": {
    // 参数值
  }
}`}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/50">
              <button
                onClick={handleCloseDetail}
                className="btn btn-secondary w-full"
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
