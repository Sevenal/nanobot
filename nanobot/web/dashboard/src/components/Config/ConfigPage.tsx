/**
 * Config page - Visual configuration editor
 */

import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import type { ConfigData } from '@/api/types';

export default function Config() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('agents');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await api.getConfig();
        setConfig(data);
      } catch (error) {
        console.error('Failed to fetch config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      await api.updateConfig(config);
      alert('Configuration saved. Restart gateway for changes to take effect.');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'agents', label: 'Agents', icon: '🤖' },
    { id: 'channels', label: 'Channels', icon: '💬' },
    { id: 'providers', label: 'Providers', icon: '🔑' },
    { id: 'tools', label: 'Tools', icon: '🛠️' },
    { id: 'gateway', label: 'Gateway', icon: '🌐' },
  ];

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
          <p className="text-muted-foreground">
            Manage nanobot settings
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Section Navigation */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-2 text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Configuration Content */}
        <div className="flex-1 rounded-lg border bg-card p-6">
          <h3 className="text-xl font-semibold mb-4 capitalize">{activeSection} Configuration</h3>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            {config ? JSON.stringify(config[activeSection as keyof ConfigData] || {}, null, 2) : '{}'}
          </pre>
          <p className="mt-4 text-sm text-muted-foreground">
            ⚠️ Manual JSON editing. Be careful when making changes.
          </p>
        </div>
      </div>
    </div>
  );
}
