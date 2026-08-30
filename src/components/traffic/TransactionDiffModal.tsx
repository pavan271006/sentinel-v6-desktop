import React, { useState, useMemo } from 'react';
import { TrafficSummary } from '../../types/traffic';
import { TransactionModel } from '../../types/models';
import { Modal } from '../../design-system/Modal';
import { DiffViewer } from '../../design-system/DiffViewer';
import { MethodBadge, StatusBadge } from '../../design-system/Badge';
import { formatDuration } from '../../design-system/utils';
import { GitCompare, Layers, Shuffle } from 'lucide-react';

export interface TransactionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionA: TrafficSummary | TransactionModel | null;
  transactionB: TrafficSummary | TransactionModel | null;
  allTransactions?: Array<TrafficSummary | TransactionModel>;
  onSelectTransactionA?: (tx: TrafficSummary | TransactionModel) => void;
  onSelectTransactionB?: (tx: TrafficSummary | TransactionModel) => void;
  className?: string;
}

export type DiffTarget = 'response_body' | 'request_body' | 'headers' | 'full';

export const TransactionDiffModal: React.FC<TransactionDiffModalProps> = ({
  isOpen,
  onClose,
  transactionA,
  transactionB,
  allTransactions = [],
  onSelectTransactionA,
  onSelectTransactionB,
  className = '',
}) => {
  const [diffTarget, setDiffTarget] = useState<DiffTarget>('response_body');


  // Fallbacks if no transaction selected
  const txA = transactionA || allTransactions[0] || null;
  const txB = transactionB || allTransactions[1] || allTransactions[0] || null;

  // Extract texts for comparison based on diffTarget
  const { originalText, modifiedText } = useMemo(() => {
    if (!txA || !txB) {
      return { originalText: '', modifiedText: '' };
    }

    if (diffTarget === 'response_body') {
      const getResBody = (tx: any) => {
        if (typeof tx.response?.bodyBytes === 'string') return tx.response.bodyBytes;
        if (tx.response?.bodyText) return tx.response.bodyText;
        return JSON.stringify({ status: tx.status, id: tx.id, url: tx.url, inScope: tx.inScope }, null, 2);
      };
      return {
        originalText: getResBody(txA),
        modifiedText: getResBody(txB),
      };
    }

    if (diffTarget === 'request_body') {
      const getReqBody = (tx: any) => {
        if (typeof tx.request?.bodyBytes === 'string') return tx.request.bodyBytes;
        if (tx.request?.bodyText) return tx.request.bodyText;
        return `${tx.method} ${tx.path || tx.url} HTTP/1.1`;
      };
      return {
        originalText: getReqBody(txA),
        modifiedText: getReqBody(txB),
      };
    }

    if (diffTarget === 'headers') {
      const formatHeaders = (tx: any) => {
        const reqHeaders = tx.request?.headers?.map((h: any) => `REQ: ${h.name}: ${h.value}`).join('\n') || '';
        const resHeaders = tx.response?.headers?.map((h: any) => `RES: ${h.name}: ${h.value}`).join('\n') || '';
        return `=== REQUEST HEADERS ===\n${reqHeaders}\n\n=== RESPONSE HEADERS ===\n${resHeaders}`;
      };
      return {
        originalText: formatHeaders(txA),
        modifiedText: formatHeaders(txB),
      };
    }

    // Full
    const formatFull = (tx: any) => {
      return `[TRANSACTION ${tx.id}]\n${tx.method} ${tx.url}\nStatus: ${tx.status}\nDuration: ${tx.durationMs}ms\nSize: ${tx.sizeBytes} bytes\nInScope: ${tx.inScope}`;
    };
    return {
      originalText: formatFull(txA),
      modifiedText: formatFull(txB),
    };
  }, [txA, txB, diffTarget]);

  const swapTransactions = () => {
    if (onSelectTransactionA && onSelectTransactionB && txA && txB) {
      onSelectTransactionA(txB);
      onSelectTransactionB(txA);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-purple-400" />
          <span>Differential Transaction Inspector</span>
        </div>
      }
      size="full"
      className={className}
    >
      <div className="flex flex-col h-[75vh] w-full overflow-hidden">
        {/* Diff Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-bg-panel border-b border-border-subtle select-none flex-shrink-0 text-xs">
          {/* Transaction Selectors */}
          <div className="flex items-center gap-3">
            {/* Tx A */}
            <div className="flex items-center gap-1.5 p-1 bg-bg-app border border-border-subtle rounded">
              <span className="text-[10px] text-text-muted font-bold uppercase px-1">Baseline A:</span>
              {txA && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <span className="font-bold text-text-primary">{txA.id}</span>
                  <MethodBadge method={txA.method} />
                  <StatusBadge status={txA.status} />
                  <span className="text-text-muted">({formatDuration(txA.durationMs)})</span>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={swapTransactions}
              className="p-1 rounded hover:bg-bg-panel-elevated text-text-muted hover:text-text-primary transition-colors"
              title="Swap Baseline A and Modified B"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Tx B */}
            <div className="flex items-center gap-1.5 p-1 bg-bg-app border border-border-subtle rounded">
              <span className="text-[10px] text-text-muted font-bold uppercase px-1">Modified B:</span>
              {txB && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <span className="font-bold text-text-primary">{txB.id}</span>
                  <MethodBadge method={txB.method} />
                  <StatusBadge status={txB.status} />
                  <span className="text-text-muted">({formatDuration(txB.durationMs)})</span>
                </div>
              )}
            </div>
          </div>

          {/* Diff Target Selectors & Mode */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-bg-app p-0.5 border border-border-subtle rounded">
              <button
                onClick={() => setDiffTarget('response_body')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  diffTarget === 'response_body'
                    ? 'bg-accent-cyan/20 text-accent-cyan font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Response Body
              </button>
              <button
                onClick={() => setDiffTarget('request_body')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  diffTarget === 'request_body'
                    ? 'bg-accent-cyan/20 text-accent-cyan font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Request Body
              </button>
              <button
                onClick={() => setDiffTarget('headers')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  diffTarget === 'headers'
                    ? 'bg-accent-cyan/20 text-accent-cyan font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Headers
              </button>
              <button
                onClick={() => setDiffTarget('full')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  diffTarget === 'full'
                    ? 'bg-accent-cyan/20 text-accent-cyan font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Summary
              </button>
            </div>
          </div>
        </div>

        {/* Diff Viewer Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {txA && txB ? (
            <DiffViewer
              originalText={originalText}
              modifiedText={modifiedText}
              originalTitle={`Baseline: ${txA.id} (${txA.method} - ${txA.status})`}
              modifiedTitle={`Modified: ${txB.id} (${txB.method} - ${txB.status})`}
              initialMode="side-by-side"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Layers className="w-8 h-8 mb-2 opacity-30" />
              <span>Select two transactions to compare</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

