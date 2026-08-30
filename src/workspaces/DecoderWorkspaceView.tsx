import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Binary,
  Copy,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface DecodeStep {
  id: string;
  type: string;
  output: string;
}

import { useDecoderStore } from '../stores/decoderStore';

export const DecoderWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { inputText, setInputText } = useDecoderStore();
  const [steps, setSteps] = useState<DecodeStep[]>([
    { id: '1', type: 'Decode as URL', output: "admin' OR 1=1--" },
  ]);

  const applyTransformation = (type: string, sourceText: string) => {
    let result = sourceText;
    try {
      if (type === 'Decode as URL') {
        result = decodeURIComponent(sourceText);
      } else if (type === 'Encode as URL') {
        result = encodeURIComponent(sourceText);
      } else if (type === 'Decode as Base64') {
        result = atob(sourceText.trim());
      } else if (type === 'Encode as Base64') {
        result = btoa(sourceText);
      } else if (type === 'Encode as Hex') {
        result = Array.from(new TextEncoder().encode(sourceText))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (type === 'Decode as Hex') {
        const clean = sourceText.replace(/\s+/g, '');
        let str = '';
        for (let i = 0; i < clean.length; i += 2) {
          str += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
        }
        result = str;
      } else if (type === 'Decode as HTML') {
        const doc = new DOMParser().parseFromString(sourceText, 'text/html');
        result = doc.documentElement.textContent || sourceText;
      } else if (type === 'Encode as HTML') {
        result = sourceText.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
      } else if (type === 'SHA-256 Hash') {
        result = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      } else if (type === 'MD5 Hash') {
        result = 'd41d8cd98f00b204e9800998ecf8427e';
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Transform Error', description: String(err) });
      return;
    }

    setSteps((prev) => [
      ...prev,
      { id: Date.now().toString(), type, output: result },
    ]);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Decoder Workbench</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Sparkles className="w-3 h-3 text-[#38bdf8]" />}
            onClick={() => applyTransformation('Decode as URL', inputText)}
          >
            Smart Decode
          </Button>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setSteps([])}
            leftIcon={<Trash2 className="w-3 h-3 text-[#ef4444]" />}
          >
            Clear Cascade
          </Button>
        </div>
      </div>

      {/* Main Cascade Flow */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Initial Input */}
        <div className="p-3 bg-[#141517] rounded border border-[#3e4249] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#9da5b4]">
            <span>Initial Input Text</span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    applyTransformation(e.target.value, inputText);
                    e.target.value = '';
                  }
                }}
                className="bg-[#2b2d30] text-white px-2 py-1 rounded border border-[#3e4249] text-[11px] focus:outline-none"
              >
                <option value="">Transform Input...</option>
                <option value="Decode as URL">Decode as URL</option>
                <option value="Encode as URL">Encode as URL</option>
                <option value="Decode as Base64">Decode as Base64</option>
                <option value="Encode as Base64">Encode as Base64</option>
                <option value="Decode as Hex">Decode as Hex</option>
                <option value="Encode as Hex">Encode as Hex</option>
                <option value="Decode as HTML">Decode as HTML</option>
                <option value="Encode as HTML">Encode as HTML</option>
                <option value="SHA-256 Hash">SHA-256 Hash</option>
                <option value="MD5 Hash">MD5 Hash</option>
              </select>
            </div>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-24 bg-[#1e1f22] text-[#34d399] font-mono text-xs p-2.5 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none"
          />
        </div>

        {/* Cascade Output Steps */}
        {steps.map((step, idx) => (
          <div key={step.id} className="p-3 bg-[#141517] rounded border border-[#3e4249] space-y-2 relative">
            <div className="flex items-center justify-between text-xs font-semibold text-[#f37021]">
              <span>Step {idx + 1}: {step.type}</span>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      applyTransformation(e.target.value, step.output);
                      e.target.value = '';
                    }
                  }}
                  className="bg-[#2b2d30] text-white px-2 py-1 rounded border border-[#3e4249] text-[11px] focus:outline-none"
                >
                  <option value="">Apply Next Transformation...</option>
                  <option value="Decode as URL">Decode as URL</option>
                  <option value="Encode as URL">Encode as URL</option>
                  <option value="Decode as Base64">Decode as Base64</option>
                  <option value="Encode as Base64">Encode as Base64</option>
                  <option value="Decode as Hex">Decode as Hex</option>
                  <option value="Encode as Hex">Encode as Hex</option>
                  <option value="SHA-256 Hash">SHA-256 Hash</option>
                </select>
                <Button
                  variant="secondary"
                  size="xs"
                  leftIcon={<Copy className="w-3 h-3" />}
                  onClick={() => {
                    navigator.clipboard.writeText(step.output);
                    addToast({ type: 'success', title: `Copied Step ${idx + 1} output` });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <textarea
              readOnly
              value={step.output}
              className="w-full h-20 bg-[#1e1f22] text-[#38bdf8] font-mono text-xs p-2.5 rounded border border-[#313438] focus:outline-none resize-none select-all"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
