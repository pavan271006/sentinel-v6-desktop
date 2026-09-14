import React, { useEffect, useMemo, useRef } from 'react';
import { cn } from '../../design-system/utils';
import { useCommandPaletteStore, CommandItem } from '../../stores/commandPaletteStore';
import { useAppShellStore } from '../../stores/appShellStore';
import { useToastStore } from '../../stores/toastStore';
import { ipcClient } from '../../ipc/client';
import {
  Search,
  Radio,
  Shield,
  Layers,
  Moon,
  Sun,
  Terminal,
  Zap,
  Settings,
} from 'lucide-react';
import { Kbd } from '../../design-system/Kbd';

export const CommandPalette: React.FC = () => {
  const { isOpen, query, selectedIndex, open, close, setQuery, setSelectedIndex } =
    useCommandPaletteStore();
  const {
    setActiveWorkspace,
    toggleTheme,
    theme,
    proxyRunning,
    setProxyRunning,
  } = useAppShellStore();
  const { addToast } = useToastStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey listener (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const registeredCommands: CommandItem[] = useMemo(() => {
    return [
      {
        id: 'ws-traffic',
        title: 'Switch to Traffic History',
        category: 'Workspace',
        shortcut: 'Alt+1',
        action: () => {
          setActiveWorkspace('traffic');
          addToast({ type: 'info', title: 'Switched to Traffic History' });
        },
      },
      {
        id: 'ws-repeater',
        title: 'Switch to Repeater (Manual Testing)',
        category: 'Workspace',
        shortcut: 'Alt+2',
        action: () => {
          setActiveWorkspace('repeater');
          addToast({ type: 'info', title: 'Switched to Repeater' });
        },
      },
      {
        id: 'ws-scanner',
        title: 'Switch to Active/Passive Scanner',
        category: 'Workspace',
        shortcut: 'Alt+3',
        action: () => {
          setActiveWorkspace('scanner');
          addToast({ type: 'info', title: 'Switched to Scanner' });
        },
      },
      {
        id: 'ws-fuzzer',
        title: 'Switch to Mutation Fuzzer',
        category: 'Workspace',
        shortcut: 'Alt+4',
        action: () => {
          setActiveWorkspace('fuzzer');
          addToast({ type: 'info', title: 'Switched to Mutation Fuzzer' });
        },
      },
      {
        id: 'ws-identity',
        title: 'Switch to Identity Vault & Auth Matrix',
        category: 'Workspace',
        shortcut: 'Alt+5',
        action: () => {
          setActiveWorkspace('identity');
          addToast({ type: 'info', title: 'Switched to Identity Vault' });
        },
      },
      {
        id: 'ws-apis',
        title: 'Switch to API Security & OAST Server',
        category: 'Workspace',
        shortcut: 'Alt+6',
        action: () => {
          setActiveWorkspace('apis');
          addToast({ type: 'info', title: 'Switched to API Security' });
        },
      },
      {
        id: 'ws-browser',
        title: 'Open Connected Proxy Browser',
        category: 'Proxy',
        shortcut: 'Alt+B',
        action: async () => {
          try {
            await ipcClient.launchSystemBrowser('https://www.google.com', 8085);
            addToast({ type: 'success', title: 'Proxy Browser Launched (127.0.0.1:8085)' });
          } catch {
            addToast({ type: 'info', title: 'Proxy Browser Active (127.0.0.1:8085)' });
          }
        },
      },
      {
        id: 'ws-findings',
        title: 'Switch to Findings Center',
        category: 'Workspace',
        shortcut: 'Alt+8',
        action: () => {
          setActiveWorkspace('findings');
          addToast({ type: 'info', title: 'Switched to Findings Center' });
        },
      },
      {
        id: 'ws-reports',
        title: 'Switch to Executive Reporting & Retest',
        category: 'Workspace',
        shortcut: 'Alt+9',
        action: () => {
          setActiveWorkspace('reports');
          addToast({ type: 'info', title: 'Switched to Reports' });
        },
      },
      {
        id: 'ws-settings',
        title: 'Switch to Settings & Diagnostics',
        category: 'Workspace',
        shortcut: 'Alt+0',
        action: () => {
          setActiveWorkspace('settings');
          addToast({ type: 'info', title: 'Switched to Settings' });
        },
      },
      {
        id: 'proxy-toggle',
        title: proxyRunning ? 'Stop MITM Proxy Interceptor' : 'Start MITM Proxy Interceptor (127.0.0.1:8080)',
        category: 'Proxy',
        shortcut: 'Ctrl+Shift+I',
        action: async () => {
          try {
            const nextState = await ipcClient.toggleProxy();
            setProxyRunning(nextState);
            addToast({
              type: nextState ? 'success' : 'warning',
              title: nextState ? 'Proxy Started on 127.0.0.1:8080' : 'Proxy Stopped',
            });
          } catch (err) {
            addToast({ type: 'error', title: 'Failed to toggle proxy', description: String(err) });
          }
        },
      },
      {
        id: 'theme-toggle',
        title: `Switch Theme to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        category: 'Appearance',
        shortcut: 'Ctrl+Shift+D',
        action: () => {
          toggleTheme();
          addToast({ type: 'info', title: `Theme switched to ${theme === 'dark' ? 'Light' : 'Dark'}` });
        },
      },
      {
        id: 'scope-verify',
        title: 'Test Target Scope Decision (SEC-01 Fail-Closed)',
        category: 'Scope',
        shortcut: 'Ctrl+Shift+S',
        action: async () => {
          const decision = await ipcClient.testScopeUri('https://target.local/api');
          addToast({
            type: decision.in_scope ? 'success' : 'warning',
            title: decision.in_scope ? 'Scope Decision: IN-SCOPE' : 'Scope Decision: DENIED (Fail-Closed)',
            description: decision.reason,
          });
        },
      },
    ];
  }, [setActiveWorkspace, toggleTheme, theme, proxyRunning, setProxyRunning, addToast]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return registeredCommands;
    const q = query.toLowerCase();
    return registeredCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [query, registeredCommands]);

  const handleSelect = (cmd: CommandItem) => {
    if (cmd.disabledReason) return;
    cmd.action();
    close();
  };

  const handleKeyDownInList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((selectedIndex - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  const categoryIcons: Record<string, React.ReactNode> = {
    Workspace: <Layers className="w-3.5 h-3.5 text-accent-cyan" />,
    Proxy: <Radio className="w-3.5 h-3.5 text-severity-medium" />,
    Scope: <Shield className="w-3.5 h-3.5 text-severity-low" />,
    Appearance: theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-[#ffaa00]" /> : <Moon className="w-3.5 h-3.5 text-accent-purple" />,
    Testing: <Zap className="w-3.5 h-3.5 text-accent-cyan" />,
    System: <Settings className="w-3.5 h-3.5 text-text-muted" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200" onClick={close} />

      {/* Palette Container */}
      <div className="relative w-full max-w-xl glass-panel bg-bg-panel/95 border border-border-strong rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[70vh] animate-pop-in">
        {/* Search Bar Input */}
        <div className="flex items-center px-3.5 py-3 border-b border-border-subtle bg-bg-panel-elevated/80">
          <Search className="w-4 h-4 text-accent-cyan mr-2.5 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search workspaces (e.g. Traffic, Proxy, Scope, Sequencer)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownInList}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-medium"
          />
          <Kbd className="ml-2">ESC</Kbd>
        </div>

        {/* Command List */}
        <div className="overflow-y-auto p-2 flex-1 select-none space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted italic">No matching commands found</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-100 cursor-pointer',
                    isSelected
                      ? 'bg-accent-cyan/15 text-white font-medium border border-accent-cyan/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                      : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary border border-transparent',
                    cmd.disabledReason && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex-shrink-0">{categoryIcons[cmd.category] || <Terminal className="w-3.5 h-3.5 text-text-muted" />}</span>
                    <span className="truncate text-text-primary font-medium">{cmd.title}</span>
                    {cmd.disabledReason && (
                      <span className="text-[10px] text-severity-medium italic truncate">({cmd.disabledReason})</span>
                    )}
                  </div>
                  {cmd.shortcut && <Kbd className="ml-2 flex-shrink-0">{cmd.shortcut}</Kbd>}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-border-subtle bg-bg-panel-elevated/60 text-[11px] text-text-muted select-none">
          <div className="flex items-center gap-3">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
            </span>
            <span>
              <Kbd>↵</Kbd> to select
            </span>
          </div>
          <span className="font-mono text-[10px] text-accent-cyan">Sentinel V6 Productivity</span>
        </div>
      </div>
    </div>
  );
};
