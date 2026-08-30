import React, { useState } from 'react';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Select } from '../../design-system/Select';
import { Tabs, TabItem } from '../../design-system/Tabs';
import { Badge } from '../../design-system/Badge';
import { extractJsonPath, extractHeaderValue } from '../../utils/repeaterUtils';
import { useToastStore } from '../../stores/toastStore';
import {
  Sliders,
  Plus,
  Trash2,
  Wand2,
  Check,
  HelpCircle,
  Copy,
} from 'lucide-react';

export const RepeaterVariablesModal: React.FC = () => {
  const {
    tabs,
    activeTabId,
    globalVariables,
    isVariablesModalOpen,
    setVariablesModalOpen,
    setGlobalVariable,
    removeGlobalVariable,
    setLocalVariable,
    removeLocalVariable,
  } = useRepeaterStore();

  const { addToast } = useToastStore();
  const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const [activeTab, setActiveTab] = useState<'variables' | 'wizard'>('variables');

  // New variable local inputs
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newScope, setNewScope] = useState<'global' | 'tab'>('tab');

  // Extraction wizard inputs
  const [extractSourceType, setExtractSourceType] = useState<'json' | 'header'>('json');
  const [extractSourceText, setExtractSourceText] = useState(
    tab?.lastExecutionOutput?.responseBody || '{\n  "auth": {\n    "token": "sample-jwt-token-12345"\n  }\n}'
  );
  const [extractExpr, setExtractExpr] = useState('auth.token');
  const [extractTargetVar, setExtractTargetVar] = useState('auth_token');
  const [extractScope, setExtractScope] = useState<'global' | 'tab'>('tab');

  if (!isVariablesModalOpen) return null;

  const localVariables = tab?.localVariables || {};

  const handleAddVariable = () => {
    if (!newKey.trim()) return;
    const cleanKey = newKey.trim().replace(/^\{\{|\}\}$/g, '');
    if (newScope === 'global') {
      setGlobalVariable(cleanKey, newValue);
    } else if (tab) {
      setLocalVariable(tab.id, cleanKey, newValue);
    }
    setNewKey('');
    setNewValue('');
    addToast({ type: 'success', title: `Saved variable {{${cleanKey}}}` });
  };

  // Compute extraction preview
  let extractionResult: string | null = null;
  if (extractSourceType === 'json') {
    extractionResult = extractJsonPath(extractSourceText, extractExpr);
  } else {
    extractionResult = extractHeaderValue(extractSourceText, extractExpr);
  }

  const handleSaveExtractedVariable = () => {
    if (!extractTargetVar.trim() || extractionResult === null) return;
    const cleanKey = extractTargetVar.trim().replace(/^\{\{|\}\}$/g, '');
    if (extractScope === 'global') {
      setGlobalVariable(cleanKey, extractionResult);
    } else if (tab) {
      setLocalVariable(tab.id, cleanKey, extractionResult);
    }
    addToast({ type: 'success', title: `Extracted & saved {{${cleanKey}}} = "${extractionResult.substring(0, 30)}..."` });
    setActiveTab('variables');
  };

  const modalTabs: TabItem[] = [
    { id: 'variables', label: 'Variables Workbench', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'wizard', label: 'Token Extractor Wizard', icon: <Wand2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <Modal
      isOpen={isVariablesModalOpen}
      onClose={() => setVariablesModalOpen(false)}
      title="Dynamic Variables & Token Extraction (Ctrl+Alt+V)"
      size="lg"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="border-b border-border-subtle">
          <Tabs tabs={modalTabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />
        </div>

        {/* 1. VARIABLES WORKBENCH */}
        {activeTab === 'variables' && (
          <div className="space-y-4">
            {/* Quick Add Row */}
            <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg space-y-2">
              <span className="text-xs font-semibold text-text-primary">Add / Update Variable</span>
              <div className="flex items-center gap-2">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="variable_name (e.g. token)"
                  className="font-mono text-xs flex-1"
                />
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="value (e.g. secret123)"
                  className="font-mono text-xs flex-1"
                />
                <Select
                  options={[
                    { label: 'Tab Scope', value: 'tab' },
                    { label: 'Global Scope', value: 'global' },
                  ]}
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as 'global' | 'tab')}
                  className="w-32 text-xs font-mono"
                />
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleAddVariable}
                  disabled={!newKey.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Active Variables Table */}
            <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-panel">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-panel-elevated text-text-muted">
                    <th className="py-2 px-3 w-40">Variable Key</th>
                    <th className="py-2 px-3">Current Value</th>
                    <th className="py-2 px-3 w-28 text-center">Scope</th>
                    <th className="py-2 px-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Local Tab Variables */}
                  {Object.entries(localVariables).map(([k, v]) => (
                    <tr key={`tab-${k}`} className="border-b border-border-subtle/50 hover:bg-bg-canvas/30 group">
                      <td className="py-1.5 px-3 font-bold text-accent-cyan select-all">{`{{${k}}}`}</td>
                      <td className="py-1.5 px-3 text-text-primary select-all break-all">{v}</td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="info" size="xs">
                          Tab: {tab?.title}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          onClick={() => removeLocalVariable(tab.id, k)}
                          className="p-1 rounded text-text-muted hover:text-red-400 opacity-60 group-hover:opacity-100"
                          title="Delete tab variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Global Variables */}
                  {Object.entries(globalVariables).map(([k, v]) => (
                    <tr key={`glob-${k}`} className="border-b border-border-subtle/50 hover:bg-bg-canvas/30 group">
                      <td className="py-1.5 px-3 font-bold text-accent-amber select-all">{`{{${k}}}`}</td>
                      <td className="py-1.5 px-3 text-text-primary select-all break-all">{v}</td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="warning" size="xs">
                          Global
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          onClick={() => removeGlobalVariable(k)}
                          className="p-1 rounded text-text-muted hover:text-red-400 opacity-60 group-hover:opacity-100"
                          title="Delete global variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {Object.keys(localVariables).length === 0 && Object.keys(globalVariables).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted text-xs">
                        No variables defined yet. Add one above or use the Token Extractor Wizard.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Built-in Dynamic Variables Cheatsheet */}
            <div className="p-3 bg-bg-canvas border border-border-subtle rounded-lg text-xs font-mono space-y-1.5">
              <span className="font-semibold text-text-muted flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Built-in Dynamic Generators (Ready to use in templates)</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                <div className="p-1.5 bg-bg-panel rounded border border-border-subtle">
                  <span className="text-accent-amber font-bold">{`{{$uuid}}`}</span>
                  <p className="text-text-muted text-[10px]">Random UUIDv4</p>
                </div>
                <div className="p-1.5 bg-bg-panel rounded border border-border-subtle">
                  <span className="text-accent-amber font-bold">{`{{$timestamp}}`}</span>
                  <p className="text-text-muted text-[10px]">Epoch timestamp (s)</p>
                </div>
                <div className="p-1.5 bg-bg-panel rounded border border-border-subtle">
                  <span className="text-accent-amber font-bold">{`{{$random_int}}`}</span>
                  <p className="text-text-muted text-[10px]">Random 1000..9999</p>
                </div>
                <div className="p-1.5 bg-bg-panel rounded border border-border-subtle">
                  <span className="text-accent-amber font-bold">{`{{$random_str}}`}</span>
                  <p className="text-text-muted text-[10px]">Random 6-char hex</p>
                </div>
                <div className="p-1.5 bg-bg-panel rounded border border-border-subtle">
                  <span className="text-accent-amber font-bold">{`{{$iso_date}}`}</span>
                  <p className="text-text-muted text-[10px]">ISO 8601 UTC string</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TOKEN EXTRACTOR WIZARD */}
        {activeTab === 'wizard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Source selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted">Extraction Source Type</label>
                <Select
                  options={[
                    { label: 'JSON Response Payload', value: 'json' },
                    { label: 'HTTP Response Header', value: 'header' },
                  ]}
                  value={extractSourceType}
                  onChange={(e) => setExtractSourceType(e.target.value as 'json' | 'header')}
                  className="w-full text-xs font-mono"
                />
              </div>

              {/* Expression */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted">
                  {extractSourceType === 'json' ? 'JSON-Path (e.g. auth.token)' : 'Header Name (e.g. Set-Cookie)'}
                </label>
                <Input
                  value={extractExpr}
                  onChange={(e) => setExtractExpr(e.target.value)}
                  placeholder={extractSourceType === 'json' ? 'data.user.jwt' : 'Authorization'}
                  className="font-mono text-xs w-full"
                />
              </div>
            </div>

            {/* Source Raw Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-muted">Source Response Text</label>
                <button
                  onClick={() => {
                    const text =
                      extractSourceType === 'json'
                        ? tab?.lastExecutionOutput?.responseBody || ''
                        : (tab?.lastExecutionOutput?.responseHeaders || []).map((h) => `${h.name}: ${h.value}`).join('\n');
                    setExtractSourceText(text);
                  }}
                  className="text-[11px] text-accent-cyan hover:underline font-mono"
                >
                  Load from Current Tab Response
                </button>
              </div>
              <textarea
                value={extractSourceText}
                onChange={(e) => setExtractSourceText(e.target.value)}
                rows={5}
                className="w-full bg-bg-panel border border-border-subtle rounded p-2 text-xs font-mono text-text-primary resize-none outline-none focus:border-accent-cyan"
              />
            </div>

            {/* Live Extraction Preview */}
            <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg space-y-2">
              <span className="text-xs font-semibold text-text-muted">Extracted Output Preview</span>
              {extractionResult !== null ? (
                <div className="flex items-center justify-between p-2 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 font-mono text-xs break-all">
                  <span>{extractionResult}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(extractionResult || '')}
                    className="p-1 text-emerald-400 hover:text-emerald-200"
                    title="Copy value"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-2 bg-amber-950/30 border border-amber-800/50 rounded text-amber-300 font-mono text-xs">
                  Path not found in source text
                </div>
              )}
            </div>

            {/* Target variable binding */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-text-muted">Save to Variable Name</label>
                <Input
                  value={extractTargetVar}
                  onChange={(e) => setExtractTargetVar(e.target.value)}
                  placeholder="auth_token"
                  className="font-mono text-xs w-full"
                />
              </div>

              <div className="w-36 space-y-1">
                <label className="text-xs text-text-muted">Target Scope</label>
                <Select
                  options={[
                    { label: 'Tab Scope', value: 'tab' },
                    { label: 'Global Scope', value: 'global' },
                  ]}
                  value={extractScope}
                  onChange={(e) => setExtractScope(e.target.value as 'global' | 'tab')}
                  className="w-full text-xs font-mono"
                />
              </div>

              <div className="pt-5">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Check className="w-4 h-4" />}
                  onClick={handleSaveExtractedVariable}
                  disabled={extractionResult === null || !extractTargetVar.trim()}
                >
                  Save Variable
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
