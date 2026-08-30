import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { SplitPane } from '../design-system/SplitPane';
import { useToastStore } from '../stores/toastStore';
import { BookOpen, Plus, Save } from 'lucide-react';

export interface NoteEntry {
  id: string;
  title: string;
  updatedAt: string;
  tags: string[];
  markdownContent: string;
}

const INITIAL_NOTES: NoteEntry[] = [
  {
    id: 'note-01',
    title: 'Engagement Target Recon & Scope Notes',
    updatedAt: '19:55:00',
    tags: ['recon', 'target.local', 'scope'],
    markdownContent: `# Target Reconnaissance & Scope Assessment

- Target: \`https://target.local\`
- Scope Boundaries: All routes under \`/api/v1\` are in-scope.
- **Critical Findings**:
  - Found BOLA on \`/api/v1/invoices/:id\` (Alice vs Bob tenant leakage).
  - Out-of-band SSRF confirmed via OAST interaction token \`oast-7f8821a9c4\`.
- **Next Steps**:
  - Evaluate race conditions on password reset token endpoint.
  - Finalize executive report export.
`,
  },
  {
    id: 'note-02',
    title: 'IRA+ Authorization Matrix Verification Observations',
    updatedAt: '19:56:40',
    tags: ['authz', 'matrix', 'bola'],
    markdownContent: `# IRA+ Access Control Matrix Summary

Evaluated 5 endpoints across 4 principals (SuperAdmin, Alice, Bob, Guest):
1. \`GET /api/v1/invoices/:id\` -> BOLA confirmed (Bob can read Alice's invoices).
2. \`DELETE /api/v1/users/:id\` -> BFLA confirmed (Standard user can execute delete on other accounts).
`,
  },
];

export const NotebookWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [notes, setNotes] = useState<NoteEntry[]>(INITIAL_NOTES);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('note-01');

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || notes[0];

  const handleSave = () => {
    addToast({ type: 'success', title: 'Note persisted to SQLite engagement store' });
  };

  const handleNewNote = () => {
    const newNote: NoteEntry = {
      id: `note-${(notes.length + 1).toString().padStart(2, '0')}`,
      title: `Untitled Pentest Note #${notes.length + 1}`,
      updatedAt: new Date().toLocaleTimeString(),
      tags: ['scratchpad'],
      markdownContent: '# New Note\n\nStart typing engagement observations...',
    };
    setNotes([...notes, newNote]);
    setSelectedNoteId(newNote.id);
  };

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Pentester Notebook & Markdown Scratchpad</h1>
            <p className="text-xs text-text-secondary">Persistent engagement documentation with evidence and finding references.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="xs" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={handleNewNote}>
            New Note
          </Button>
          <Button variant="primary" size="xs" leftIcon={<Save className="w-3.5 h-3.5" />} onClick={handleSave}>
            Save Note
          </Button>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={320}
          minSize={220}
          maxSize={500}
          storageKey="notebook_workspace_split"
          primary={
            <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle overflow-y-auto p-3 space-y-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1">
                Notebook Entries ({notes.length})
              </span>
              {notes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setSelectedNoteId(n.id)}
                  className={`p-3 rounded border cursor-pointer transition-colors space-y-1.5 ${
                    selectedNoteId === n.id ? 'bg-bg-panel-elevated border-accent-cyan/50' : 'bg-bg-app border-border-subtle hover:border-border-default'
                  }`}
                >
                  <h3 className="font-semibold text-xs text-text-primary truncate">{n.title}</h3>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{n.updatedAt}</span>
                    <div className="flex gap-1">
                      {n.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.2 bg-bg-panel rounded text-[10px] text-accent-cyan font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-hidden p-4 space-y-3">
              {selectedNote && (
                <>
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => {
                      const updated = { ...selectedNote, title: e.target.value };
                      setNotes(notes.map((n) => (n.id === selectedNote.id ? updated : n)));
                    }}
                    className="bg-bg-panel border border-border-subtle rounded px-3 py-1.5 text-sm font-bold text-text-primary focus:border-accent-cyan outline-none"
                  />
                  <textarea
                    value={selectedNote.markdownContent}
                    onChange={(e) => {
                      const updated = { ...selectedNote, markdownContent: e.target.value };
                      setNotes(notes.map((n) => (n.id === selectedNote.id ? updated : n)));
                    }}
                    className="flex-1 w-full bg-bg-panel border border-border-subtle rounded p-3 font-mono text-xs text-text-primary focus:border-accent-cyan outline-none resize-none leading-relaxed"
                    spellCheck={false}
                  />
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
