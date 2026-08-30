import React, { useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Activity,
  Play,
  Square,
  CheckCircle,
  BarChart2,
  Lock,
} from 'lucide-react';

import { useSequencerStore } from '../stores/sequencerStore';

export const SequencerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { tokenLocation, setTokenLocation, targetUrl, setTargetUrl } = useSequencerStore();

  const [sampleCount, setSampleCount] = useState(20000);
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(100);

  const fipsResults = {
    overallVerdict: 'EXCELLENT',
    entropyBits: 124.8,
    maxEntropy: 128,
    monobitTest: { status: 'PASSED', count: 9982, ideal: 10000 },
    pokerTest: { status: 'PASSED', score: 14.2, threshold: 46.17 },
    runsTest: { status: 'PASSED', maxRun: 14, allowed: 26 },
    longRunTest: { status: 'PASSED', maxContiguous: 18, limit: 34 },
    spectralTest: { status: 'PASSED', pValue: 0.942 },
  };

  const handleStartCapture = () => {
    setIsCapturing(true);
    setProgress(0);
    addToast({ type: 'info', title: 'Sequencer Token Capture Started', description: `Sampling ${sampleCount} tokens from ${tokenLocation}...` });

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCapturing(false);
          addToast({ type: 'success', title: 'Entropy Analysis Complete', description: 'Overall Randomness: EXCELLENT (124.8 bits entropy)' });
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Sequencer Token Randomness & Entropy Analysis</span>
          <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono">
            FIPS 140-2 Statistical Suite
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCapturing ? (
            <Button
              variant="danger"
              size="xs"
              leftIcon={<Square className="w-3 h-3" />}
              onClick={() => setIsCapturing(false)}
            >
              Stop Capture
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              leftIcon={<Play className="w-3 h-3" />}
              onClick={handleStartCapture}
              className="bg-[#f37021] hover:bg-[#e05d06] text-white font-bold"
            >
              Start Live Capture
            </Button>
          )}
        </div>
      </div>

      {/* Target Token Config Strip */}
      <div className="p-3 bg-[#141517] border-b border-[#2b2d30] grid grid-cols-3 gap-3 items-center">
        <div className="flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2">Target:</span>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center bg-[#1e1f22] rounded border border-[#3e4249] px-2.5 py-1">
          <span className="text-[#9da5b4] mr-2">Token Location:</span>
          <input
            type="text"
            value={tokenLocation}
            onChange={(e) => setTokenLocation(e.target.value)}
            className="w-full bg-transparent text-[#f37021] font-mono text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#9da5b4]">Samples:</span>
          <select
            value={sampleCount}
            onChange={(e) => setSampleCount(parseInt(e.target.value))}
            className="bg-[#1e1f22] text-white px-2 py-1 rounded border border-[#3e4249] text-xs focus:outline-none"
          >
            <option value="5000">5,000 samples</option>
            <option value="20000">20,000 samples (FIPS Standard)</option>
            <option value="50000">50,000 samples (Deep Statistical)</option>
          </select>
        </div>
      </div>

      {/* Main Results Dashboard */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Progress Bar */}
        {isCapturing && (
          <div className="p-3 bg-[#141517] rounded border border-[#3e4249] space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white font-semibold">Capturing Live Token Stream...</span>
              <span className="text-[#34d399] font-mono font-bold">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-[#1e1f22] rounded-full overflow-hidden border border-[#3e4249]">
              <div className="h-full bg-[#34d399] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Overall Entropy Score Box */}
        <div className="p-4 bg-[#141517] rounded-lg border border-[#3e4249] flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#34d399]" />
              <span className="text-sm font-bold text-white">Overall Statistical Randomness Quality</span>
            </div>
            <p className="text-xs text-[#9da5b4]">
              Effective entropy calculated across {sampleCount.toLocaleString()} token samples using FIPS 140-2 testing algorithms.
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-extrabold text-[#34d399] font-mono">{fipsResults.overallVerdict}</div>
            <div className="text-xs text-[#dfdfdf] font-mono">{fipsResults.entropyBits} / {fipsResults.maxEntropy} bits of effective entropy</div>
          </div>
        </div>

        {/* FIPS 140-2 Tests Table */}
        <div className="border border-[#3e4249] rounded-lg overflow-hidden bg-[#141517]">
          <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#38bdf8]" />
            <span>FIPS 140-2 Statistical Randomness Tests</span>
          </div>

          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
              <tr>
                <th className="px-3 py-2">Test Name</th>
                <th className="px-3 py-2">Measured Result</th>
                <th className="px-3 py-2">FIPS 140-2 Standard Criteria</th>
                <th className="px-3 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b2d30]">
              <tr className="hover:bg-[#1e1f22]">
                <td className="px-3 py-2 text-white font-bold">Monobit Test (Frequency)</td>
                <td className="px-3 py-2 text-[#38bdf8]">{fipsResults.monobitTest.count} ones</td>
                <td className="px-3 py-2 text-[#9da5b4]">9,725 &lt; count &lt; 10,275</td>
                <td className="px-3 py-2 text-[#34d399] font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> PASSED
                </td>
              </tr>
              <tr className="hover:bg-[#1e1f22]">
                <td className="px-3 py-2 text-white font-bold">Poker Test (4-bit Segments)</td>
                <td className="px-3 py-2 text-[#38bdf8]">{fipsResults.pokerTest.score} score</td>
                <td className="px-3 py-2 text-[#9da5b4]">2.16 &lt; X &lt; 46.17</td>
                <td className="px-3 py-2 text-[#34d399] font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> PASSED
                </td>
              </tr>
              <tr className="hover:bg-[#1e1f22]">
                <td className="px-3 py-2 text-white font-bold">Runs Test</td>
                <td className="px-3 py-2 text-[#38bdf8]">Max run length: {fipsResults.runsTest.maxRun}</td>
                <td className="px-3 py-2 text-[#9da5b4]">Max continuous &le; 26</td>
                <td className="px-3 py-2 text-[#34d399] font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> PASSED
                </td>
              </tr>
              <tr className="hover:bg-[#1e1f22]">
                <td className="px-3 py-2 text-white font-bold">Long Runs Test</td>
                <td className="px-3 py-2 text-[#38bdf8]">Max run length: {fipsResults.longRunTest.maxContiguous}</td>
                <td className="px-3 py-2 text-[#9da5b4]">No contiguous run &gt; 34</td>
                <td className="px-3 py-2 text-[#34d399] font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> PASSED
                </td>
              </tr>
              <tr className="hover:bg-[#1e1f22]">
                <td className="px-3 py-2 text-white font-bold">Discrete Fourier Spectral Test</td>
                <td className="px-3 py-2 text-[#38bdf8]">p-value = {fipsResults.spectralTest.pValue}</td>
                <td className="px-3 py-2 text-[#9da5b4]">p-value &ge; 0.01</td>
                <td className="px-3 py-2 text-[#34d399] font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> PASSED
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
