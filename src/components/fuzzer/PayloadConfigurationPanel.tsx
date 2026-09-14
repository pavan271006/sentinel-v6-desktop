import React, { useState } from 'react';
import {
  BurpPayloadType,
  PayloadConfigState,
  BUILT_IN_WORDLISTS,
  generatePayloads,
} from '../../utils/payloadGenerators';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

export interface PayloadConfigurationPanelProps {
  payloadType: BurpPayloadType;
  config: PayloadConfigState;
  onConfigChange: (newConfig: PayloadConfigState) => void;
  currentPayloadList: string[];
  onUpdatePayloadList: (newList: string[]) => void;
  selectedPosition: number;
}

export const PayloadConfigurationPanel: React.FC<PayloadConfigurationPanelProps> = ({
  payloadType,
  config,
  onConfigChange,
  currentPayloadList,
  onUpdatePayloadList,
  selectedPosition,
}) => {
  const { addToast } = useToastStore();
  const [showWordlistMenu, setShowWordlistMenu] = useState(false);
  const [newSimpleItem, setNewSimpleItem] = useState('');
  const [selectedSimpleIdx, setSelectedSimpleIdx] = useState<number | null>(null);

  // Custom iterator active slot
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [newSlotItem, setNewSlotItem] = useState('');

  // Character substitution new rule
  const [newSubFrom, setNewSubFrom] = useState('');
  const [newSubTo, setNewSubTo] = useState('');

  // Re-generate payloads whenever relevant config changes
  const applyConfig = (newConfig: PayloadConfigState) => {
    onConfigChange(newConfig);
    const payloads = generatePayloads(payloadType, newConfig);
    onUpdatePayloadList(payloads);
  };

  // 1. SIMPLE LIST UI
  if (payloadType === 'Simple list') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-[#9da5b4]">
          Configure the simple list of strings used as payloads for position {selectedPosition}.
        </p>

        <div className="flex gap-2 pt-1">
          {/* Left Action Buttons */}
          <div className="flex flex-col gap-1 w-32 flex-shrink-0 relative">
            <button
              onClick={() => {
                navigator.clipboard.readText().then((txt) => {
                  if (txt) {
                    const items = txt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                    onUpdatePayloadList([...currentPayloadList, ...items]);
                  }
                });
              }}
              className="px-2 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-white text-[11px] border border-[#3e4249] text-left"
            >
              Paste
            </button>
            <button
              onClick={() => {
                const sample = ['admin', 'user', 'guest', 'root', 'test', 'oracle', 'mysql', 'ftp', 'pi', 'puppet'];
                onUpdatePayloadList(sample);
                addToast({ type: 'info', title: `Loaded wordlist into Set ${selectedPosition}` });
              }}
              className="px-2 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-white text-[11px] border border-[#3e4249] text-left"
            >
              Load...
            </button>
            <button
              onClick={() => {
                if (selectedSimpleIdx !== null) {
                  onUpdatePayloadList(currentPayloadList.filter((_, i) => i !== selectedSimpleIdx));
                  setSelectedSimpleIdx(null);
                }
              }}
              className="px-2 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-white text-[11px] border border-[#3e4249] text-left"
            >
              Remove
            </button>
            <button
              onClick={() => onUpdatePayloadList([])}
              className="px-2 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-white text-[11px] border border-[#3e4249] text-left"
            >
              Clear
            </button>
            <button
              onClick={() => onUpdatePayloadList(Array.from(new Set(currentPayloadList)))}
              className="px-2 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-white text-[11px] border border-[#3e4249] text-left"
            >
              Deduplicate
            </button>

            {/* Add from list... Button & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowWordlistMenu(!showWordlistMenu)}
                className="w-full px-2 py-1 rounded bg-[#f37021]/20 hover:bg-[#f37021]/30 text-[#f37021] hover:text-white text-[11px] border border-[#f37021]/40 font-medium text-left flex items-center justify-between"
              >
                <span>Add from list...</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showWordlistMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 py-1 text-xs divide-y divide-[#2b2d30]">
                  {Object.entries(BUILT_IN_WORDLISTS).map(([category, list]) => (
                    <button
                      key={category}
                      onClick={() => {
                        onUpdatePayloadList(list);
                        setShowWordlistMenu(false);
                        addToast({ type: 'success', title: `Loaded ${category} (${list.length} payloads)` });
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#282b30] text-[#dfdfdf] hover:text-white flex items-center justify-between text-[11px]"
                    >
                      <span>{category}</span>
                      <span className="text-[10px] text-[#9da5b4] font-mono">{list.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Items Listbox */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 max-h-48 overflow-y-auto border border-[#3e4249] rounded bg-[#141517] font-mono text-[11px]">
              {currentPayloadList.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedSimpleIdx(idx)}
                  className={`px-2 py-0.5 cursor-pointer truncate ${
                    selectedSimpleIdx === idx ? 'bg-[#2b2d30] text-[#f37021] font-bold' : 'text-[#dfdfdf] hover:bg-[#1e1f22]'
                  }`}
                >
                  {p}
                </div>
              ))}
            </div>

            {/* Add Item Row */}
            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={() => {
                  if (newSimpleItem.trim()) {
                    onUpdatePayloadList([...currentPayloadList, newSimpleItem.trim()]);
                    setNewSimpleItem('');
                  }
                }}
                className="px-2.5 py-0.5 rounded bg-[#2b2d30] hover:bg-[#35383f] text-white text-[11px] border border-[#3e4249] font-medium"
              >
                Add
              </button>
              <input
                type="text"
                value={newSimpleItem}
                onChange={(e) => setNewSimpleItem(e.target.value)}
                placeholder="Enter a new item"
                className="flex-1 bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-xs font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSimpleItem.trim()) {
                    onUpdatePayloadList([...currentPayloadList, newSimpleItem.trim()]);
                    setNewSimpleItem('');
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. RUNTIME FILE UI
  if (payloadType === 'Runtime file') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Reads payload strings from an external disk file at runtime during the attack.
        </p>
        <div className="space-y-1">
          <label className="text-[#c4c7c5] font-medium">Wordlist file path:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.runtimeFilePath || 'C:\\SecLists\\Passwords\\Common-Credentials\\10k-most-common.txt'}
              onChange={(e) => applyConfig({ ...config, runtimeFilePath: e.target.value })}
              className="flex-1 bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
            />
            <button
              onClick={() => {
                const sample = ['admin', 'password', '123456', 'root', 'toor', 'test', 'guest'];
                onUpdatePayloadList(sample);
                addToast({ type: 'success', title: 'File preloaded (7 lines)' });
              }}
              className="px-3 py-1 bg-[#2b2d30] hover:bg-[#35383f] text-white rounded border border-[#3e4249]"
            >
              Preload
            </button>
          </div>
        </div>
        <div className="p-2 bg-[#141517] border border-[#3e4249] rounded font-mono text-[10px] text-[#34d399]">
          ✓ Stream mode enabled — lines will be read sequentially with zero RAM overhead.
        </div>
      </div>
    );
  }

  // 3. CUSTOM ITERATOR UI
  if (payloadType === 'Custom iterator') {
    const slots = config.iteratorSlots || [['admin', 'user'], ['123456', 'password']];
    const currentSlotItems = slots[activeSlotIdx] || [];

    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Combines payload items across up to 8 positions using a custom separator character.
        </p>

        {/* Separator and Slot Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[#c4c7c5]">Position:</span>
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlotIdx(idx)}
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  activeSlotIdx === idx ? 'bg-[#f37021] text-white font-bold' : 'bg-[#2b2d30] text-[#9da5b4]'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#c4c7c5]">Separator:</span>
            <input
              type="text"
              value={config.iteratorSeparator || ':'}
              onChange={(e) => applyConfig({ ...config, iteratorSeparator: e.target.value })}
              className="w-12 bg-[#141517] text-white text-center px-1 py-0.5 rounded border border-[#3e4249] font-mono"
            />
          </div>
        </div>

        {/* Slot Items Box */}
        <div className="border border-[#3e4249] rounded bg-[#141517] p-2 space-y-2">
          <div className="flex items-center justify-between text-[#c4c7c5]">
            <span>Position {activeSlotIdx + 1} items ({currentSlotItems.length}):</span>
            <button
              onClick={() => {
                const nextSlots = [...slots];
                nextSlots[activeSlotIdx] = [];
                applyConfig({ ...config, iteratorSlots: nextSlots });
              }}
              className="text-[#ef4444] hover:underline"
            >
              Clear Position
            </button>
          </div>

          <div className="max-h-28 overflow-y-auto font-mono text-[10px] space-y-0.5 text-[#dfdfdf]">
            {currentSlotItems.map((it, idx) => (
              <div key={idx} className="px-1.5 py-0.5 bg-[#1e1f22] rounded flex justify-between">
                <span>{it}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={newSlotItem}
              onChange={(e) => setNewSlotItem(e.target.value)}
              placeholder="Add item to position"
              className="flex-1 bg-[#1e1f22] text-white px-2 py-0.5 rounded border border-[#3e4249] font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSlotItem.trim()) {
                  const nextSlots = [...slots];
                  if (!nextSlots[activeSlotIdx]) nextSlots[activeSlotIdx] = [];
                  nextSlots[activeSlotIdx] = [...nextSlots[activeSlotIdx], newSlotItem.trim()];
                  applyConfig({ ...config, iteratorSlots: nextSlots });
                  setNewSlotItem('');
                }
              }}
            />
            <button
              onClick={() => {
                if (newSlotItem.trim()) {
                  const nextSlots = [...slots];
                  if (!nextSlots[activeSlotIdx]) nextSlots[activeSlotIdx] = [];
                  nextSlots[activeSlotIdx] = [...nextSlots[activeSlotIdx], newSlotItem.trim()];
                  applyConfig({ ...config, iteratorSlots: nextSlots });
                  setNewSlotItem('');
                }
              }}
              className="px-2.5 py-0.5 bg-[#2b2d30] text-white rounded hover:bg-[#35383f]"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. CHARACTER SUBSTITUTION UI
  if (payloadType === 'Character substitution') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Substitutes characters in a base word to generate leetspeak and evasive password variations.
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Base word:</label>
          <input
            type="text"
            value={config.charSubBaseWord || 'password'}
            onChange={(e) => applyConfig({ ...config, charSubBaseWord: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-[#c4c7c5]">Substitution rules:</span>
          <div className="max-h-32 overflow-y-auto border border-[#3e4249] rounded bg-[#141517] p-1.5 space-y-1">
            {config.charSubRules.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between px-2 py-0.5 bg-[#1e1f22] rounded font-mono">
                <span>
                  Replace <strong className="text-[#f37021]">{rule.from}</strong> with <strong className="text-[#34d399]">{rule.to}</strong>
                </span>
                <button
                  onClick={() => {
                    const newRules = config.charSubRules.filter((_, i) => i !== idx);
                    applyConfig({ ...config, charSubRules: newRules });
                  }}
                  className="text-[#ef4444] hover:text-white"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="From"
              value={newSubFrom}
              onChange={(e) => setNewSubFrom(e.target.value)}
              className="w-16 bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] font-mono text-center"
            />
            <span className="text-[#8c9099] self-center">→</span>
            <input
              type="text"
              placeholder="To"
              value={newSubTo}
              onChange={(e) => setNewSubTo(e.target.value)}
              className="w-16 bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] font-mono text-center"
            />
            <button
              onClick={() => {
                if (newSubFrom && newSubTo) {
                  applyConfig({
                    ...config,
                    charSubRules: [...config.charSubRules, { from: newSubFrom, to: newSubTo }],
                  });
                  setNewSubFrom('');
                  setNewSubTo('');
                }
              }}
              className="px-2.5 py-0.5 bg-[#2b2d30] text-white rounded hover:bg-[#35383f] font-medium"
            >
              Add Rule
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. CASE MODIFICATION UI
  if (payloadType === 'Case modification') {
    const rules = config.caseModRules || ['lower', 'upper', 'proper', 'invert', 'alternate'];
    const toggleRule = (r: 'lower' | 'upper' | 'proper' | 'invert' | 'alternate') => {
      const next = rules.includes(r) ? rules.filter((x) => x !== r) : [...rules, r];
      applyConfig({ ...config, caseModRules: next });
    };

    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Applies case permutations to a base word to test case-insensitive authentication and bypass WAFs.
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Base string:</label>
          <input
            type="text"
            value={config.caseModBaseWord || 'Administrator'}
            onChange={(e) => applyConfig({ ...config, caseModBaseWord: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>

        <div className="space-y-1.5 pt-1">
          <span className="text-[#c4c7c5]">Case modification rules:</span>
          {[
            { id: 'lower', label: 'Lowercase (administrator)' },
            { id: 'upper', label: 'UPPERCASE (ADMINISTRATOR)' },
            { id: 'proper', label: 'Proper Name (Administrator)' },
            { id: 'invert', label: 'Invert Case (aDMINISTRATOR)' },
            { id: 'alternate', label: 'Alternate Case (aDmInIsTrAtOr)' },
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-2 cursor-pointer text-[#dfdfdf]">
              <input
                type="checkbox"
                checked={rules.includes(item.id as any)}
                onChange={() => toggleRule(item.id as any)}
                className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  // 6. RECURSIVE GREP UI
  if (payloadType === 'Recursive grep') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Extracts the payload for the next request from the response of the previous request (CSRF tokens, multi-step workflows).
        </p>
        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Initial payload string:</label>
          <input
            type="text"
            defaultValue="csrf_token_seed_0"
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Extract Regex / Delimiters:</label>
          <input
            type="text"
            defaultValue={'name="csrf_token" value="([^"]+)"'}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>
      </div>
    );
  }

  // 7. ILLEGAL UNICODE UI
  if (payloadType === 'Illegal Unicode') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Generates illegal, overlong UTF-8, and %uXXXX Unicode representations to test WAF normalization flaws.
        </p>
        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Base string:</label>
          <input
            type="text"
            value={config.illegalUnicodeBase || 'admin'}
            onChange={(e) => applyConfig({ ...config, illegalUnicodeBase: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>
        <div className="p-2 bg-[#141517] border border-[#3e4249] rounded font-mono text-[10px] text-[#34d399] space-y-1">
          <div>✓ %u00XX Standard 16-bit encoding</div>
          <div>✓ %c0%XX Overlong 2-byte UTF-8 encoding</div>
          <div>✓ Fullwidth Unicode normalization variants</div>
        </div>
      </div>
    );
  }

  // 8. CHARACTER BLOCKS UI
  if (payloadType === 'Character blocks') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Generates repeating character sequences of increasing length to test buffer overflows and memory limits.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#c4c7c5]">Base character:</label>
            <input
              type="text"
              value={config.blockChar || 'A'}
              onChange={(e) => applyConfig({ ...config, blockChar: e.target.value })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">Step size:</label>
            <input
              type="number"
              value={config.blockStep || 20}
              onChange={(e) => applyConfig({ ...config, blockStep: parseInt(e.target.value, 10) || 10 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#c4c7c5]">Min length:</label>
            <input
              type="number"
              value={config.blockMinLength || 10}
              onChange={(e) => applyConfig({ ...config, blockMinLength: parseInt(e.target.value, 10) || 10 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">Max length:</label>
            <input
              type="number"
              value={config.blockMaxLength || 200}
              onChange={(e) => applyConfig({ ...config, blockMaxLength: parseInt(e.target.value, 10) || 100 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
        </div>
      </div>
    );
  }

  // 9. NUMBERS UI
  if (payloadType === 'Numbers') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Generates sequential or random numerical payloads with customizable step, radix, and padding.
        </p>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-[#dfdfdf]">
            <input
              type="radio"
              name="numType"
              checked={config.numberType === 'sequential'}
              onChange={() => applyConfig({ ...config, numberType: 'sequential' })}
              className="text-[#f37021]"
            />
            <span>Sequential</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[#dfdfdf]">
            <input
              type="radio"
              name="numType"
              checked={config.numberType === 'random'}
              onChange={() => applyConfig({ ...config, numberType: 'random' })}
              className="text-[#f37021]"
            />
            <span>Random</span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[#c4c7c5]">From:</label>
            <input
              type="number"
              value={config.numFrom ?? 1}
              onChange={(e) => applyConfig({ ...config, numFrom: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">To:</label>
            <input
              type="number"
              value={config.numTo ?? 20}
              onChange={(e) => applyConfig({ ...config, numTo: parseInt(e.target.value, 10) || 10 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">Step:</label>
            <input
              type="number"
              value={config.numStep ?? 1}
              onChange={(e) => applyConfig({ ...config, numStep: parseInt(e.target.value, 10) || 1 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#c4c7c5]">Base (Radix):</label>
            <select
              value={config.numBase || 'decimal'}
              onChange={(e) => applyConfig({ ...config, numBase: e.target.value as any })}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
            >
              <option value="decimal" className="bg-[#2b2d30] text-[#dfdfdf]">Decimal (10)</option>
              <option value="hex" className="bg-[#2b2d30] text-[#dfdfdf]">Hexadecimal (16)</option>
            </select>
          </div>
          <div>
            <label className="text-[#c4c7c5]">Min integer digits:</label>
            <input
              type="number"
              value={config.numMinDigits || 1}
              onChange={(e) => applyConfig({ ...config, numMinDigits: parseInt(e.target.value, 10) || 1 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
        </div>
      </div>
    );
  }

  // 10. DATES UI
  if (payloadType === 'Dates') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Generates dates across a specified time range with customizable date format string.
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Format string:</label>
          <select
            value={config.dateFormat || 'yyyy-MM-dd'}
            onChange={(e) => applyConfig({ ...config, dateFormat: e.target.value })}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          >
            <option value="yyyy-MM-dd" className="bg-[#2b2d30] text-[#dfdfdf]">yyyy-MM-dd (2026-08-25)</option>
            <option value="dd/MM/yyyy" className="bg-[#2b2d30] text-[#dfdfdf]">dd/MM/yyyy (25/08/2026)</option>
            <option value="MM/dd/yyyy" className="bg-[#2b2d30] text-[#dfdfdf]">MM/dd/yyyy (08/25/2026)</option>
            <option value="yyyyMMdd" className="bg-[#2b2d30] text-[#dfdfdf]">yyyyMMdd (20260825)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#c4c7c5]">From date:</label>
            <input
              type="date"
              value={config.dateFrom || '2026-08-01'}
              onChange={(e) => applyConfig({ ...config, dateFrom: e.target.value })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">To date:</label>
            <input
              type="date"
              value={config.dateTo || '2026-08-25'}
              onChange={(e) => applyConfig({ ...config, dateTo: e.target.value })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-[#c4c7c5]">Step (days):</label>
          <input
            type="number"
            value={config.dateStepDays || 1}
            onChange={(e) => applyConfig({ ...config, dateStepDays: parseInt(e.target.value, 10) || 1 })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
          />
        </div>
      </div>
    );
  }

  // 11. BRUTE FORCER UI
  if (payloadType === 'Brute forcer') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Generates all permutations of a specified character set across a range of lengths.
        </p>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[#c4c7c5]">Character set:</label>
            <div className="flex gap-1">
              <button
                onClick={() => applyConfig({ ...config, bruteCharset: 'abcdefghijklmnopqrstuvwxyz' })}
                className="text-[10px] text-[#f37021] hover:underline"
              >
                a-z
              </button>
              <button
                onClick={() => applyConfig({ ...config, bruteCharset: '0123456789' })}
                className="text-[10px] text-[#f37021] hover:underline"
              >
                0-9
              </button>
              <button
                onClick={() => applyConfig({ ...config, bruteCharset: 'abcdefghijklmnopqrstuvwxyz0123456789' })}
                className="text-[10px] text-[#f37021] hover:underline"
              >
                a-z0-9
              </button>
            </div>
          </div>
          <input
            type="text"
            value={config.bruteCharset || 'abcdefghijklmnopqrstuvwxyz0123456789'}
            onChange={(e) => applyConfig({ ...config, bruteCharset: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#c4c7c5]">Min length:</label>
            <input
              type="number"
              value={config.bruteMinLen || 1}
              onChange={(e) => applyConfig({ ...config, bruteMinLen: parseInt(e.target.value, 10) || 1 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">Max length:</label>
            <input
              type="number"
              value={config.bruteMaxLen || 3}
              onChange={(e) => applyConfig({ ...config, bruteMaxLen: parseInt(e.target.value, 10) || 2 })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
            />
          </div>
        </div>
      </div>
    );
  }

  // 12. NULL PAYLOADS UI
  if (payloadType === 'Null payloads') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Issues repeated requests without modifying payload positions (useful for polling or race condition testing).
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Generate payload count:</label>
          <input
            type="number"
            value={config.nullCount || 10}
            onChange={(e) => applyConfig({ ...config, nullCount: parseInt(e.target.value, 10) || 10 })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono text-center"
          />
        </div>
      </div>
    );
  }

  // 13. CHARACTER FROBBER UI
  if (payloadType === 'Character frobber') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Increments the ASCII character value at each character position one at a time.
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Base string:</label>
          <input
            type="text"
            value={config.frobberBase || 'admin'}
            onChange={(e) => applyConfig({ ...config, frobberBase: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>
      </div>
    );
  }

  // 14. BIT FLIPPER UI
  if (payloadType === 'Bit flipper') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Flips individual bits across base payload or base64 token to test CBC oracle padding and checksums.
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Base payload:</label>
          <input
            type="text"
            value={config.bitFlipperBase || 'dXNlcj1hZG1pbg=='}
            onChange={(e) => applyConfig({ ...config, bitFlipperBase: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>

        <div>
          <label className="text-[#c4c7c5]">Format:</label>
          <select
            value={config.bitFlipperMode || 'base64'}
            onChange={(e) => applyConfig({ ...config, bitFlipperMode: e.target.value as any })}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          >
            <option value="base64" className="bg-[#2b2d30] text-[#dfdfdf]">Base64 Encoded</option>
            <option value="ascii" className="bg-[#2b2d30] text-[#dfdfdf]">Raw ASCII / Plaintext</option>
          </select>
        </div>
      </div>
    );
  }

  // 15. USERNAME GENERATOR UI
  if (payloadType === 'Username generator') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Generates all standard corporate username permutations from first and last names.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#c4c7c5]">First name:</label>
            <input
              type="text"
              value={config.userGenFirst || 'John'}
              onChange={(e) => applyConfig({ ...config, userGenFirst: e.target.value })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
            />
          </div>
          <div>
            <label className="text-[#c4c7c5]">Last name:</label>
            <input
              type="text"
              value={config.userGenLast || 'Doe'}
              onChange={(e) => applyConfig({ ...config, userGenLast: e.target.value })}
              className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
            />
          </div>
        </div>
      </div>
    );
  }

  // 16. ECB BLOCK SHUFFLER UI
  if (payloadType === 'ECB block shuffler') {
    return (
      <div className="space-y-3 text-[11px]">
        <p className="text-[#9da5b4]">
          Transposes and duplicates ciphertext blocks to exploit ECB cipher mode weaknesses.
        </p>

        <div className="space-y-1">
          <label className="text-[#c4c7c5]">Base ciphertext (Hex):</label>
          <input
            type="text"
            value={config.ecbBase || '6a87b30c88599426f8d38861d8469d75'}
            onChange={(e) => applyConfig({ ...config, ecbBase: e.target.value })}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          />
        </div>

        <div>
          <label className="text-[#c4c7c5]">Block size (bytes):</label>
          <select
            value={config.ecbBlockSize || 16}
            onChange={(e) => applyConfig({ ...config, ecbBlockSize: parseInt(e.target.value, 10) || 16 })}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] font-mono"
          >
            <option value="16" className="bg-[#2b2d30] text-[#dfdfdf]">16 bytes (AES-128 / AES-256)</option>
            <option value="8" className="bg-[#2b2d30] text-[#dfdfdf]">8 bytes (DES / 3DES / Blowfish)</option>
          </select>
        </div>
      </div>
    );
  }

  return null;
};
