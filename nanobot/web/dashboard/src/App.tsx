/**
 * Main App component with routing and theme support
 * Linear/Vercel Style
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, MessageSquare, Calendar, Brain, Settings, Zap, Server, Users } from 'lucide-react';

// Pages
import Sessions from '@/components/Sessions/SessionsPage';
import SessionDetail from '@/components/Sessions/SessionDetailPage';
import Chat from '@/components/Chat/ChatPage';
import Cron from '@/components/Cron/CronPage';
import Memory from '@/components/Memory/MemoryPage';
import Tools from '@/components/Tools/ToolsPage';
import Config from '@/components/Config/ConfigPage';
import MCP from '@/components/MCP/MCPPage';
import Skills from '@/components/Skills/SkillsPage';
import Subagents from '@/components/Subagents/SubagentsPage';

// Styles
import '@/styles/globals.css';

function AppContent() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const navigation = [
    { name: '会话', href: '/', icon: MessageSquare },
    { name: '聊天', href: '/chat', icon: MessageSquare },
    { name: '定时任务', href: '/cron', icon: Calendar },
    { name: '记忆', href: '/memory', icon: Brain },
    { name: '工具', href: '/tools', icon: Settings },
    { name: '配置', href: '/config', icon: Settings },
    { name: 'MCP', href: '/mcp', icon: Server },
    { name: '技能', href: '/skills', icon: Zap },
    { name: '子代理', href: '/subagents', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-60 transform border-r border-border bg-card lg:translate-x-0 transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center justify-between px-4 border-b border-border/50">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl">🐈</span>
              <span className="font-semibold">nanobot</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden icon-btn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-0.5">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => {
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-border/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">在线</span>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="icon-btn h-8 w-8"
                title={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-60' : ''}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="icon-btn lg:hidden"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <h1 className="text-sm font-medium text-muted-foreground">
                {navigation.find((n) => n.href === location.pathname)?.name || '会话'}
              </h1>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<Sessions />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:key" element={<SessionDetail />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/cron" element={<Cron />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/config" element={<Config />} />
            <Route path="/mcp" element={<MCP />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/subagents" element={<Subagents />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
