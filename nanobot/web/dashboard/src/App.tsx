/**
 * Main App component with routing and theme support
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, Layout, MessageSquare, Calendar, Brain, Settings, Activity } from 'lucide-react';

// Pages
import Dashboard from '@/components/Dashboard/DashboardPage';
import Sessions from '@/components/Sessions/SessionsPage';
import Chat from '@/components/Chat/ChatPage';
import Cron from '@/components/Cron/CronPage';
import Memory from '@/components/Memory/MemoryPage';
import Tools from '@/components/Tools/ToolsPage';
import Config from '@/components/Config/ConfigPage';
import Events from '@/components/Events/EventsPage';

// Styles
import '@/styles/globals.css';

function AppContent() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  // Apply theme
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
    { name: 'Dashboard', href: '/', icon: Layout },
    { name: 'Sessions', href: '/sessions', icon: MessageSquare },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Cron Jobs', href: '/cron', icon: Calendar },
    { name: 'Memory', href: '/memory', icon: Brain },
    { name: 'Tools', href: '/tools', icon: Settings },
    { name: 'Config', href: '/config', icon: Settings },
    { name: 'Events', href: '/events', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 transform border-r bg-card transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐈</span>
              <span className="text-xl font-bold">nanobot</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Connection Status */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">WebSocket</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-muted-foreground hover:text-foreground lg:hidden"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <h1 className="text-xl font-semibold">
                {navigation.find((n) => n.href === location.pathname)?.name || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:key" element={<Sessions />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/cron" element={<Cron />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/config" element={<Config />} />
            <Route path="/events" element={<Events />} />
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
