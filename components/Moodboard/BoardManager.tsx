import { useState, useEffect, useCallback, useRef } from 'react';
import { Group, Select, ActionIcon, Tooltip, TextInput, Button } from '@mantine/core';
import { IconPlus, IconTrash, IconDownload, IconUpload } from '@tabler/icons-react';
import {
  onGetMoodboards, onCreateMoodboard, onDeleteMoodboard,
  onExportMoodboard, onImportMoodboard, type MoodboardExport,
} from './Moodboard.telefunc';
import type { Moodboard } from '../../database/sqlite/queries/moodboard';

interface BoardManagerProps {
  activeBoardId: number | null;
  onBoardChange: (boardId: number) => void;
}

export function BoardManager({ activeBoardId, onBoardChange }: BoardManagerProps) {
  const [boards, setBoards] = useState<Moodboard[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBoards = useCallback(async () => {
    const list = await onGetMoodboards();
    setBoards(list);
    // Auto-create default board if none exist
    if (list.length === 0) {
      const newBoard = await onCreateMoodboard('Default');
      setBoards([newBoard]);
      onBoardChange(newBoard.id);
    } else if (activeBoardId === null) {
      onBoardChange(list[0].id);
    }
  }, [activeBoardId, onBoardChange]);

  useEffect(() => {
    loadBoards();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const board = await onCreateMoodboard(name);
    setNewName('');
    setCreating(false);
    await loadBoards();
    onBoardChange(board.id);
  };

  const handleDelete = async () => {
    if (activeBoardId === null) return;
    const activeBoard = boards.find(b => b.id === activeBoardId);
    if (!confirm(`Delete board "${activeBoard?.name}"? This cannot be undone.`)) return;
    await onDeleteMoodboard(activeBoardId);
    const remaining = await onGetMoodboards();
    setBoards(remaining);
    if (remaining.length > 0) {
      onBoardChange(remaining[0].id);
    } else {
      const newBoard = await onCreateMoodboard('Default');
      setBoards([newBoard]);
      onBoardChange(newBoard.id);
    }
  };

  const handleExport = async () => {
    if (activeBoardId === null) return;
    const data = await onExportMoodboard(activeBoardId);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.board.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.musicky-board.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as MoodboardExport;
      if (data.type !== 'musicky-moodboard' || !data.nodes) {
        alert('Invalid moodboard file format.');
        return;
      }
      const result = await onImportMoodboard(data);
      await loadBoards();
      onBoardChange(result.boardId);
    } catch {
      alert('Failed to import moodboard. Invalid file.');
    }
  };

  return (
    <Group gap={4}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.musicky-board.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = '';
        }}
        data-testid="import-file-input"
      />
      <Select
        size="xs"
        w={160}
        value={activeBoardId?.toString() ?? null}
        onChange={(v) => v && onBoardChange(parseInt(v, 10))}
        data={boards.map(b => ({ value: b.id.toString(), label: b.name }))}
        placeholder="Select board"
        data-testid="board-selector"
      />
      {creating ? (
        <Group gap={4}>
          <TextInput
            size="xs"
            w={120}
            placeholder="Board name..."
            value={newName}
            onChange={e => setNewName(e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            autoFocus
            data-testid="new-board-input"
          />
          <Button size="xs" onClick={handleCreate} disabled={!newName.trim()} data-testid="create-board-btn">
            Create
          </Button>
        </Group>
      ) : (
        <Tooltip label="New Board">
          <ActionIcon size="xs" variant="subtle" onClick={() => setCreating(true)} data-testid="new-board-btn">
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label="Delete Board">
        <ActionIcon size="xs" variant="subtle" color="red" onClick={handleDelete} disabled={boards.length <= 1} data-testid="delete-board-btn">
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Export Board">
        <ActionIcon size="xs" variant="subtle" onClick={handleExport} disabled={activeBoardId === null} data-testid="export-board-btn">
          <IconDownload size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Import Board">
        <ActionIcon size="xs" variant="subtle" onClick={() => fileInputRef.current?.click()} data-testid="import-board-btn">
          <IconUpload size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
