import { useReducer, useEffect, useCallback, useRef } from 'react';
import { Group, Select, ActionIcon, Tooltip, TextInput, Button } from '@mantine/core';
import { IconPlus, IconTrash, IconDownload, IconUpload } from '@tabler/icons-react';
import {
  onGetMoodboards, onCreateMoodboard, onDeleteMoodboard,
  onExportMoodboard, onImportMoodboard, type MoodboardExport,
} from './Moodboard.telefunc';
import type { Moodboard } from '../../database/sqlite/queries/moodboard';

// ─── State Machine ──────────────────────────────────────────────────────────

type BoardManagerState =
  | { mode: 'loading'; boards: Moodboard[]; activeId: number | null }
  | { mode: 'viewing'; boards: Moodboard[]; activeId: number }
  | { mode: 'creating'; boards: Moodboard[]; activeId: number; input: string }
  | { mode: 'confirming-delete'; boards: Moodboard[]; activeId: number; deleteId: number };

type BoardManagerEvent =
  | { type: 'LOADED'; boards: Moodboard[]; activeId: number }
  | { type: 'SELECT_BOARD'; boardId: number }
  | { type: 'START_CREATE' }
  | { type: 'UPDATE_CREATE_INPUT'; input: string }
  | { type: 'CANCEL_CREATE' }
  | { type: 'BOARD_CREATED'; boards: Moodboard[]; newId: number }
  | { type: 'BOARD_DELETED'; boards: Moodboard[]; newActiveId: number };

function boardManagerReducer(state: BoardManagerState, event: BoardManagerEvent): BoardManagerState {
  switch (event.type) {
    case 'LOADED':
      return { mode: 'viewing', boards: event.boards, activeId: event.activeId };
    case 'SELECT_BOARD':
      if (state.mode === 'loading') return state;
      return { mode: 'viewing', boards: state.boards, activeId: event.boardId };
    case 'START_CREATE':
      if (state.mode !== 'viewing') return state;
      return { mode: 'creating', boards: state.boards, activeId: state.activeId, input: '' };
    case 'UPDATE_CREATE_INPUT':
      if (state.mode !== 'creating') return state;
      return { ...state, input: event.input };
    case 'CANCEL_CREATE':
      if (state.mode !== 'creating') return state;
      return { mode: 'viewing', boards: state.boards, activeId: state.activeId };
    case 'BOARD_CREATED':
      return { mode: 'viewing', boards: event.boards, activeId: event.newId };
    case 'BOARD_DELETED':
      return { mode: 'viewing', boards: event.boards, activeId: event.newActiveId };
  }
}

interface BoardManagerProps {
  activeBoardId: number | null;
  onBoardChange: (boardId: number) => void;
}

export function BoardManager({ activeBoardId, onBoardChange }: BoardManagerProps) {
  const [state, dispatch] = useReducer(boardManagerReducer, {
    mode: 'loading', boards: [], activeId: activeBoardId,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBoards = useCallback(async () => {
    let list = await onGetMoodboards();
    if (list.length === 0) {
      const newBoard = await onCreateMoodboard('Default');
      list = [newBoard];
    }
    const activeId = activeBoardId && list.some(b => b.id === activeBoardId)
      ? activeBoardId
      : list[0].id;
    dispatch({ type: 'LOADED', boards: list, activeId });
    onBoardChange(activeId);
  }, [activeBoardId, onBoardChange]);

  useEffect(() => { loadBoards(); }, []);

  const handleCreate = async () => {
    if (state.mode !== 'creating' || !state.input.trim()) return;
    const board = await onCreateMoodboard(state.input.trim());
    const boards = await onGetMoodboards();
    dispatch({ type: 'BOARD_CREATED', boards, newId: board.id });
    onBoardChange(board.id);
  };

  const handleDelete = async () => {
    if (state.mode === 'loading' || state.boards.length <= 1) return;
    const activeBoard = state.boards.find(b => b.id === state.activeId);
    if (!confirm(`Delete board "${activeBoard?.name}"? This cannot be undone.`)) return;
    await onDeleteMoodboard(state.activeId);
    let remaining = await onGetMoodboards();
    if (remaining.length === 0) {
      const newBoard = await onCreateMoodboard('Default');
      remaining = [newBoard];
    }
    dispatch({ type: 'BOARD_DELETED', boards: remaining, newActiveId: remaining[0].id });
    onBoardChange(remaining[0].id);
  };

  const handleExport = async () => {
    if (state.mode === 'loading') return;
    const data = await onExportMoodboard(state.activeId);
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
      const boards = await onGetMoodboards();
      dispatch({ type: 'BOARD_CREATED', boards, newId: result.boardId });
      onBoardChange(result.boardId);
    } catch {
      alert('Failed to import moodboard. Invalid file.');
    }
  };

  const handleSelectBoard = useCallback((boardId: number) => {
    dispatch({ type: 'SELECT_BOARD', boardId });
    onBoardChange(boardId);
  }, [onBoardChange]);

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
        value={state.activeId?.toString() ?? null}
        onChange={(v) => v && handleSelectBoard(parseInt(v, 10))}
        data={state.boards.map(b => ({ value: b.id.toString(), label: b.name }))}
        placeholder="Select board"
        data-testid="board-selector"
      />
      {state.mode === 'creating' ? (
        <Group gap={4}>
          <TextInput
            size="xs"
            w={120}
            placeholder="Board name..."
            value={state.input}
            onChange={e => dispatch({ type: 'UPDATE_CREATE_INPUT', input: e.currentTarget.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') dispatch({ type: 'CANCEL_CREATE' });
            }}
            autoFocus
            data-testid="new-board-input"
          />
          <Button size="xs" onClick={handleCreate} disabled={state.mode !== 'creating' || !state.input.trim()} data-testid="create-board-btn">
            Create
          </Button>
        </Group>
      ) : (
        <Tooltip label="New Board">
          <ActionIcon size="xs" variant="subtle" onClick={() => dispatch({ type: 'START_CREATE' })} data-testid="new-board-btn">
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label="Delete Board">
        <ActionIcon size="xs" variant="subtle" color="red" onClick={handleDelete} disabled={state.boards.length <= 1} data-testid="delete-board-btn">
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Export Board">
        <ActionIcon size="xs" variant="subtle" onClick={handleExport} disabled={state.mode === 'loading'} data-testid="export-board-btn">
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
