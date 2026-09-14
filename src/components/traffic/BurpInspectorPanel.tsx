import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Columns,
  MinusSquare,
  Maximize2,
  Table as TableIcon,
} from 'lucide-react';
import {
  autoDetectCodec,
  decodeText,
  encodeText,
  formatSelectionLength,
  CODEC_OPTIONS,
  CodecType,
} from '../../utils/burpDecoderUtils';
import { InterceptedRequestItem, useInterceptStore } from '../../stores/interceptStore';
import { parseRawHttpRequest, serializeHttpRequest } from '../../utils/repeaterUtils';

export interface InspectorDrilldownTarget {
  section: 'attribute' | 'query' | 'cookie' | 'reqHeader' | 'resHeader';
  index: number;
  name: string;
  value: string;
}

export interface BurpInspectorPanelProps {
  item?: InterceptedRequestItem | null;
  rawRequest?: string;
  rawResponse?: string;
  onUpdateRawRequest?: (newRaw: string) => void;
  selectionText?: string;
  onApplySelectionReplacement?: (newText: string) => void;
  onClose?: () => void;
  className?: string;
}

export const BurpInspectorPanel: React.FC<BurpInspectorPanelProps> = ({
  item,
  rawRequest: propRawRequest,
  rawResponse: propRawResponse,
  onUpdateRawRequest,
  selectionText = '',
  onApplySelectionReplacement,
  onClose,
  className = '',
}) => {
  const interceptStore = useInterceptStore();

  // Active raw request content (from props, or from interceptStore edited request, or from item)
  const activeRawReq = propRawRequest !== undefined ? propRawRequest : (interceptStore.editedRawRequest || item?.rawRequest || '');
  const activeRawRes = propRawResponse !== undefined ? propRawResponse : ((item as any)?.responseRaw || '');

  // 1. Parsed Request Model
  const parsedRequest = useMemo(() => {
    if (!activeRawReq) {
      return {
        method: item?.method || 'GET',
        url: item?.url || '/',
        path: item?.path || '/',
        protocol: item?.protocol || 'HTTP/1.1',
        queryParams: item?.queryParams || [],
        cookies: item?.cookies || [],
        headers: item?.headers || [],
        body: '',
      };
    }

    try {
      const parsed = parseRawHttpRequest(activeRawReq);
      const qParams: { name: string; value: string }[] = [];
      let pathname = parsed.path || '/';

      const qIdx = parsed.path.indexOf('?');
      if (qIdx !== -1) {
        pathname = parsed.path.substring(0, qIdx);
        const queryStr = parsed.path.substring(qIdx + 1);
        queryStr.split('&').forEach((pair) => {
          if (!pair) return;
          const eq = pair.indexOf('=');
          if (eq === -1) {
            qParams.push({ name: decodeURIComponent(pair), value: '' });
          } else {
            const k = decodeURIComponent(pair.substring(0, eq));
            const v = decodeURIComponent(pair.substring(eq + 1).replace(/\+/g, ' '));
            qParams.push({ name: k, value: v });
          }
        });
      }

      const cookiesList: { name: string; value: string }[] = [];
      const cookieHeader = parsed.headers.find((h) => h.name.toLowerCase() === 'cookie');
      if (cookieHeader) {
        cookieHeader.value.split(';').forEach((c) => {
          const trimmed = c.trim();
          if (!trimmed) return;
          const eq = trimmed.indexOf('=');
          if (eq === -1) {
            cookiesList.push({ name: trimmed, value: '' });
          } else {
            cookiesList.push({
              name: trimmed.substring(0, eq).trim(),
              value: trimmed.substring(eq + 1).trim(),
            });
          }
        });
      }

      return {
        method: parsed.method || 'GET',
        url: parsed.path || '/',
        path: pathname || '/',
        protocol: parsed.protocol || 'HTTP/1.1',
        queryParams: qParams,
        cookies: cookiesList,
        headers: parsed.headers,
        body: parsed.body || '',
      };
    } catch {
      return {
        method: item?.method || 'GET',
        url: item?.url || '/',
        path: item?.path || '/',
        protocol: item?.protocol || 'HTTP/1.1',
        queryParams: item?.queryParams || [],
        cookies: item?.cookies || [],
        headers: item?.headers || [],
        body: '',
      };
    }
  }, [activeRawReq, item]);

  // 2. Parsed Response Headers
  const parsedResponseHeaders = useMemo(() => {
    if (!activeRawRes) return [];
    try {
      const firstDoubleNewline = activeRawRes.indexOf('\r\n\r\n');
      const head = firstDoubleNewline !== -1 ? activeRawRes.substring(0, firstDoubleNewline) : activeRawRes;
      const lines = head.split(/\r?\n/).slice(1);
      const resHeaders: { name: string; value: string }[] = [];
      for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon !== -1) {
          resHeaders.push({
            name: line.substring(0, colon).trim(),
            value: line.substring(colon + 1).trim(),
          });
        }
      }
      return resHeaders;
    } catch {
      return [];
    }
  }, [activeRawRes]);

  // Accordion Sections Open/Collapse State
  const [openSections, setOpenSections] = useState<{
    selection: boolean;
    attributes: boolean;
    query: boolean;
    cookies: boolean;
    reqHeaders: boolean;
    resHeaders: boolean;
  }>({
    selection: true,
    attributes: true,
    query: true,
    cookies: true,
    reqHeaders: true,
    resHeaders: true,
  });

  const toggleSection = (sec: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const collapseAll = () => {
    setOpenSections({
      selection: false,
      attributes: false,
      query: false,
      cookies: false,
      reqHeaders: false,
      resHeaders: false,
    });
  };

  const expandAll = () => {
    setOpenSections({
      selection: true,
      attributes: true,
      query: true,
      cookies: true,
      reqHeaders: true,
      resHeaders: true,
    });
  };

  // Drilldown Item State
  const [drilldown, setDrilldown] = useState<InspectorDrilldownTarget | null>(null);
  const [drilldownName, setDrilldownName] = useState('');
  const [drilldownValue, setDrilldownValue] = useState('');

  // When clicking an item to enter drilldown
  const openDrilldown = (target: InspectorDrilldownTarget) => {
    setDrilldown(target);
    setDrilldownName(target.name);
    setDrilldownValue(target.value);
  };

  // Smart Selection State
  const [activeSelection, setActiveSelection] = useState(selectionText);
  const [codec, setCodec] = useState<CodecType>('url');
  const [decodedValue, setDecodedValue] = useState('');

  // Sync selection text updates
  useEffect(() => {
    if (selectionText && selectionText.trim()) {
      setActiveSelection(selectionText);
      const detected = autoDetectCodec(selectionText);
      setCodec(detected);
      setDecodedValue(decodeText(selectionText, detected));
      setOpenSections((prev) => ({ ...prev, selection: true }));
    }
  }, [selectionText]);

  // Re-decode when codec changes
  const handleCodecChange = (newCodec: CodecType) => {
    setCodec(newCodec);
    setDecodedValue(decodeText(activeSelection, newCodec));
  };

  // Apply Selection Replacement
  const handleApplySelection = () => {
    if (!onApplySelectionReplacement) return;
    const encoded = encodeText(decodedValue, codec);
    onApplySelectionReplacement(encoded);
    setActiveSelection('');
  };

  // Helper to commit mutated request back upstream
  const commitRequestMutation = (updates: {
    method?: string;
    protocol?: string;
    path?: string;
    queryParams?: { name: string; value: string }[];
    cookies?: { name: string; value: string }[];
    headers?: { name: string; value: string }[];
  }) => {
    const finalMethod = updates.method ?? parsedRequest.method;
    const finalProtocol = updates.protocol ?? parsedRequest.protocol;
    const finalPathBase = updates.path ?? parsedRequest.path;
    const finalQueryParams = updates.queryParams ?? parsedRequest.queryParams;
    const finalCookies = updates.cookies ?? parsedRequest.cookies;
    let finalHeaders = updates.headers ? [...updates.headers] : [...parsedRequest.headers];

    // Rebuild full query string
    let fullPath = finalPathBase;
    if (finalQueryParams.length > 0) {
      const qStr = finalQueryParams
        .map((q) => `${encodeURIComponent(q.name)}=${encodeURIComponent(q.value).replace(/%20/g, '+')}`)
        .join('&');
      fullPath = `${finalPathBase}?${qStr}`;
    }

    // Rebuild Cookie header if cookies were changed
    if (updates.cookies) {
      const cookieHeaderIdx = finalHeaders.findIndex((h) => h.name.toLowerCase() === 'cookie');
      if (finalCookies.length > 0) {
        const cookieVal = finalCookies.map((c) => `${c.name}=${c.value}`).join('; ');
        if (cookieHeaderIdx !== -1) {
          finalHeaders[cookieHeaderIdx] = { name: finalHeaders[cookieHeaderIdx].name, value: cookieVal };
        } else {
          finalHeaders.push({ name: 'Cookie', value: cookieVal });
        }
      } else if (cookieHeaderIdx !== -1) {
        finalHeaders = finalHeaders.filter((_, idx) => idx !== cookieHeaderIdx);
      }
    }

    // Rebuild serialized raw HTTP request string
    const headerRowItems = finalHeaders.map((h, idx) => ({
      id: (h as any).id || `h-${idx}`,
      name: h.name,
      value: h.value,
      enabled: (h as any).enabled !== false,
    }));

    const newRaw = serializeHttpRequest(
      finalMethod as any,
      fullPath,
      finalProtocol as any,
      headerRowItems,
      parsedRequest.body
    );

    if (onUpdateRawRequest) {
      onUpdateRawRequest(newRaw);
    } else {
      interceptStore.updateEditedRawRequest(newRaw);
    }
  };

  // Commit Drilldown Edit
  const handleSaveDrilldown = (newName: string, newVal: string) => {
    if (!drilldown) return;
    setDrilldown((prev) => (prev ? { ...prev, name: newName, value: newVal } : null));

    if (drilldown.section === 'attribute') {
      if (drilldown.name === 'Method') {
        commitRequestMutation({ method: newVal.trim().toUpperCase() });
      } else if (drilldown.name === 'Path') {
        commitRequestMutation({ path: newVal.trim() });
      }
    } else if (drilldown.section === 'query') {
      const nextParams = [...parsedRequest.queryParams];
      if (drilldown.index < nextParams.length) {
        nextParams[drilldown.index] = { name: newName, value: newVal };
      } else {
        nextParams.push({ name: newName, value: newVal });
      }
      commitRequestMutation({ queryParams: nextParams });
    } else if (drilldown.section === 'cookie') {
      const nextCookies = [...parsedRequest.cookies];
      if (drilldown.index < nextCookies.length) {
        nextCookies[drilldown.index] = { name: newName, value: newVal };
      } else {
        nextCookies.push({ name: newName, value: newVal });
      }
      commitRequestMutation({ cookies: nextCookies });
    } else if (drilldown.section === 'reqHeader') {
      const nextHeaders = [...parsedRequest.headers];
      if (drilldown.index < nextHeaders.length) {
        nextHeaders[drilldown.index] = { name: newName, value: newVal };
      } else {
        nextHeaders.push({ name: newName, value: newVal });
      }
      commitRequestMutation({ headers: nextHeaders });
    }
  };

  // Prev / Next item navigation within drilldown
  const handleNavDrilldown = (dir: -1 | 1) => {
    if (!drilldown) return;
    let listLength = 0;

    if (drilldown.section === 'query') listLength = parsedRequest.queryParams.length;
    else if (drilldown.section === 'cookie') listLength = parsedRequest.cookies.length;
    else if (drilldown.section === 'reqHeader') listLength = parsedRequest.headers.length;
    else if (drilldown.section === 'resHeader') listLength = parsedResponseHeaders.length;

    if (listLength === 0) return;
    const nextIdx = (drilldown.index + dir + listLength) % listLength;

    let targetItem = { name: '', value: '' };
    if (drilldown.section === 'query') targetItem = parsedRequest.queryParams[nextIdx];
    else if (drilldown.section === 'cookie') targetItem = parsedRequest.cookies[nextIdx];
    else if (drilldown.section === 'reqHeader') targetItem = parsedRequest.headers[nextIdx];
    else if (drilldown.section === 'resHeader') targetItem = parsedResponseHeaders[nextIdx];

    setDrilldown({
      section: drilldown.section,
      index: nextIdx,
      name: targetItem.name,
      value: targetItem.value,
    });
    setDrilldownName(targetItem.name);
    setDrilldownValue(targetItem.value);
  };

  return (
    <div className={`flex flex-col h-full bg-[#1e1f22] text-[#dfdfdf] border-l border-[#2b2d30] overflow-hidden select-none text-xs font-sans ${className}`}>
      {/* 1. Main Inspector Header Bar matching media_1788639123892.png */}
      <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-3 flex-shrink-0 text-[#9da5b4]">
        <div className="flex items-center gap-1.5 font-bold text-white text-xs">
          <span>Inspector</span>
        </div>

        <div className="flex items-center gap-1 text-[#9da5b4]">
          {/* Dock / Expand Icon */}
          <button className="p-1 hover:text-white rounded transition-colors" title="Toggle Dock Split">
            <Columns className="w-3.5 h-3.5" />
          </button>
          {/* Collapse/Expand All */}
          <button onClick={collapseAll} className="p-1 hover:text-white rounded transition-colors" title="Collapse all">
            <MinusSquare className="w-3.5 h-3.5" />
          </button>
          <button onClick={expandAll} className="p-1 hover:text-white rounded transition-colors" title="Expand all">
            <Maximize2 className="w-3 h-3" />
          </button>
          {/* Close Panel */}
          {onClose && (
            <button onClick={onClose} className="p-1 hover:text-white rounded transition-colors ml-1" title="Close Inspector">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Content Area: Either DRILLDOWN VIEW or ACCORDION SECTIONS */}
      {drilldown ? (
        /* ====================================================================== */
        /* DRILLDOWN DETAIL VIEW (Matching media_1788639203150.png)              */
        /* ====================================================================== */
        <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#1e1f22] space-y-3">
          {/* Drilldown Sub-Header with Back and Prev/Next */}
          <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2">
            <button
              onClick={() => setDrilldown(null)}
              className="flex items-center gap-1 text-xs font-semibold text-[#38bdf8] hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleNavDrilldown(-1)}
                className="p-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#9da5b4] hover:text-white border border-[#3e4249]"
                title="Previous item"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleNavDrilldown(1)}
                className="p-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#9da5b4] hover:text-white border border-[#3e4249]"
                title="Next item"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-[#9da5b4] capitalize">
            {drilldown.section === 'query'
              ? 'Query parameter'
              : drilldown.section === 'cookie'
              ? 'Cookie'
              : drilldown.section === 'reqHeader'
              ? 'Request header'
              : drilldown.section === 'resHeader'
              ? 'Response header'
              : 'Attribute'}
          </span>

          {/* Name Field */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#8c9099] font-medium block">Name</label>
            <input
              type="text"
              value={drilldownName}
              disabled={drilldown.section === 'attribute' || drilldown.section === 'resHeader'}
              onChange={(e) => {
                setDrilldownName(e.target.value);
                handleSaveDrilldown(e.target.value, drilldownValue);
              }}
              className="w-full bg-[#141517] text-white px-2.5 py-1.5 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none font-mono text-xs"
            />
          </div>

          {/* Value Field */}
          <div className="space-y-1 flex-1 flex flex-col">
            <label className="text-[11px] text-[#8c9099] font-medium block">Value</label>
            <textarea
              value={drilldownValue}
              disabled={drilldown.section === 'resHeader'}
              onChange={(e) => {
                setDrilldownValue(e.target.value);
                handleSaveDrilldown(drilldownName, e.target.value);
              }}
              rows={8}
              className="w-full flex-1 bg-[#141517] text-white p-2.5 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none font-mono text-xs resize-y leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        /* ====================================================================== */
        /* MAIN ACCORDIONS VIEW (Matching media_1788639123892.png)               */
        /* ====================================================================== */
        <div className="flex-1 overflow-y-auto divide-y divide-[#2b2d30]">
          {/* ================================================================= */}
          {/* SECTION 1: SELECTION SMART AUTO-DECODER (media_1788639389280.png) */}
          {/* ================================================================= */}
          {activeSelection && (
            <div>
              <div
                onClick={() => toggleSection('selection')}
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#282b30] text-[#dfdfdf] text-xs font-semibold bg-[#232529]/60"
              >
                <span>Selection</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#8c9099] font-mono text-[11px] bg-[#141517] px-1.5 py-0.5 rounded border border-[#2b2d30]">
                    {formatSelectionLength(activeSelection)}
                  </span>
                  {openSections.selection ? <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8c9099]" />}
                </div>
              </div>

              {openSections.selection && (
                <div className="p-3 bg-[#141517] space-y-3 border-t border-[#282b30]">
                  {/* Selected Raw Box */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#8c9099]">Selected text</span>
                    <div className="p-2 bg-[#1e1f22] rounded border border-[#2b2d30] font-mono text-xs text-[#dfdfdf] break-all max-h-24 overflow-y-auto">
                      {activeSelection}
                    </div>
                  </div>

                  {/* Decoded Selector Strip */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-[#8c9099]">Decoded from:</span>
                      <select
                        value={codec}
                        onChange={(e) => handleCodecChange(e.target.value as CodecType)}
                        style={{ colorScheme: 'dark' }}
                        className="bg-[#2b2d30] text-white font-medium px-2 py-0.5 rounded border border-[#3e4249] outline-none text-xs"
                      >
                        {CODEC_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#2b2d30] text-[#dfdfdf]">
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button className="p-0.5 text-[#8c9099] hover:text-white" title="Add transformation layer">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Decoded Content Textarea */}
                  <textarea
                    value={decodedValue}
                    onChange={(e) => setDecodedValue(e.target.value)}
                    rows={4}
                    className="w-full bg-[#1e1f22] text-[#34d399] font-mono text-xs p-2 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none resize-none leading-relaxed"
                    spellCheck={false}
                  />

                  {/* Cancel / Apply Changes Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setActiveSelection('')}
                      className="px-3 py-1 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#dfdfdf] text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplySelection}
                      className="px-3 py-1 rounded bg-[#f37021] hover:bg-[#e05d06] text-white text-xs font-bold transition-colors shadow-sm"
                    >
                      Apply changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 2: REQUEST ATTRIBUTES (media_1788639163233.png)           */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => toggleSection('attributes')}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#282b30] text-[#dfdfdf] text-xs font-medium"
            >
              <span>Request attributes</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8c9099] font-mono text-[11px] bg-[#141517] px-1.5 py-0.5 rounded border border-[#2b2d30]">
                  2
                </span>
                {openSections.attributes ? <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8c9099]" />}
              </div>
            </div>

            {openSections.attributes && (
              <div className="px-3 pb-3 pt-1 space-y-2.5 bg-[#141517] border-t border-[#282b30]">
                {/* Protocol Toggle Buttons */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#8c9099]">Protocol</span>
                  <div className="inline-flex rounded bg-[#2b2d30] p-0.5 border border-[#3e4249]">
                    <button
                      onClick={() => commitRequestMutation({ protocol: 'HTTP/1.1' })}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                        parsedRequest.protocol.includes('1.') ? 'bg-[#f37021] text-white' : 'text-[#8c9099] hover:text-white'
                      }`}
                    >
                      HTTP/1
                    </button>
                    <button
                      onClick={() => commitRequestMutation({ protocol: 'HTTP/2' })}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                        parsedRequest.protocol.includes('2') ? 'bg-[#f37021] text-white' : 'text-[#8c9099] hover:text-white'
                      }`}
                    >
                      HTTP/2
                    </button>
                  </div>
                </div>

                {/* Attributes Table */}
                <div className="border border-[#2b2d30] rounded overflow-hidden">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#1e1f22] text-[#8c9099] border-b border-[#2b2d30] text-[11px]">
                      <tr>
                        <th className="px-2.5 py-1 w-24">Name</th>
                        <th className="px-2.5 py-1">Value</th>
                        <th className="px-1.5 py-1 w-6 text-right">
                          <TableIcon className="w-3 h-3 text-[#6f737a]" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232529]">
                      <tr
                        onClick={() =>
                          openDrilldown({
                            section: 'attribute',
                            index: 0,
                            name: 'Method',
                            value: parsedRequest.method,
                          })
                        }
                        className="cursor-pointer hover:bg-[#282b30] group transition-colors"
                      >
                        <td className="px-2.5 py-1.5 text-[#dfdfdf]">Method</td>
                        <td className="px-2.5 py-1.5 text-[#f37021] font-bold">{parsedRequest.method}</td>
                        <td className="px-1.5 py-1.5 text-right text-[#6f737a] group-hover:text-white">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </td>
                      </tr>
                      <tr
                        onClick={() =>
                          openDrilldown({
                            section: 'attribute',
                            index: 1,
                            name: 'Path',
                            value: parsedRequest.path,
                          })
                        }
                        className="cursor-pointer hover:bg-[#282b30] group transition-colors"
                      >
                        <td className="px-2.5 py-1.5 text-[#dfdfdf]">Path</td>
                        <td className="px-2.5 py-1.5 text-[#38bdf8] truncate max-w-[150px]">{parsedRequest.path}</td>
                        <td className="px-1.5 py-1.5 text-right text-[#6f737a] group-hover:text-white">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 3: REQUEST QUERY PARAMETERS (media_1788639172525.png)     */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => toggleSection('query')}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#282b30] text-[#dfdfdf] text-xs font-medium"
            >
              <span>Request query parameters</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8c9099] font-mono text-[11px] bg-[#141517] px-1.5 py-0.5 rounded border border-[#2b2d30]">
                  {parsedRequest.queryParams.length}
                </span>
                {openSections.query ? <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8c9099]" />}
              </div>
            </div>

            {openSections.query && (
              <div className="px-3 pb-3 pt-1 bg-[#141517] border-t border-[#282b30]">
                {parsedRequest.queryParams.length === 0 ? (
                  <div className="text-[#6f737a] italic py-2 text-center text-xs">No query parameters in request</div>
                ) : (
                  <div className="border border-[#2b2d30] rounded overflow-hidden">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#1e1f22] text-[#8c9099] border-b border-[#2b2d30] text-[11px]">
                        <tr>
                          <th className="px-2.5 py-1 w-24">Name</th>
                          <th className="px-2.5 py-1">Value</th>
                          <th className="px-1.5 py-1 w-6 text-right">
                            <TableIcon className="w-3 h-3 text-[#6f737a]" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232529]">
                        {parsedRequest.queryParams.map((q, idx) => (
                          <tr
                            key={idx}
                            onClick={() =>
                              openDrilldown({
                                section: 'query',
                                index: idx,
                                name: q.name,
                                value: q.value,
                              })
                            }
                            className="cursor-pointer hover:bg-[#282b30] group transition-colors"
                          >
                            <td className="px-2.5 py-1.5 text-white font-medium truncate max-w-[90px]" title={q.name}>
                              {q.name}
                            </td>
                            <td className="px-2.5 py-1.5 text-[#dfdfdf] truncate max-w-[140px]" title={q.value}>
                              {q.value || <span className="text-[#6f737a] italic">empty</span>}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-[#6f737a] group-hover:text-white">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Query Parameter Button */}
                <button
                  onClick={() =>
                    openDrilldown({
                      section: 'query',
                      index: parsedRequest.queryParams.length,
                      name: 'new_param',
                      value: '',
                    })
                  }
                  className="flex items-center gap-1 text-[11px] text-[#9da5b4] hover:text-[#f37021] pt-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add query parameter</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 4: REQUEST COOKIES                                        */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => toggleSection('cookies')}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#282b30] text-[#dfdfdf] text-xs font-medium"
            >
              <span>Request cookies</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8c9099] font-mono text-[11px] bg-[#141517] px-1.5 py-0.5 rounded border border-[#2b2d30]">
                  {parsedRequest.cookies.length}
                </span>
                {openSections.cookies ? <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8c9099]" />}
              </div>
            </div>

            {openSections.cookies && (
              <div className="px-3 pb-3 pt-1 bg-[#141517] border-t border-[#282b30]">
                {parsedRequest.cookies.length === 0 ? (
                  <div className="text-[#6f737a] italic py-2 text-center text-xs">No cookies in request</div>
                ) : (
                  <div className="border border-[#2b2d30] rounded overflow-hidden">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#1e1f22] text-[#8c9099] border-b border-[#2b2d30] text-[11px]">
                        <tr>
                          <th className="px-2.5 py-1 w-24">Name</th>
                          <th className="px-2.5 py-1">Value</th>
                          <th className="px-1.5 py-1 w-6 text-right">
                            <TableIcon className="w-3 h-3 text-[#6f737a]" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232529]">
                        {parsedRequest.cookies.map((c, idx) => (
                          <tr
                            key={idx}
                            onClick={() =>
                              openDrilldown({
                                section: 'cookie',
                                index: idx,
                                name: c.name,
                                value: c.value,
                              })
                            }
                            className="cursor-pointer hover:bg-[#282b30] group transition-colors"
                          >
                            <td className="px-2.5 py-1.5 text-white font-medium truncate max-w-[90px]" title={c.name}>
                              {c.name}
                            </td>
                            <td className="px-2.5 py-1.5 text-[#eab308] truncate max-w-[140px]" title={c.value}>
                              {c.value}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-[#6f737a] group-hover:text-white">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Cookie Button */}
                <button
                  onClick={() =>
                    openDrilldown({
                      section: 'cookie',
                      index: parsedRequest.cookies.length,
                      name: 'new_cookie',
                      value: '',
                    })
                  }
                  className="flex items-center gap-1 text-[11px] text-[#9da5b4] hover:text-[#f37021] pt-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add cookie</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 5: REQUEST HEADERS                                        */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => toggleSection('reqHeaders')}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#282b30] text-[#dfdfdf] text-xs font-medium"
            >
              <span>Request headers</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8c9099] font-mono text-[11px] bg-[#141517] px-1.5 py-0.5 rounded border border-[#2b2d30]">
                  {parsedRequest.headers.length}
                </span>
                {openSections.reqHeaders ? <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8c9099]" />}
              </div>
            </div>

            {openSections.reqHeaders && (
              <div className="px-3 pb-3 pt-1 bg-[#141517] border-t border-[#282b30]">
                {parsedRequest.headers.length === 0 ? (
                  <div className="text-[#6f737a] italic py-2 text-center text-xs">No request headers</div>
                ) : (
                  <div className="border border-[#2b2d30] rounded overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#1e1f22] text-[#8c9099] border-b border-[#2b2d30] text-[11px] sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1 w-28">Name</th>
                          <th className="px-2.5 py-1">Value</th>
                          <th className="px-1.5 py-1 w-6 text-right">
                            <TableIcon className="w-3 h-3 text-[#6f737a]" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232529]">
                        {parsedRequest.headers.map((h, idx) => (
                          <tr
                            key={idx}
                            onClick={() =>
                              openDrilldown({
                                section: 'reqHeader',
                                index: idx,
                                name: h.name,
                                value: h.value,
                              })
                            }
                            className="cursor-pointer hover:bg-[#282b30] group transition-colors"
                          >
                            <td className="px-2.5 py-1.5 text-white font-medium truncate max-w-[100px]" title={h.name}>
                              {h.name}
                            </td>
                            <td className="px-2.5 py-1.5 text-[#dfdfdf] truncate max-w-[140px]" title={h.value}>
                              {h.value}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-[#6f737a] group-hover:text-white">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Header Button */}
                <button
                  onClick={() =>
                    openDrilldown({
                      section: 'reqHeader',
                      index: parsedRequest.headers.length,
                      name: 'X-New-Header',
                      value: '',
                    })
                  }
                  className="flex items-center gap-1 text-[11px] text-[#9da5b4] hover:text-[#f37021] pt-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add header</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 6: RESPONSE HEADERS                                       */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => toggleSection('resHeaders')}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#282b30] text-[#dfdfdf] text-xs font-medium"
            >
              <span>Response headers</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8c9099] font-mono text-[11px] bg-[#141517] px-1.5 py-0.5 rounded border border-[#2b2d30]">
                  {parsedResponseHeaders.length}
                </span>
                {openSections.resHeaders ? <ChevronDown className="w-3.5 h-3.5 text-[#8c9099]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8c9099]" />}
              </div>
            </div>

            {openSections.resHeaders && (
              <div className="px-3 pb-3 pt-1 bg-[#141517] border-t border-[#282b30]">
                {parsedResponseHeaders.length === 0 ? (
                  <div className="text-[#6f737a] italic py-2 text-center text-xs">No response headers captured</div>
                ) : (
                  <div className="border border-[#2b2d30] rounded overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#1e1f22] text-[#8c9099] border-b border-[#2b2d30] text-[11px] sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1 w-28">Name</th>
                          <th className="px-2.5 py-1">Value</th>
                          <th className="px-1.5 py-1 w-6 text-right">
                            <TableIcon className="w-3 h-3 text-[#6f737a]" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232529]">
                        {parsedResponseHeaders.map((h, idx) => (
                          <tr
                            key={idx}
                            onClick={() =>
                              openDrilldown({
                                section: 'resHeader',
                                index: idx,
                                name: h.name,
                                value: h.value,
                              })
                            }
                            className="cursor-pointer hover:bg-[#282b30] group transition-colors"
                          >
                            <td className="px-2.5 py-1.5 text-white font-medium truncate max-w-[100px]" title={h.name}>
                              {h.name}
                            </td>
                            <td className="px-2.5 py-1.5 text-[#dfdfdf] truncate max-w-[140px]" title={h.value}>
                              {h.value}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-[#6f737a] group-hover:text-white">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
