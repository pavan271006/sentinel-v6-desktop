import { TrafficSummary } from '../types/traffic';
import { TransactionModel } from '../types/models';
import { ContextMenuItem } from '../design-system/ContextMenu';
import { useToastStore } from '../stores/toastStore';
import { useAppShellStore } from '../stores/appShellStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { useIntruderStore } from '../stores/intruderStore';
import { useScannerStore } from '../stores/scannerStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { useComparerStore } from '../stores/comparerStore';
import { useDecoderStore } from '../stores/decoderStore';
import { useOrganizerStore } from '../stores/organizerStore';
import { useSqlScannerStore } from '../stores/sqlScannerStore';
import { ipcClient } from '../ipc/client';

export function generateCurlCommand(tx: TrafficSummary | TransactionModel | any): string {
  const req = tx?.request;
  const method = req?.method || tx?.method || 'GET';
  const url = req?.url || tx?.url || '';
  const headers = req?.headers || tx?.reqHeaders || [];
  const body = req?.bodyText || (typeof req?.bodyBytes === 'string' ? req.bodyBytes : '') || tx?.reqBody || '';

  let curl = `curl -i -s -k -X '${method}' \\\n  '${url}'`;
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h.name && h.value) {
        curl += ` \\\n  -H '${h.name}: ${h.value}'`;
      }
    }
  }
  if (body) {
    const escapedBody = body.replace(/'/g, "'\\''");
    curl += ` \\\n  --data-raw '${escapedBody}'`;
  }
  return curl;
}

export function buildTrafficContextMenu(
  tx: TrafficSummary | TransactionModel | any,
  options?: {
    onSendToRepeater?: (tx: any) => void;
    onSendToIntruder?: (tx: any) => void;
    onOpenDiff?: (tx: any) => void;
  }
): ContextMenuItem[] {
  const { addToast } = useToastStore.getState();
  const { setActiveWorkspace } = useAppShellStore.getState();
  const { createTabFromTransaction } = useRepeaterStore.getState();
  const { sendToIntruder } = useIntruderStore.getState();
  const { addScanTarget } = useScannerStore.getState();
  const { sendToSequencer } = useSequencerStore.getState();
  const { sendToComparer } = useComparerStore.getState();
  const { sendToDecoder } = useDecoderStore.getState();
  const { sendToOrganizer } = useOrganizerStore.getState();

  let targetUrl = tx?.url || tx?.request?.url || '';
  const rawReq = tx?.rawRequest || '';
  if (rawReq) {
    const lines = rawReq.split('\n');
    const firstLine = lines[0] || '';
    const match = firstLine.match(/^[A-Z]+\s+([^\s]+)/i);
    let host = '';
    for (const l of lines) {
      const hMatch = l.match(/^Host:\s*([^\r\n]+)/i);
      if (hMatch) {
        host = hMatch[1].trim();
        break;
      }
    }
    if (match && match[1]) {
      const pathPart = match[1];
      if (pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
        targetUrl = pathPart;
      } else if (host) {
        targetUrl = `https://${host}${pathPart.startsWith('/') ? '' : '/'}${pathPart}`;
      }
    }
  }

  const method = tx?.method || tx?.request?.method || 'GET';
  const body = tx?.reqBody || tx?.request?.bodyText || '';

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      addToast({
        type: 'success',
        title: 'Copied to Clipboard',
        description: label,
        duration: 2000,
      });
    }
  };

  return [
    {
      label: 'Scan',
      onClick: () => {
        addScanTarget(tx);
        setActiveWorkspace('scanner');
        addToast({ type: 'info', title: 'Sent to Active Scanner', description: `${method} ${targetUrl}` });
      },
    },
    {
      label: 'Send to Intruder',
      shortcut: 'Ctrl+I',
      onClick: () => {
        if (options?.onSendToIntruder) {
          options.onSendToIntruder(tx);
        } else {
          sendToIntruder(tx);
          addToast({ type: 'success', title: 'Sent to Intruder', description: `${method} ${targetUrl}` });
        }
      },
    },
    {
      label: 'Send to Repeater',
      shortcut: 'Ctrl+R',
      onClick: () => {
        if (options?.onSendToRepeater) {
          options.onSendToRepeater(tx);
        } else {
          createTabFromTransaction(tx);
        }
      },
    },
    {
      label: 'Send to SQL Scanner',
      shortcut: 'Ctrl+U',
      onClick: () => {
        useSqlScannerStore.getState().importFromTransaction(tx);
        setActiveWorkspace('sql');
        addToast({ type: 'success', title: 'Sent to SQL Scanner', description: `${method} ${targetUrl}` });
      },
    },
    {
      label: 'Send to Sequencer',
      onClick: () => {
        sendToSequencer(tx);
        setActiveWorkspace('sequencer');
        addToast({ type: 'info', title: 'Sent to Sequencer', description: targetUrl });
      },
    },
    {
      label: 'Send to Comparer',
      onClick: () => {
        sendToComparer(tx);
        setActiveWorkspace('comparer');
        addToast({ type: 'info', title: 'Sent to Comparer', description: 'Populated diff buffer' });
      },
    },
    {
      label: 'Send to Decoder',
      onClick: () => {
        sendToDecoder(body || targetUrl);
        setActiveWorkspace('decoder');
        addToast({ type: 'info', title: 'Sent to Decoder', description: 'Transferred payload data' });
      },
    },
    {
      label: 'Send to Organizer',
      shortcut: 'Ctrl+O',
      onClick: () => {
        sendToOrganizer(tx);
        setActiveWorkspace('organizer');
        addToast({ type: 'success', title: 'Added to Organizer', description: `${method} ${targetUrl}` });
      },
    },
    { divider: true },
    {
      label: 'Open response in browser',
      onClick: async () => {
        const responseBody = tx?.response?.bodyText || tx?.resBody || '';
        if (responseBody) {
          try {
            await ipcClient.openHtmlInBrowser(responseBody, targetUrl, 8085);
            addToast({ type: 'success', title: 'Opened Response in Browser', description: 'Rendered latest HTTP response body in browser' });
            return;
          } catch {}
        }
        if (targetUrl) {
          try {
            await ipcClient.launchSystemBrowser(targetUrl, 8085);
            addToast({ type: 'success', title: 'Opened in Browser', description: targetUrl });
          } catch {
            window.open(targetUrl, '_blank');
          }
        }
      },
    },
    {
      label: 'Request in browser',
      onClick: async () => {
        if (targetUrl) {
          try {
            await ipcClient.launchSystemBrowser(targetUrl, 8085);
            addToast({ type: 'success', title: 'Requested in Browser', description: targetUrl });
          } catch {
            window.open(targetUrl, '_blank');
          }
        }
      },
    },
    { divider: true },
    {
      label: 'Copy URL',
      onClick: () => {
        copyToClipboard(targetUrl, targetUrl);
      },
    },
    {
      label: 'Copy as curl command (bash)',
      onClick: () => {
        const curl = generateCurlCommand(tx);
        copyToClipboard(curl, 'cURL command generated');
      },
    },
    {
      label: 'Copy raw request',
      onClick: () => {
        const headers = tx?.request?.headers || tx?.reqHeaders || [];
        const headerLines = Array.isArray(headers) ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n') : '';
        const body = tx?.request?.bodyText || tx?.reqBody || '';
        const pathPart = targetUrl.replace(/^https?:\/\/[^/]+/, '') || '/';
        const method = tx?.request?.method || tx?.method || 'GET';
        const raw = `${method} ${pathPart} HTTP/1.1\r\n${headerLines}\r\n\r\n${body}`;
        copyToClipboard(raw, 'Raw request copied');
      },
    },
    {
      label: 'Copy raw response',
      onClick: () => {
        const headers = tx?.response?.headers || tx?.resHeaders || [];
        const headerLines = Array.isArray(headers) ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n') : '';
        const body = tx?.response?.bodyText || tx?.resBody || '';
        const status = tx?.response?.statusCode || tx?.status || 200;
        const raw = `HTTP/1.1 ${status} OK\r\n${headerLines}\r\n\r\n${body}`;
        copyToClipboard(raw, 'Raw response copied');
      },
    },
  ];
}
