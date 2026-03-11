/**
 * Tools page - View available nanobot tools
 */

import { useEffect, useState } from 'react';
import { Wrench, FileText, Search } from 'lucide-react';
import { api } from '@/api/client';
import type { Tool } from '@/api/types';

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading tools...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tools</h2>
        <p className="text-muted-foreground">
          Available tools for nanobot agent
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Tools Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => (
          <div key={tool.name} className="rounded-lg border bg-card p-6 hover:border-primary/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Wrench className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{tool.name}</h3>
                {tool.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>
                )}
                {tool.parameters && (
                  <details className="mt-2">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      <FileText className="inline h-3 w-3 mr-1" />
                      Parameters
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(tool.parameters, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tools found matching "{search}"
        </div>
      )}
    </div>
  );
}
