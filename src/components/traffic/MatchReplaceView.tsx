import React, { useState } from 'react';
import {
  HelpCircle,
  Settings,
  X,
} from 'lucide-react';
import {
  useMatchReplaceStore,
  HttpMatchReplaceRule,
  WsMatchReplaceRule,
  HttpMatchRuleItemType,
} from '../../stores/matchReplaceStore';
import { useToastStore } from '../../stores/toastStore';

export const MatchReplaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const {
    httpRules,
    selectedHttpRuleId,
    httpOnlyInScope,
    wsRules,
    selectedWsRuleId,
    wsOnlyInScope,
    addHttpRule,
    updateHttpRule,
    removeHttpRule,
    toggleHttpRule,
    moveHttpRule,
    selectHttpRule,
    setHttpOnlyInScope,
    addWsRule,
    updateWsRule,
    removeWsRule,
    toggleWsRule,
    moveWsRule,
    selectWsRule,
    setWsOnlyInScope,
  } = useMatchReplaceStore();

  // HTTP Modal state
  const [httpModalOpen, setHttpModalOpen] = useState(false);
  const [editingHttpId, setEditingHttpId] = useState<string | null>(null);
  const [httpForm, setHttpForm] = useState<Omit<HttpMatchReplaceRule, 'id'>>({
    enabled: true,
    item: 'Request header',
    name: '',
    match: '',
    replace: '',
    type: 'Regex',
    comment: '',
  });

  // WS Modal state
  const [wsModalOpen, setWsModalOpen] = useState(false);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [wsForm, setWsForm] = useState<Omit<WsMatchReplaceRule, 'id'>>({
    enabled: true,
    direction: 'To server',
    match: '',
    replace: '',
    type: 'Regex',
    comment: '',
  });

  const handleOpenAddHttp = () => {
    setEditingHttpId(null);
    setHttpForm({
      enabled: true,
      item: 'Request header',
      name: '',
      match: '',
      replace: '',
      type: 'Regex',
      comment: '',
    });
    setHttpModalOpen(true);
  };

  const handleOpenEditHttp = () => {
    const selected = httpRules.find((r) => r.id === selectedHttpRuleId);
    if (!selected) return;
    setEditingHttpId(selected.id);
    setHttpForm({
      enabled: selected.enabled,
      item: selected.item,
      name: selected.name,
      match: selected.match,
      replace: selected.replace,
      type: selected.type,
      comment: selected.comment,
    });
    setHttpModalOpen(true);
  };

  const handleSaveHttp = () => {
    if (!httpForm.match.trim() && !httpForm.comment.trim()) {
      addToast({ type: 'warning', title: 'Match pattern cannot be empty' });
      return;
    }
    if (editingHttpId) {
      updateHttpRule(editingHttpId, httpForm);
      addToast({ type: 'success', title: 'HTTP rule updated' });
    } else {
      addHttpRule(httpForm);
      addToast({ type: 'success', title: 'HTTP rule added' });
    }
    setHttpModalOpen(false);
  };

  const handleOpenAddWs = () => {
    setEditingWsId(null);
    setWsForm({
      enabled: true,
      direction: 'To server',
      match: '',
      replace: '',
      type: 'Regex',
      comment: '',
    });
    setWsModalOpen(true);
  };

  const handleOpenEditWs = () => {
    const selected = wsRules.find((r) => r.id === selectedWsRuleId);
    if (!selected) return;
    setEditingWsId(selected.id);
    setWsForm({
      enabled: selected.enabled,
      direction: selected.direction,
      match: selected.match,
      replace: selected.replace,
      type: selected.type,
      comment: selected.comment,
    });
    setWsModalOpen(true);
  };

  const handleSaveWs = () => {
    if (!wsForm.match.trim() && !wsForm.comment.trim()) {
      addToast({ type: 'warning', title: 'Match pattern cannot be empty' });
      return;
    }
    if (editingWsId) {
      updateWsRule(editingWsId, wsForm);
      addToast({ type: 'success', title: 'WebSocket rule updated' });
    } else {
      addWsRule(wsForm);
      addToast({ type: 'success', title: 'WebSocket rule added' });
    }
    setWsModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1f22] text-[#dfdfdf] font-sans text-xs p-4 overflow-y-auto space-y-6">
      {/* 1. HTTP Match and Replace Section */}
      <div className="space-y-3">
        {/* Header with Help & Settings icons */}
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#9da5b4] cursor-pointer hover:text-white" />
          <Settings className="w-4 h-4 text-[#9da5b4] cursor-pointer hover:text-white" />
          <h2 className="text-sm font-bold text-white tracking-wide">HTTP match and replace rules</h2>
        </div>

        <p className="text-xs text-[#9da5b4]">
          Use these settings to automatically replace parts of HTTP requests and responses passing through the Proxy.
        </p>

        {/* Checkbox: Only apply to in-scope items */}
        <label className="flex items-center gap-2 text-xs text-[#c4c7c5] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={httpOnlyInScope}
            onChange={(e) => setHttpOnlyInScope(e.target.checked)}
            className="rounded border-[#3e4249] bg-[#141517] text-[#f37021] focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span>Only apply to in-scope items</span>
        </label>

        {/* Rules Table & Vertical Action Buttons */}
        <div className="flex gap-2">
          {/* Left Action Buttons */}
          <div className="flex flex-col gap-1 w-20 flex-shrink-0">
            <button
              onClick={handleOpenAddHttp}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors"
            >
              Add
            </button>
            <button
              onClick={handleOpenEditHttp}
              disabled={!selectedHttpRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (selectedHttpRuleId) {
                  removeHttpRule(selectedHttpRuleId);
                  addToast({ type: 'info', title: 'HTTP rule removed' });
                }
              }}
              disabled={!selectedHttpRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#ef4444] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
            <button
              onClick={() => selectedHttpRuleId && moveHttpRule(selectedHttpRuleId, 'up')}
              disabled={!selectedHttpRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Up
            </button>
            <button
              onClick={() => selectedHttpRuleId && moveHttpRule(selectedHttpRuleId, 'down')}
              disabled={!selectedHttpRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Down
            </button>
          </div>

          {/* HTTP Rules Table */}
          <div className="flex-1 bg-[#141517] border border-[#313438] rounded overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#313438] select-none">
                  <tr>
                    <th className="px-3 py-1.5 w-16 text-center">Enabled</th>
                    <th className="px-2.5 py-1.5 w-32">Item</th>
                    <th className="px-2.5 py-1.5 w-24">Name</th>
                    <th className="px-2.5 py-1.5 w-44">Match</th>
                    <th className="px-2.5 py-1.5">Replace</th>
                    <th className="px-2.5 py-1.5 w-16">Type</th>
                    <th className="px-3 py-1.5 w-52">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232529]">
                  {httpRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-[#6f737a] font-sans">
                        No HTTP match and replace rules configured. Click "Add" to create one.
                      </td>
                    </tr>
                  ) : (
                    httpRules.map((rule) => {
                      const isSelected = rule.id === selectedHttpRuleId;
                      return (
                        <tr
                          key={rule.id}
                          onClick={() => selectHttpRule(rule.id)}
                          onDoubleClick={handleOpenEditHttp}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#282b30] text-white font-medium'
                              : 'hover:bg-[#1a1b1e] text-[#c4c7c5]'
                          }`}
                        >
                          <td
                            className="px-3 py-1 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHttpRule(rule.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={() => toggleHttpRule(rule.id)}
                              className="rounded border-[#3e4249] bg-[#1e1f22] text-[#f37021] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-2.5 py-1 text-[#38bdf8] truncate">{rule.item}</td>
                          <td className="px-2.5 py-1 text-[#9da5b4] truncate">{rule.name}</td>
                          <td className="px-2.5 py-1 text-[#f37021] truncate font-mono" title={rule.match}>
                            {rule.match}
                          </td>
                          <td className="px-2.5 py-1 truncate text-[#34d399] font-mono select-text" title={rule.replace}>
                            {rule.replace}
                          </td>
                          <td className="px-2.5 py-1 text-[#9da5b4]">{rule.type}</td>
                          <td className="px-3 py-1 text-[#dfdfdf] truncate font-sans">{rule.comment}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#2b2d30] pt-4" />

      {/* 2. WebSocket Match and Replace Section */}
      <div className="space-y-3">
        {/* Header with Help & Settings icons */}
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#9da5b4] cursor-pointer hover:text-white" />
          <Settings className="w-4 h-4 text-[#9da5b4] cursor-pointer hover:text-white" />
          <h2 className="text-sm font-bold text-white tracking-wide">WebSocket match and replace rules</h2>
        </div>

        <p className="text-xs text-[#9da5b4]">
          Use these settings to automatically replace parts of WebSocket messages passing through the Proxy.
        </p>

        {/* Checkbox: Only apply to in-scope items */}
        <label className="flex items-center gap-2 text-xs text-[#c4c7c5] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={wsOnlyInScope}
            onChange={(e) => setWsOnlyInScope(e.target.checked)}
            className="rounded border-[#3e4249] bg-[#141517] text-[#f37021] focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span>Only apply to in-scope items</span>
        </label>

        {/* Rules Table & Vertical Action Buttons */}
        <div className="flex gap-2">
          {/* Left Action Buttons */}
          <div className="flex flex-col gap-1 w-20 flex-shrink-0">
            <button
              onClick={handleOpenAddWs}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors"
            >
              Add
            </button>
            <button
              onClick={handleOpenEditWs}
              disabled={!selectedWsRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (selectedWsRuleId) {
                  removeWsRule(selectedWsRuleId);
                  addToast({ type: 'info', title: 'WebSocket rule removed' });
                }
              }}
              disabled={!selectedWsRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#ef4444] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
            <button
              onClick={() => selectedWsRuleId && moveWsRule(selectedWsRuleId, 'up')}
              disabled={!selectedWsRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Up
            </button>
            <button
              onClick={() => selectedWsRuleId && moveWsRule(selectedWsRuleId, 'down')}
              disabled={!selectedWsRuleId}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] border border-[#3e4249] rounded font-medium text-xs text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Down
            </button>
          </div>

          {/* WebSocket Rules Table */}
          <div className="flex-1 bg-[#141517] border border-[#313438] rounded overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#313438] select-none">
                  <tr>
                    <th className="px-3 py-1.5 w-16 text-center">Enabled</th>
                    <th className="px-2.5 py-1.5 w-28">Direction</th>
                    <th className="px-2.5 py-1.5 w-44">Match</th>
                    <th className="px-2.5 py-1.5">Replace</th>
                    <th className="px-2.5 py-1.5 w-16">Type</th>
                    <th className="px-3 py-1.5 w-52">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232529]">
                  {wsRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-[#6f737a] font-sans">
                        No WebSocket match and replace rules configured. Click "Add" to create one.
                      </td>
                    </tr>
                  ) : (
                    wsRules.map((rule) => {
                      const isSelected = rule.id === selectedWsRuleId;
                      return (
                        <tr
                          key={rule.id}
                          onClick={() => selectWsRule(rule.id)}
                          onDoubleClick={handleOpenEditWs}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#282b30] text-white font-medium'
                              : 'hover:bg-[#1a1b1e] text-[#c4c7c5]'
                          }`}
                        >
                          <td
                            className="px-3 py-1 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWsRule(rule.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={() => toggleWsRule(rule.id)}
                              className="rounded border-[#3e4249] bg-[#1e1f22] text-[#f37021] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-2.5 py-1 text-[#38bdf8] truncate">{rule.direction}</td>
                          <td className="px-2.5 py-1 text-[#f37021] truncate font-mono" title={rule.match}>
                            {rule.match}
                          </td>
                          <td className="px-2.5 py-1 truncate text-[#34d399] font-mono select-text" title={rule.replace}>
                            {rule.replace}
                          </td>
                          <td className="px-2.5 py-1 text-[#9da5b4]">{rule.type}</td>
                          <td className="px-3 py-1 text-[#dfdfdf] truncate font-sans">{rule.comment}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog: Add / Edit HTTP Match Rule */}
      {httpModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-lg shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#313438] pb-2">
              <span className="font-bold text-white text-sm">
                {editingHttpId ? 'Edit HTTP Match and Replace Rule' : 'Add HTTP Match and Replace Rule'}
              </span>
              <button onClick={() => setHttpModalOpen(false)} className="text-[#9da5b4] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9da5b4] block mb-1">Rule Item Target</label>
                <select
                  value={httpForm.item}
                  onChange={(e) => setHttpForm({ ...httpForm, item: e.target.value as HttpMatchRuleItemType })}
                  className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
                >
                  <option value="Request header">Request header</option>
                  <option value="Request body">Request body</option>
                  <option value="Request first line">Request first line</option>
                  <option value="Response header">Response header</option>
                  <option value="Response body">Response body</option>
                  <option value="Response first line">Response first line</option>
                  <option value="Request param name">Request param name</option>
                  <option value="Request param value">Request param value</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[#9da5b4] block mb-1">Matching Type</label>
                <select
                  value={httpForm.type}
                  onChange={(e) => setHttpForm({ ...httpForm, type: e.target.value as 'Regex' | 'Literal' })}
                  className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
                >
                  <option value="Regex">Regex</option>
                  <option value="Literal">Literal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#9da5b4] block mb-1">Match Pattern / Regex</label>
              <input
                type="text"
                value={httpForm.match}
                onChange={(e) => setHttpForm({ ...httpForm, match: e.target.value })}
                placeholder="e.g. ^User-Agent.*$"
                className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-[#9da5b4] block mb-1">Replacement Text</label>
              <input
                type="text"
                value={httpForm.replace}
                onChange={(e) => setHttpForm({ ...httpForm, replace: e.target.value })}
                placeholder="e.g. User-Agent: CustomAgent/1.0"
                className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-[#9da5b4] block mb-1">Comment / Rule Description</label>
              <input
                type="text"
                value={httpForm.comment}
                onChange={(e) => setHttpForm({ ...httpForm, comment: e.target.value })}
                placeholder="e.g. Emulate Custom Browser"
                className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#c4c7c5] cursor-pointer">
              <input
                type="checkbox"
                checked={httpForm.enabled}
                onChange={(e) => setHttpForm({ ...httpForm, enabled: e.target.checked })}
                className="rounded border-[#3e4249] bg-[#141517] text-[#f37021] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Rule enabled</span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#313438]">
              <button
                onClick={() => setHttpModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#2b2d30] text-[#9da5b4] hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHttp}
                className="px-4 py-1.5 rounded bg-[#f37021] hover:bg-[#e05d06] text-white text-xs font-bold transition-colors"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Add / Edit WebSocket Match Rule */}
      {wsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-lg shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#313438] pb-2">
              <span className="font-bold text-white text-sm">
                {editingWsId ? 'Edit WebSocket Match and Replace Rule' : 'Add WebSocket Match and Replace Rule'}
              </span>
              <button onClick={() => setWsModalOpen(false)} className="text-[#9da5b4] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9da5b4] block mb-1">Direction</label>
                <select
                  value={wsForm.direction}
                  onChange={(e) =>
                    setWsForm({ ...wsForm, direction: e.target.value as 'To server' | 'To client' | 'Both' })
                  }
                  className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
                >
                  <option value="To server">To server</option>
                  <option value="To client">To client</option>
                  <option value="Both">Both directions</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[#9da5b4] block mb-1">Matching Type</label>
                <select
                  value={wsForm.type}
                  onChange={(e) => setWsForm({ ...wsForm, type: e.target.value as 'Regex' | 'Literal' })}
                  className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
                >
                  <option value="Regex">Regex</option>
                  <option value="Literal">Literal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#9da5b4] block mb-1">Match Pattern / Regex</label>
              <input
                type="text"
                value={wsForm.match}
                onChange={(e) => setWsForm({ ...wsForm, match: e.target.value })}
                placeholder="e.g. PING"
                className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-[#9da5b4] block mb-1">Replacement Text</label>
              <input
                type="text"
                value={wsForm.replace}
                onChange={(e) => setWsForm({ ...wsForm, replace: e.target.value })}
                placeholder="e.g. PING_MODIFIED"
                className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-[#9da5b4] block mb-1">Comment / Rule Description</label>
              <input
                type="text"
                value={wsForm.comment}
                onChange={(e) => setWsForm({ ...wsForm, comment: e.target.value })}
                placeholder="e.g. Modify Ping Payload"
                className="w-full bg-[#141517] text-white text-xs p-2 rounded border border-[#3e4249] focus:border-[#f37021] focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#c4c7c5] cursor-pointer">
              <input
                type="checkbox"
                checked={wsForm.enabled}
                onChange={(e) => setWsForm({ ...wsForm, enabled: e.target.checked })}
                className="rounded border-[#3e4249] bg-[#141517] text-[#f37021] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Rule enabled</span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#313438]">
              <button
                onClick={() => setWsModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#2b2d30] text-[#9da5b4] hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWs}
                className="px-4 py-1.5 rounded bg-[#f37021] hover:bg-[#e05d06] text-white text-xs font-bold transition-colors"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
