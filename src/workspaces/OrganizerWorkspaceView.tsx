import React from 'react';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../design-system/Button';
import {
  Bookmark,
  Trash2,
  Tag,
  Plus,
} from 'lucide-react';

import { useOrganizerStore, OrganizedItem } from '../stores/organizerStore';

export const OrganizerWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    addItem,
    updateNotes,
    updateStatusTag,
    deleteItem,
  } = useOrganizerStore();

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleUpdateNotes = (notes: string) => {
    updateNotes(selectedItemId, notes);
  };

  const handleUpdateStatus = (statusTag: OrganizedItem['statusTag']) => {
    updateStatusTag(selectedItemId, statusTag);
    addToast({ type: 'success', title: `Updated status to ${statusTag}` });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header Toolbar */}
      <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-[#f37021]" />
          <span className="font-bold text-white text-xs">Burp Suite Organizer Pentest Items Workbench</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<Plus className="w-3 h-3" />}
            onClick={() => {
              addItem({
                title: 'New Investigation Finding',
                url: 'https://target.local/api/v1/auth/reset',
                method: 'POST',
                statusTag: 'To Investigate',
                notes: 'Enter pentester notes here...',
              });
              addToast({ type: 'success', title: 'Added Item to Organizer' });
            }}
          >
            Add Item
          </Button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Saved Items Table */}
        <div className="w-1/2 flex flex-col border-r border-[#2b2d30] bg-[#141517]">
          <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex justify-between">
            <span>Organized Requests ({items.length})</span>
            <span className="text-[10px] text-[#9da5b4]">Click item to edit notes</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] border-b border-[#3e4249]">
                <tr>
                  <th className="px-3 py-1.5 w-10">#</th>
                  <th className="px-3 py-1.5">Finding Title</th>
                  <th className="px-3 py-1.5 w-16">Method</th>
                  <th className="px-3 py-1.5 w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d30]">
                {items.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#282b30] text-white font-medium' : 'hover:bg-[#1e1f22] text-[#dfdfdf]'
                      }`}
                    >
                      <td className="px-3 py-2 text-[#6f737a]">{item.id}</td>
                      <td className="px-3 py-2">
                        <div className="text-white font-bold">{item.title}</div>
                        <div className="text-[11px] text-[#38bdf8] truncate">{item.url}</div>
                      </td>
                      <td className="px-3 py-2 text-[#34d399] font-bold">{item.method}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.statusTag === 'High Priority' ? 'bg-[#ef4444] text-white' :
                          item.statusTag === 'Exploited' ? 'bg-[#f97316] text-white' :
                          item.statusTag === 'Reported' ? 'bg-[#34d399] text-black font-bold' :
                          'bg-[#3b82f6] text-white'
                        }`}>
                          {item.statusTag}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Notes & Status Editor */}
        <div className="flex-1 flex flex-col bg-[#1e1f22] p-4 space-y-4 overflow-y-auto">
          {selectedItem && (
            <>
              <div className="flex items-center justify-between border-b border-[#3e4249] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white">{selectedItem.title}</h2>
                  <p className="text-xs text-[#38bdf8] font-mono">{selectedItem.url}</p>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[#9da5b4]" />
                  <select
                    value={selectedItem.statusTag}
                    onChange={(e) => handleUpdateStatus(e.target.value as any)}
                    className="bg-[#141517] text-white px-2.5 py-1 rounded border border-[#3e4249] text-xs font-semibold focus:outline-none"
                  >
                    <option value="To Investigate">To Investigate</option>
                    <option value="High Priority">High Priority</option>
                    <option value="Exploited">Exploited</option>
                    <option value="Reported">Reported</option>
                  </select>
                </div>
              </div>

              {/* Pentester Markdown Notes */}
              <div className="flex-1 flex flex-col space-y-2 min-h-[220px]">
                <label className="text-xs font-semibold text-[#9da5b4]">Pentester Analysis Notes & Proof:</label>
                <textarea
                  value={selectedItem.notes}
                  onChange={(e) => handleUpdateNotes(e.target.value)}
                  className="flex-1 w-full bg-[#141517] text-[#dfdfdf] font-mono text-xs p-3 rounded border border-[#313438] focus:border-[#f37021] focus:outline-none resize-none leading-5"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-[#6f737a]">Saved to local project database</span>
                <Button
                  variant="danger"
                  size="xs"
                  leftIcon={<Trash2 className="w-3 h-3" />}
                  onClick={() => {
                    deleteItem(selectedItemId);
                    addToast({ type: 'info', title: 'Removed item from Organizer' });
                  }}
                >
                  Delete Item
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
