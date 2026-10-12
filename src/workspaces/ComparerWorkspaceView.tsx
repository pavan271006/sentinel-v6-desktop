import React from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  GitCompare,
  ArrowLeftRight,
  Trash2,
  Eye,
  FileCode,
  Binary,
} from 'lucide-react';
import { useComparerStore } from '../stores/comparerStore';
import { DiffViewer } from '../design-system/DiffViewer';
import { RawByteInspector } from '../design-system/RawByteInspector';

export const ComparerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    textA,
    setTextA,
    textB,
    setTextB,
    mode,
    setMode,
    viewMode,
    setViewMode,
  } = useComparerStore();

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header Toolbar */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Comparer (Diff) Workbench</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Pretty / Raw / Hex Switcher */}
          <div className="flex items-center bg-[#141517] p-0.5 rounded border border-[#3e4249]">
            <button
              onClick={() => setViewMode('pretty')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'pretty' ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Pretty Diff
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'raw' ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Raw
            </button>
            <button
              onClick={() => setViewMode('hex')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'hex' ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              Hex
            </button>
          </div>

          {/* Words / Bytes Mode Toggle */}
          <div className="flex items-center bg-[#141517] p-0.5 rounded border border-[#3e4249]">
            <button
              onClick={() => setMode('words')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'words' ? 'bg-[#313438] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              Words
            </button>
            <button
              onClick={() => setMode('bytes')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'bytes' ? 'bg-[#313438] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              Bytes
            </button>
          </div>

          {/* Swap Button */}
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<ArrowLeftRight className="w-3 h-3" />}
            onClick={() => {
              const temp = textA;
              setTextA(textB);
              setTextB(temp);
              addToast({ type: 'info', title: 'Swapped Buffers' });
            }}
          >
            Swap
          </Button>

          {/* Clear Buffers */}
          <Button
            variant="ghost"
            size="xs"
            leftIcon={<Trash2 className="w-3 h-3 text-red-400" />}
            onClick={() => {
              setTextA('');
              setTextB('');
              addToast({ type: 'info', title: 'Buffers Cleared' });
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Main Diff / Editor View */}
      <div className="flex-1 flex min-h-0 overflow-hidden bg-[#141517]">
        {viewMode === 'pretty' && (
          <DiffViewer
            originalText={textA}
            modifiedText={textB}
            originalTitle="Item 1 (Baseline)"
            modifiedTitle="Item 2 (Comparison)"
            initialMode="side-by-side"
            className="border-0 rounded-none h-full"
          />
        )}

        {viewMode === 'raw' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Item */}
            <div className="flex-1 flex flex-col border-r border-[#2b2d30] p-3">
              <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#34d399]">
                <span>Item 1 (Baseline)</span>
                <span className="font-mono text-[10px] text-[#6f737a]">{textA.length} bytes</span>
              </div>
              <textarea
                value={textA}
                onChange={(e) => setTextA(e.target.value)}
                placeholder="Paste original HTTP request/response here..."
                className="flex-1 w-full bg-[#1e1f22] text-[#dfdfdf] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#34d399] focus:outline-none resize-none leading-5"
                spellCheck={false}
              />
            </div>

            {/* Right Item */}
            <div className="flex-1 flex flex-col p-3">
              <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#f37021]">
                <span>Item 2 (Comparison)</span>
                <span className="font-mono text-[10px] text-[#6f737a]">{textB.length} bytes</span>
              </div>
              <textarea
                value={textB}
                onChange={(e) => setTextB(e.target.value)}
                placeholder="Paste comparison HTTP request/response here..."
                className="flex-1 w-full bg-[#1e1f22] text-[#dfdfdf] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-5"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {viewMode === 'hex' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col border-r border-[#2b2d30] overflow-hidden">
              <div className="bg-[#1e1f22] px-3 py-1.5 text-xs font-semibold text-[#34d399] border-b border-[#2b2d30]">
                Item 1 Hex
              </div>
              <div className="flex-1 overflow-auto">
                <RawByteInspector data={textA} />
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-[#1e1f22] px-3 py-1.5 text-xs font-semibold text-[#f37021] border-b border-[#2b2d30]">
                Item 2 Hex
              </div>
              <div className="flex-1 overflow-auto">
                <RawByteInspector data={textB} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
