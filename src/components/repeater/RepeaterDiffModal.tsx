import React, { useState } from 'react';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { Modal } from '../../design-system/Modal';
import { Select } from '../../design-system/Select';
import { DiffViewer } from '../../design-system/DiffViewer';

export const RepeaterDiffModal: React.FC = () => {
  const {
    tabs,
    activeTabId,
    isDiffModalOpen,
    diffRevisionA,
    diffRevisionB,
    closeDiffModal,
  } = useRepeaterStore();

  const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [diffTarget, setDiffTarget] = useState<'response_body' | 'headers' | 'request_body' | 'full'>('response_body');
  const [selectedRevAId, setSelectedRevAId] = useState<string>('');
  const [selectedRevBId, setSelectedRevBId] = useState<string>('');

  if (!isDiffModalOpen) return null;

  const history = tab?.history || [];
  const revA =
    history.find((h) => h.revisionId === selectedRevAId) ||
    diffRevisionA ||
    (tab?.baselineRevisionIndex !== null && tab?.baselineRevisionIndex !== undefined ? history[tab.baselineRevisionIndex] : history[0]);

  const revB =
    history.find((h) => h.revisionId === selectedRevBId) ||
    diffRevisionB ||
    tab?.lastExecutionOutput ||
    (history.length > 0 ? history[history.length - 1] : null);

  const revOptions = history.map((h) => ({
    label: `Rev #${h.revisionNumber} (${h.statusCode || 'ERR'}, ${h.durationMs}ms) - ${h.timestamp}`,
    value: h.revisionId,
  }));

  // Resolve content based on diff target
  let originalContent = '';
  let modifiedContent = '';

  if (revA && revB) {
    if (diffTarget === 'response_body') {
      originalContent = revA.responseBody || '';
      modifiedContent = revB.responseBody || '';
    } else if (diffTarget === 'headers') {
      originalContent = (revA.responseHeaders || []).map((h) => `${h.name}: ${h.value}`).join('\n');
      modifiedContent = (revB.responseHeaders || []).map((h) => `${h.name}: ${h.value}`).join('\n');
    } else if (diffTarget === 'request_body') {
      originalContent = revA.requestBody || '';
      modifiedContent = revB.requestBody || '';
    } else {
      originalContent = revA.responseRaw || '';
      modifiedContent = revB.responseRaw || '';
    }
  }

  const durationDelta = revA && revB ? revB.durationMs - revA.durationMs : 0;
  const sizeDelta = revA && revB ? (revB.sizeBytes || 0) - (revA.sizeBytes || 0) : 0;

  return (
    <Modal
      isOpen={isDiffModalOpen}
      onClose={closeDiffModal}
      title="Differential Response Comparator (Ctrl+D)"
      size="xl"
    >
      <div className="flex flex-col h-[75vh] space-y-3 select-none">
        {/* Selector Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2.5 bg-bg-panel border border-border-subtle rounded-lg text-xs font-mono">
          {/* Revision A Selector */}
          <div className="space-y-1">
            <span className="text-text-muted font-bold">Revision A (Baseline)</span>
            <Select
              options={revOptions.length > 0 ? revOptions : [{ label: 'Baseline', value: '' }]}
              value={revA?.revisionId || ''}
              onChange={(e) => setSelectedRevAId(e.target.value)}
              className="w-full text-xs font-mono"
            />
          </div>

          {/* Revision B Selector */}
          <div className="space-y-1">
            <span className="text-text-muted font-bold">Revision B (Target)</span>
            <Select
              options={revOptions.length > 0 ? revOptions : [{ label: 'Latest', value: '' }]}
              value={revB?.revisionId || ''}
              onChange={(e) => setSelectedRevBId(e.target.value)}
              className="w-full text-xs font-mono"
            />
          </div>

          {/* Target Section Selector */}
          <div className="space-y-1">
            <span className="text-text-muted font-bold">Comparison Target</span>
            <Select
              options={[
                { label: 'Response Body', value: 'response_body' },
                { label: 'Response Headers', value: 'headers' },
                { label: 'Request Body', value: 'request_body' },
                { label: 'Full Raw Response', value: 'full' },
              ]}
              value={diffTarget}
              onChange={(e) => setDiffTarget(e.target.value as any)}
              className="w-full text-xs font-mono"
            />
          </div>
        </div>

        {/* Delta Metrics Bar */}
        {revA && revB && (
          <div className="flex items-center gap-4 px-3 py-1.5 bg-bg-canvas border border-border-subtle rounded text-xs font-mono text-text-secondary flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">Status:</span>
              <span className="text-text-primary">{revA.statusCode || 'ERR'}</span>
              <span>→</span>
              <span className="text-text-primary">{revB.statusCode || 'ERR'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">Latency Δ:</span>
              <span className={durationDelta > 0 ? 'text-amber-400' : durationDelta < 0 ? 'text-emerald-400' : 'text-text-primary'}>
                {durationDelta > 0 ? `+${durationDelta}ms` : `${durationDelta}ms`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">Size Δ:</span>
              <span className={sizeDelta !== 0 ? 'text-accent-cyan' : 'text-text-primary'}>
                {sizeDelta > 0 ? `+${sizeDelta} B` : `${sizeDelta} B`}
              </span>
            </div>
          </div>
        )}

        {/* Diff Viewer Pane */}
        <div className="flex-1 border border-border-subtle rounded-lg overflow-hidden bg-bg-panel">
          {revA && revB ? (
            <DiffViewer
              originalText={originalContent}
              modifiedText={modifiedContent}
              originalTitle={`Rev #${revA.revisionNumber} (${revA.timestamp})`}
              modifiedTitle={`Rev #${revB.revisionNumber} (${revB.timestamp})`}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-xs font-mono">
              Insufficient revisions to perform differential comparison. Run at least 2 executions.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
