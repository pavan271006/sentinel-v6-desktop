import React, { useState, useMemo, useEffect } from 'react';
import { useDecoderStore, DecoderStep } from '../stores/decoderStore';
import { useToastStore } from '../stores/toastStore';
import {
  Binary,
  Copy,
  Trash2,
  Sparkles,
  ChevronDown,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  computeHash,
  encodeOctal,
  decodeOctal,
  encodeBinary,
  decodeBinary,
  encodeGzip,
  decodeGzip,
} from '../utils/burpCryptoUtils';
import { autoDetectCodec } from '../utils/burpDecoderUtils';

export interface CodecMenuItem {
  id: string;
  label: string;
  bgColor?: string;
  textColor: string;
}

export const DECODE_OPTIONS: CodecMenuItem[] = [
  { id: 'Plain', label: 'Plain', bgColor: 'bg-[#2b2d30]', textColor: 'text-white' },
  { id: 'URL', label: 'URL', bgColor: 'bg-[#ff0000]', textColor: 'text-white' },
  { id: 'HTML', label: 'HTML', bgColor: 'bg-[#ff9900]', textColor: 'text-black' },
  { id: 'Base64', label: 'Base64', bgColor: 'bg-[#ffff00]', textColor: 'text-black' },
  { id: 'ASCII hex', label: 'ASCII hex', bgColor: 'bg-[#00cc00]', textColor: 'text-black' },
  { id: 'Hex', label: 'Hex', bgColor: 'bg-[#0000ff]', textColor: 'text-white' },
  { id: 'Octal', label: 'Octal', bgColor: 'bg-[#00cccc]', textColor: 'text-black' },
  { id: 'Binary', label: 'Binary', bgColor: 'bg-[#ff00ff]', textColor: 'text-black' },
  { id: 'Gzip', label: 'Gzip', bgColor: 'bg-[#cc8888]', textColor: 'text-black' },
];

export const ENCODE_OPTIONS: CodecMenuItem[] = [
  { id: 'Plain', label: 'Plain', textColor: 'text-white' },
  { id: 'URL', label: 'URL', textColor: 'text-[#ff3333]' },
  { id: 'HTML', label: 'HTML', textColor: 'text-[#ff9900]' },
  { id: 'Base64', label: 'Base64', textColor: 'text-[#ffff00]' },
  { id: 'ASCII hex', label: 'ASCII hex', textColor: 'text-[#33cc33]' },
  { id: 'Hex', label: 'Hex', textColor: 'text-[#3388ff]' },
  { id: 'Octal', label: 'Octal', textColor: 'text-[#00cccc]' },
  { id: 'Binary', label: 'Binary', textColor: 'text-[#ff33ff]' },
  { id: 'Gzip', label: 'Gzip', textColor: 'text-[#cc8888]' },
];

export const HASH_OPTIONS: string[] = [
  'BLAKE2B-160',
  'BLAKE2B-256',
  'BLAKE2B-384',
  'BLAKE2B-512',
  'BLAKE2S-128',
  'BLAKE2S-160',
  'BLAKE2S-224',
  'BLAKE2S-256',
  'BLAKE3-256',
  'MD2',
  'MD5',
  'SHA-1',
  'SHA-224',
  'SHA-256',
  'SHA-384',
  'SHA-512',
  'SHA3-224',
  'SHA3-256',
  'SHA3-384',
  'SHA3-512',
  'RIPEMD-160',
];

/**
 * Authentic Burp Suite 3-column Hex Viewer (Offset | 16 Hex bytes | ASCII representation)
 */
const HexViewer: React.FC<{ text: string }> = ({ text }) => {
  const bytes = useMemo(() => new TextEncoder().encode(text), [text]);
  const rows = useMemo(() => {
    const list: { offset: string; hexLeft: string[]; hexRight: string[]; ascii: string }[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(8, '0');
      const hexLeft: string[] = [];
      const hexRight: string[] = [];
      let ascii = '';

      for (let j = 0; j < 8; j++) {
        if (j < chunk.length) {
          hexLeft.push(chunk[j].toString(16).padStart(2, '0'));
        } else {
          hexLeft.push('  ');
        }
      }

      for (let j = 8; j < 16; j++) {
        if (j < chunk.length) {
          hexRight.push(chunk[j].toString(16).padStart(2, '0'));
        } else {
          hexRight.push('  ');
        }
      }

      for (let j = 0; j < chunk.length; j++) {
        const ch = chunk[j];
        ascii += ch >= 32 && ch <= 126 ? String.fromCharCode(ch) : '.';
      }

      list.push({ offset, hexLeft, hexRight, ascii });
    }
    return list;
  }, [bytes]);

  if (bytes.length === 0) {
    return (
      <div className="font-mono text-xs text-[#6f737a] italic p-4 text-center">
        No bytes to display in hex view
      </div>
    );
  }

  return (
    <div className="font-mono text-[11px] leading-5 p-2.5 bg-[#141517] rounded border border-[#2b2d30] overflow-auto max-h-64 select-text">
      <div className="flex gap-4 pb-1 border-b border-[#2b2d30] text-[10px] text-[#8c9099] font-bold select-none">
        <span className="w-16">Offset</span>
        <span className="flex-1">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span>
        <span className="w-36">ASCII</span>
      </div>
      {rows.map((row, rIdx) => (
        <div key={rIdx} className="flex gap-4 hover:bg-[#1e1f22]/70 py-0.5">
          <span className="text-[#6f737a] select-none w-16">{row.offset}</span>
          <div className="flex gap-1 flex-1 font-medium">
            <span className="text-[#38bdf8]">{row.hexLeft.join(' ')}</span>
            <span className="text-[#6f737a] select-none">&nbsp;</span>
            <span className="text-[#38bdf8]">{row.hexRight.join(' ')}</span>
          </div>
          <span className="text-[#34d399] w-36 select-all break-all">{row.ascii}</span>
        </div>
      ))}
    </div>
  );
};

export const DecoderWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    inputText,
    inputViewMode,
    setInputViewMode,
    setInputText,
    steps,
    addStep,
    updateStepOutput,
    updateStepViewMode,
    removeStep,
    clearCascade,
  } = useDecoderStore();

  // Active open dropdown tracker: { paneId: string, type: 'decode' | 'encode' | 'hash' | null }
  const [activeDropdown, setActiveDropdown] = useState<{ paneId: string; type: 'decode' | 'encode' | 'hash' } | null>(null);
  const [hashSearchQuery, setHashSearchQuery] = useState('');

  // Close dropdown on outside click
  useEffect(() => {
    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.decoder-dropdown-trigger') && !target.closest('.decoder-dropdown-popup')) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // Execute Transformation
  const handleApplyTransform = async (
    operationType: 'decode' | 'encode' | 'hash',
    format: string,
    sourceText: string,
    sourcePaneId: string
  ) => {
    setActiveDropdown(null);
    let output = sourceText;
    let label = '';
    let color = '#38bdf8';

    try {
      if (operationType === 'decode') {
        label = `Decode as ${format}`;
        const option = DECODE_OPTIONS.find((o) => o.id === format);
        color = option?.bgColor?.replace('bg-[', '').replace(']', '') || '#ff0000';

        switch (format) {
          case 'Plain':
            output = sourceText;
            break;
          case 'URL': {
            const plus = sourceText.replace(/\+/g, ' ');
            try {
              output = decodeURIComponent(plus);
            } catch {
              output = plus.replace(/%([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
            }
            break;
          }
          case 'HTML': {
            const ta = document.createElement('textarea');
            ta.innerHTML = sourceText;
            output = ta.value;
            break;
          }
          case 'Base64': {
            const clean = sourceText.trim().replace(/-/g, '+').replace(/_/g, '/');
            const padded = clean.padEnd(clean.length + ((4 - (clean.length % 4)) % 4), '=');
            output = atob(padded);
            break;
          }
          case 'ASCII hex':
          case 'Hex': {
            const clean = sourceText.replace(/\\x|0x|\s+/gi, '');
            let res = '';
            for (let i = 0; i < clean.length; i += 2) {
              const b = parseInt(clean.substring(i, i + 2), 16);
              if (!isNaN(b)) res += String.fromCharCode(b);
            }
            output = res || sourceText;
            break;
          }
          case 'Octal':
            output = decodeOctal(sourceText);
            break;
          case 'Binary':
            output = decodeBinary(sourceText);
            break;
          case 'Gzip':
            output = await decodeGzip(sourceText);
            break;
          default:
            output = sourceText;
        }
      } else if (operationType === 'encode') {
        label = `Encode as ${format}`;
        const option = ENCODE_OPTIONS.find((o) => o.id === format);
        color = option?.textColor?.replace('text-[', '').replace(']', '') || '#38bdf8';

        switch (format) {
          case 'Plain':
            output = sourceText;
            break;
          case 'URL':
            output = encodeURIComponent(sourceText);
            break;
          case 'HTML':
            output = sourceText.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
            break;
          case 'Base64': {
            const utf8 = new TextEncoder().encode(sourceText);
            let bin = '';
            for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i]);
            output = btoa(bin);
            break;
          }
          case 'ASCII hex':
            output = Array.from(new TextEncoder().encode(sourceText))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join(' ');
            break;
          case 'Hex':
            output = Array.from(new TextEncoder().encode(sourceText))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            break;
          case 'Octal':
            output = encodeOctal(sourceText);
            break;
          case 'Binary':
            output = encodeBinary(sourceText);
            break;
          case 'Gzip':
            output = await encodeGzip(sourceText);
            break;
          default:
            output = sourceText;
        }
      } else if (operationType === 'hash') {
        label = `Hash as ${format}`;
        color = '#a855f7';
        output = await computeHash(format, sourceText);
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Transformation Failed', description: String(err) });
      return;
    }

    const newStep: DecoderStep = {
      id: Date.now().toString(),
      sourceStepId: sourcePaneId,
      operationType,
      format,
      label,
      color,
      output,
      viewMode: 'text',
    };

    addStep(newStep);
  };

  // Smart Auto-Decode
  const handleSmartDecode = (sourceText: string, sourcePaneId: string) => {
    const detected = autoDetectCodec(sourceText);
    let targetFormat = 'URL';
    if (detected === 'base64') targetFormat = 'Base64';
    else if (detected === 'html') targetFormat = 'HTML';
    else if (detected === 'hex') targetFormat = 'Hex';
    else if (detected === 'url') targetFormat = 'URL';

    handleApplyTransform('decode', targetFormat, sourceText, sourcePaneId);
    addToast({
      type: 'info',
      title: 'Smart Decode',
      description: `Auto-detected and decoded as ${targetFormat}`,
    });
  };

  // Copy helper
  const handleCopyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    addToast({ type: 'success', title: `Copied ${label} to clipboard` });
  };

  // Filtered Hashes
  const filteredHashes = useMemo(() => {
    if (!hashSearchQuery.trim()) return HASH_OPTIONS;
    return HASH_OPTIONS.filter((h) => h.toLowerCase().includes(hashSearchQuery.toLowerCase()));
  }, [hashSearchQuery]);

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Workspace Header Bar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Decoder</span>
          <span className="text-[11px] text-[#8c9099] font-mono ml-2">
            Cascade: {steps.length + 1} stages
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSmartDecode(inputText, 'input')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2b2d30] hover:bg-[#383b42] text-[#38bdf8] border border-[#3e4249] text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart decode</span>
          </button>
          {steps.length > 0 && (
            <button
              onClick={() => handleCopyText(steps[steps.length - 1].output, 'latest output')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2b2d30] hover:bg-[#383b42] text-[#dfdfdf] border border-[#3e4249] text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy result</span>
            </button>
          )}
          {steps.length > 0 && (
            <button
              onClick={clearCascade}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2b2d30] hover:bg-[#ef4444]/20 hover:text-[#ef4444] text-[#8c9099] border border-[#3e4249] text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear cascade</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Cascade Workspace Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* ================================================================= */}
        {/* STAGE 0: INITIAL INPUT PANE                                       */}
        {/* ================================================================= */}
        <div className="bg-[#141517] rounded border border-[#2b2d30] p-3 flex flex-col space-y-2 shadow-sm">
          {/* Top Line: Title & Right Controls */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">Initial Text</span>
              <span className="text-[#8c9099] font-mono text-[11px]">
                ({inputText.length} bytes)
              </span>
            </div>

            {/* Right Controls Block matching media_1788639854798.png */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {/* Radio: (o) Text  ( ) Hex   (?) */}
              <div className="flex items-center gap-3 text-xs text-[#dfdfdf] select-none">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="input-view-mode"
                    checked={inputViewMode === 'text'}
                    onChange={() => setInputViewMode('text')}
                    className="text-[#38bdf8] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Text</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="input-view-mode"
                    checked={inputViewMode === 'hex'}
                    onChange={() => setInputViewMode('hex')}
                    className="text-[#38bdf8] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Hex</span>
                </label>
                <button
                  type="button"
                  className="text-[#8c9099] hover:text-white transition-colors"
                  title="Decoder help & documentation"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dropdown Action Buttons: Decode as ..., Encode as ..., Hash ... */}
              <div className="flex items-center gap-1.5 relative">
                {/* 1. Decode as ... Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(
                        activeDropdown?.paneId === 'input' && activeDropdown?.type === 'decode'
                          ? null
                          : { paneId: 'input', type: 'decode' }
                      );
                    }}
                    className="decoder-dropdown-trigger flex items-center justify-between gap-2 px-2.5 py-1 bg-[#1e1f22] hover:bg-[#282b30] text-[#dfdfdf] rounded border border-[#3e4249] text-xs font-sans transition-colors min-w-[125px]"
                  >
                    <span>Decode as ...</span>
                    <ChevronDown className="w-3 h-3 text-[#8c9099]" />
                  </button>

                  {/* Decode as ... Popup Menu matching media_1788639854798.png */}
                  {activeDropdown?.paneId === 'input' && activeDropdown?.type === 'decode' && (
                    <div className="decoder-dropdown-popup absolute right-0 top-full mt-1 w-36 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 overflow-hidden py-0.5">
                      {DECODE_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => handleApplyTransform('decode', opt.id, inputText, 'input')}
                          className={`px-3 py-1 text-xs cursor-pointer font-medium transition-all ${opt.bgColor} ${opt.textColor} hover:opacity-90`}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Encode as ... Dropdown matching media_1788639873735.png */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(
                        activeDropdown?.paneId === 'input' && activeDropdown?.type === 'encode'
                          ? null
                          : { paneId: 'input', type: 'encode' }
                      );
                    }}
                    className="decoder-dropdown-trigger flex items-center justify-between gap-2 px-2.5 py-1 bg-[#1e1f22] hover:bg-[#282b30] text-[#dfdfdf] rounded border border-[#3e4249] text-xs font-sans transition-colors min-w-[125px]"
                  >
                    <span>Encode as ...</span>
                    <ChevronDown className="w-3 h-3 text-[#8c9099]" />
                  </button>

                  {/* Encode as ... Popup Menu matching media_1788639873735.png */}
                  {activeDropdown?.paneId === 'input' && activeDropdown?.type === 'encode' && (
                    <div className="decoder-dropdown-popup absolute right-0 top-full mt-1 w-36 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 overflow-hidden py-0.5">
                      {ENCODE_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => handleApplyTransform('encode', opt.id, inputText, 'input')}
                          className={`px-3 py-1 text-xs cursor-pointer font-medium hover:bg-[#2b2d30] transition-colors ${opt.textColor}`}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Hash ... Dropdown matching media_1788639885011.png */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(
                        activeDropdown?.paneId === 'input' && activeDropdown?.type === 'hash'
                          ? null
                          : { paneId: 'input', type: 'hash' }
                      );
                    }}
                    className="decoder-dropdown-trigger flex items-center justify-between gap-2 px-2.5 py-1 bg-[#1e1f22] hover:bg-[#282b30] text-[#dfdfdf] rounded border border-[#3e4249] text-xs font-sans transition-colors min-w-[95px]"
                  >
                    <span>Hash ...</span>
                    <ChevronDown className="w-3 h-3 text-[#8c9099]" />
                  </button>

                  {/* Hash ... Popup Menu matching media_1788639885011.png */}
                  {activeDropdown?.paneId === 'input' && activeDropdown?.type === 'hash' && (
                    <div className="decoder-dropdown-popup absolute right-0 top-full mt-1 w-44 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto">
                      <div className="px-2 pb-1 mb-1 border-b border-[#2b2d30]">
                        <input
                          type="text"
                          value={hashSearchQuery}
                          onChange={(e) => setHashSearchQuery(e.target.value)}
                          placeholder="Filter hash..."
                          className="w-full bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-[10px] outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredHashes.map((h) => (
                        <div
                          key={h}
                          onClick={() => handleApplyTransform('hash', h, inputText, 'input')}
                          className="px-3 py-1 text-xs cursor-pointer text-[#dfdfdf] hover:bg-[#2b2d30] hover:text-white font-mono transition-colors"
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Smart Decode Button */}
                <button
                  onClick={() => handleSmartDecode(inputText, 'input')}
                  className="p-1 rounded bg-[#1e1f22] hover:bg-[#2b2d30] text-[#38bdf8] border border-[#3e4249] transition-colors"
                  title="Smart Auto-Decode Input"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Editor Area (Text or Hex) */}
          <div className="pt-1">
            {inputViewMode === 'text' ? (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste payload to decode/encode/hash..."
                rows={4}
                className="w-full bg-[#1e1f22] text-[#34d399] font-mono text-xs p-2.5 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none resize-y leading-relaxed"
                spellCheck={false}
              />
            ) : (
              <HexViewer text={inputText} />
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* CASCADE STAGES (Steps 1..N)                                        */}
        {/* ================================================================= */}
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="bg-[#141517] rounded border border-[#2b2d30] p-3 flex flex-col space-y-2 shadow-sm relative transition-all"
          >
            {/* Step Header with Color Badge, Title, and Action Buttons */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: step.color }}
                  className="px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm"
                >
                  {step.label}
                </span>
                <span className="text-[#8c9099] font-mono text-[11px]">
                  Step {idx + 1} &bull; ({step.output.length} bytes)
                </span>
              </div>

              {/* Right Controls Block for this step */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {/* Radio: (o) Text  ( ) Hex   (?) + Copy + Close */}
                <div className="flex items-center gap-3 text-xs text-[#dfdfdf] select-none">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`step-view-mode-${step.id}`}
                      checked={step.viewMode === 'text'}
                      onChange={() => updateStepViewMode(step.id, 'text')}
                      className="text-[#38bdf8] focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Text</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`step-view-mode-${step.id}`}
                      checked={step.viewMode === 'hex'}
                      onChange={() => updateStepViewMode(step.id, 'hex')}
                      className="text-[#38bdf8] focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Hex</span>
                  </label>

                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopyText(step.output, `Step ${idx + 1} output`)}
                    className="p-1 rounded hover:bg-[#282b30] text-[#9da5b4] hover:text-white transition-colors"
                    title="Copy step output"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Remove Step Button */}
                  <button
                    onClick={() => removeStep(step.id)}
                    className="p-1 rounded hover:bg-[#ef4444]/20 text-[#8c9099] hover:text-[#ef4444] transition-colors"
                    title="Remove this step"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chaining Transformations from THIS step */}
                <div className="flex items-center gap-1.5 relative">
                  {/* 1. Decode as ... */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(
                          activeDropdown?.paneId === step.id && activeDropdown?.type === 'decode'
                            ? null
                            : { paneId: step.id, type: 'decode' }
                        );
                      }}
                      className="decoder-dropdown-trigger flex items-center justify-between gap-2 px-2.5 py-1 bg-[#1e1f22] hover:bg-[#282b30] text-[#dfdfdf] rounded border border-[#3e4249] text-xs font-sans transition-colors min-w-[125px]"
                    >
                      <span>Decode as ...</span>
                      <ChevronDown className="w-3 h-3 text-[#8c9099]" />
                    </button>

                    {activeDropdown?.paneId === step.id && activeDropdown?.type === 'decode' && (
                      <div className="decoder-dropdown-popup absolute right-0 top-full mt-1 w-36 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 overflow-hidden py-0.5">
                        {DECODE_OPTIONS.map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => handleApplyTransform('decode', opt.id, step.output, step.id)}
                            className={`px-3 py-1 text-xs cursor-pointer font-medium transition-all ${opt.bgColor} ${opt.textColor} hover:opacity-90`}
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Encode as ... */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(
                          activeDropdown?.paneId === step.id && activeDropdown?.type === 'encode'
                            ? null
                            : { paneId: step.id, type: 'encode' }
                        );
                      }}
                      className="decoder-dropdown-trigger flex items-center justify-between gap-2 px-2.5 py-1 bg-[#1e1f22] hover:bg-[#282b30] text-[#dfdfdf] rounded border border-[#3e4249] text-xs font-sans transition-colors min-w-[125px]"
                    >
                      <span>Encode as ...</span>
                      <ChevronDown className="w-3 h-3 text-[#8c9099]" />
                    </button>

                    {activeDropdown?.paneId === step.id && activeDropdown?.type === 'encode' && (
                      <div className="decoder-dropdown-popup absolute right-0 top-full mt-1 w-36 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 overflow-hidden py-0.5">
                        {ENCODE_OPTIONS.map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => handleApplyTransform('encode', opt.id, step.output, step.id)}
                            className={`px-3 py-1 text-xs cursor-pointer font-medium hover:bg-[#2b2d30] transition-colors ${opt.textColor}`}
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Hash ... */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(
                          activeDropdown?.paneId === step.id && activeDropdown?.type === 'hash'
                            ? null
                            : { paneId: step.id, type: 'hash' }
                        );
                      }}
                      className="decoder-dropdown-trigger flex items-center justify-between gap-2 px-2.5 py-1 bg-[#1e1f22] hover:bg-[#282b30] text-[#dfdfdf] rounded border border-[#3e4249] text-xs font-sans transition-colors min-w-[95px]"
                    >
                      <span>Hash ...</span>
                      <ChevronDown className="w-3 h-3 text-[#8c9099]" />
                    </button>

                    {activeDropdown?.paneId === step.id && activeDropdown?.type === 'hash' && (
                      <div className="decoder-dropdown-popup absolute right-0 top-full mt-1 w-44 bg-[#1e1f22] border border-[#3e4249] rounded shadow-2xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto">
                        <div className="px-2 pb-1 mb-1 border-b border-[#2b2d30]">
                          <input
                            type="text"
                            value={hashSearchQuery}
                            onChange={(e) => setHashSearchQuery(e.target.value)}
                            placeholder="Filter hash..."
                            className="w-full bg-[#141517] text-white px-2 py-0.5 rounded border border-[#3e4249] text-[10px] outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {filteredHashes.map((h) => (
                          <div
                            key={h}
                            onClick={() => handleApplyTransform('hash', h, step.output, step.id)}
                            className="px-3 py-1 text-xs cursor-pointer text-[#dfdfdf] hover:bg-[#2b2d30] hover:text-white font-mono transition-colors"
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Smart Decode Button */}
                  <button
                    onClick={() => handleSmartDecode(step.output, step.id)}
                    className="p-1 rounded bg-[#1e1f22] hover:bg-[#2b2d30] text-[#38bdf8] border border-[#3e4249] transition-colors"
                    title="Smart Auto-Decode Step Output"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Output Display Area (Text or Hex) */}
            <div className="pt-1">
              {step.viewMode === 'text' ? (
                <textarea
                  value={step.output}
                  onChange={(e) => updateStepOutput(step.id, e.target.value)}
                  rows={4}
                  className="w-full bg-[#1e1f22] text-[#38bdf8] font-mono text-xs p-2.5 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none resize-y leading-relaxed select-text"
                  spellCheck={false}
                />
              ) : (
                <HexViewer text={step.output} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
