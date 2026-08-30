import React from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  GitCompare,
  ArrowLeftRight,
} from 'lucide-react';

import { useComparerStore } from '../stores/comparerStore';

export const ComparerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { textA, setTextA, textB, setTextB, mode, setMode } = useComparerStore();

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Comparer (Diff) Workbench</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#141517] p-0.5 rounded border border-[#3e4249]">
            <button
              onClick={() => setMode('words')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'words' ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              Words Mode
            </button>
            <button
              onClick={() => setMode('bytes')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'bytes' ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
              }`}
            >
              Bytes Mode
            </button>
          </div>

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
        </div>
      </div>

      {/* Main Side-by-Side Split Diff View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Item */}
        <div className="flex-1 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#34d399]">
            <span>Item 1 (Baseline)</span>
            <span className="font-mono text-[10px] text-[#6f737a]">{textA.length} bytes</span>
          </div>
          <textarea
            value={textA}
            onChange={(e) => setTextA(e.target.value)}
            className="flex-1 w-full bg-[#1e1f22] text-[#dfdfdf] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#34d399] focus:outline-none resize-none leading-5"
          />
        </div>

        {/* Right Item */}
        <div className="flex-1 flex flex-col bg-[#141517] p-3">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-[#f37021]">
            <span>Item 2 (Comparison)</span>
            <span className="font-mono text-[10px] text-[#6f737a]">{textB.length} bytes</span>
          </div>
          <textarea
            value={textB}
            onChange={(e) => setTextB(e.target.value)}
            className="flex-1 w-full bg-[#1e1f22] text-[#dfdfdf] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-5"
          />
        </div>
      </div>
    </div>
  );
};
