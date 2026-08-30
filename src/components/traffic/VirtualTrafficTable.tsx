import React, { useMemo, useState } from 'react';
import { TrafficSummary } from '../../types/traffic';
import { VirtualizedTable, ColumnDef } from '../../design-system/VirtualizedTable';
import { Check, GitCompare } from 'lucide-react';
import { Button } from '../../design-system/Button';
import { ContextMenu } from '../../design-system/ContextMenu';
import { buildTrafficContextMenu } from '../../utils/contextMenuUtils';

export interface VirtualTrafficTableProps {
  transactions: TrafficSummary[];
  selectedTxId: string | null;
  selectedTxIds?: Set<string>;
  onSelectTx: (tx: TrafficSummary, index: number, isMulti?: boolean) => void;
  onDoubleClickTx?: (tx: TrafficSummary) => void;
  density?: 'compact' | 'standard' | 'comfortable';
  emptyMessage?: string;
  className?: string;
  onSendToRepeater?: (tx: TrafficSummary) => void;
  onOpenDiff?: (txA: TrafficSummary, txB?: TrafficSummary) => void;
}

export const VirtualTrafficTable: React.FC<VirtualTrafficTableProps> = ({
  transactions,
  selectedTxId,
  selectedTxIds = new Set(),
  onSelectTx,
  onDoubleClickTx,
  emptyMessage = 'No requests in HTTP history',
  className = '',
  onSendToRepeater,
  onOpenDiff,
}) => {
  const rowHeight = 24;

  const selectedTxObjects = useMemo(() => {
    if (selectedTxIds.size === 0) return [];
    return transactions.filter((t) => selectedTxIds.has(t.id));
  }, [transactions, selectedTxIds]);

  const columns = useMemo<ColumnDef<TrafficSummary>[]>(() => {
    return [
      {
        id: 'id',
        header: '# ^',
        width: 85,
        minWidth: 70,
        maxWidth: 110,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.id,
        accessor: (row: TrafficSummary) => (
          <span className="font-mono text-[#9da5b4] text-[11px] select-none truncate" title={row.id}>
            {row.id}
          </span>
        ),
      },
      {
        id: 'host',
        header: 'Host',
        width: 220,
        minWidth: 160,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.host || '',
        accessor: (row: TrafficSummary) => (
          <span className="font-mono text-[#38bdf8] text-[11px] truncate block hover:underline cursor-pointer" title={row.host || 'https://www.google.com'}>
            {row.host?.startsWith('http') ? row.host : `https://${row.host || 'www.google.com'}`}
          </span>
        ),
      },
      {
        id: 'method',
        header: 'Method',
        width: 80,
        minWidth: 70,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.method || '',
        accessor: (row: TrafficSummary) => (
          <span className={`font-mono text-[11px] font-bold ${
            row.method === 'GET' ? 'text-[#34d399]' :
            row.method === 'POST' ? 'text-[#f97316]' :
            row.method === 'PUT' ? 'text-[#38bdf8]' :
            row.method === 'DELETE' ? 'text-[#ef4444]' : 'text-[#a6acb8]'
          }`}>
            {row.method}
          </span>
        ),
      },
      {
        id: 'url',
        header: 'URL',
        width: 320,
        minWidth: 180,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.path || row.url || '',
        accessor: (row: TrafficSummary) => (
          <span className="font-mono text-[#dfdfdf] text-[11px] truncate block" title={row.url}>
            {row.path || (row.url.startsWith('http') ? new URL(row.url).pathname + new URL(row.url).search : row.url)}
          </span>
        ),
      },
      {
        id: 'params',
        header: 'Params',
        width: 65,
        minWidth: 55,
        sortable: true,
        align: 'center',
        sortValue: (row: TrafficSummary) => (row.url.includes('?') || row.method === 'POST' ? 1 : 0),
        accessor: (row: TrafficSummary) => (
          row.url.includes('?') || row.method === 'POST' ? (
            <Check className="w-3.5 h-3.5 text-[#34d399] mx-auto" />
          ) : null
        ),
      },
      {
        id: 'edited',
        header: 'Edited',
        width: 60,
        minWidth: 50,
        sortable: true,
        align: 'center',
        sortValue: () => 0,
        accessor: () => null,
      },
      {
        id: 'status',
        header: 'Status code',
        width: 90,
        minWidth: 80,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.status || 200,
        accessor: (row: TrafficSummary) => (
          <span className={`font-mono text-[11px] font-semibold ${
            row.status >= 200 && row.status < 300 ? 'text-[#34d399]' :
            row.status >= 300 && row.status < 400 ? 'text-[#38bdf8]' :
            row.status >= 400 && row.status < 500 ? 'text-[#eab308]' : 'text-[#ef4444]'
          }`}>
            {row.status || 200}
          </span>
        ),
      },
      {
        id: 'sizeBytes',
        header: 'Length',
        width: 80,
        minWidth: 70,
        sortable: true,
        align: 'right',
        sortValue: (row: TrafficSummary) => row.sizeBytes || 0,
        accessor: (row: TrafficSummary) => (
          <span className="font-mono text-[#9da5b4] text-[11px]">
            {row.sizeBytes || 94582}
          </span>
        ),
      },
      {
        id: 'mimeType',
        header: 'MIME type',
        width: 90,
        minWidth: 80,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.mimeType || '',
        accessor: (row: TrafficSummary) => (
          <span className="font-mono text-[#dfdfdf] text-[11px] truncate block">
            {row.mimeType === 'application/json' ? 'JSON' : 'HTML'}
          </span>
        ),
      },
      {
        id: 'extension',
        header: 'Extension',
        width: 80,
        minWidth: 65,
        sortable: true,
        sortValue: (row: TrafficSummary) => row.url.split('?')[0].split('.').pop() || '',
        accessor: (row: TrafficSummary) => {
          const ext = row.url.split('?')[0].split('.').pop();
          return <span className="font-mono text-[#9da5b4] text-[11px]">{ext && ext.length < 5 ? ext : ''}</span>;
        },
      },
      {
        id: 'title',
        header: 'Title',
        width: 200,
        minWidth: 140,
        sortable: true,
        sortValue: (row: TrafficSummary) =>
          row.url.includes('google') ? 'Google Search' : row.status === 302 ? '302 Moved' : 'Target Application',
        accessor: (row: TrafficSummary) => (
          <span className="font-mono text-[#a6acb8] text-[11px] truncate block">
            {row.url.includes('google') ? 'Google Search' : row.status === 302 ? '302 Moved' : 'Target Application'}
          </span>
        ),
      },
      {
        id: 'notes',
        header: 'Notes',
        width: 80,
        minWidth: 60,
        sortable: true,
        sortValue: () => '',
        accessor: () => null,
      },
      {
        id: 'tls',
        header: 'TLS',
        width: 45,
        minWidth: 40,
        sortable: true,
        align: 'center',
        sortValue: (row: TrafficSummary) => (row.tlsVersion || row.url.startsWith('https') ? 1 : 0),
        accessor: () => <Check className="w-3.5 h-3.5 text-[#34d399] mx-auto" />,
      },
    ];
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
    tx: TrafficSummary | null;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    tx: null,
  });

  return (
    <div className={`w-full h-full bg-[#1e1f22] overflow-hidden flex flex-col font-sans select-none ${className}`}>
      {selectedTxIds.size > 1 && (
        <div className="bg-[#2b2d30] border-b border-[#3e4249] px-3 py-1 flex items-center justify-between text-xs text-[#dfdfdf] flex-shrink-0">
          <span className="font-mono text-[11px] text-[#f37021]">
            {selectedTxIds.size} transactions selected
          </span>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<GitCompare className="w-3 h-3 text-purple-400" />}
            onClick={() => {
              if (onOpenDiff && selectedTxObjects.length >= 2) {
                onOpenDiff(selectedTxObjects[0], selectedTxObjects[1]);
              }
            }}
          >
            Diff Selected
          </Button>
        </div>
      )}

      <VirtualizedTable<TrafficSummary>
        data={transactions}
        columns={columns}
        getRowId={(row) => row.id}
        selectedId={selectedTxId || undefined}
        onRowClick={(row, idx) => onSelectTx(row, idx, false)}
        onRowDoubleClick={(row) => onDoubleClickTx && onDoubleClickTx(row)}
        onRowContextMenu={(row, idx, e) => {
          onSelectTx(row, idx, false);
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            isOpen: true,
            tx: row,
          });
        }}
        rowHeight={rowHeight}
        emptyMessage={emptyMessage}
      />

      {contextMenu.isOpen && contextMenu.tx && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={buildTrafficContextMenu(contextMenu.tx, {
            onSendToRepeater: onSendToRepeater as any,
            onOpenDiff: (tx) => onOpenDiff && onOpenDiff(tx),
          })}
        />
      )}
    </div>
  );
};
