import { useState, useEffect } from 'react';
import {
  Stack, Group, TextInput, Button, ActionIcon, Switch,
  Divider, Text, Badge, Loader, Alert,
} from '@mantine/core';
import {
  IconFolderOpen, IconRefresh, IconPlus, IconTrash, IconGripVertical,
} from '@tabler/icons-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { onGetPhases, onSetPhases, onGetKeepPlayHead, onSetKeepPlayHead } from '../Settings.telefunc';
import { onGetBaseFolder, onSetBaseFolder, onScanLibrary } from './MoodboardPage.telefunc';
import { showSuccess, showError } from '../../lib/notifications';
import './SettingsDrawer.css';

export interface SettingsDrawerProps {
  onClose?: () => void;
  onScanComplete?: () => void;
  onPhasesChanged?: () => void;
}

// ---------- Sortable phase row ----------
function SortablePhaseRow({
  id, phase, onRemove, disabled,
}: {
  id: string; phase: string; onRemove: (p: string) => void; disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = transform ? { transform: CSS.Transform.toString(transform), transition } : {};

  return (
    // eslint-disable-next-line react/forbid-dom-props
    <li ref={setNodeRef} style={style} className={`phase-item ${isDragging ? 'dragging' : ''}`} {...attributes}>
      <span className="phase-drag-handle" {...listeners} title="Drag to reorder">
        <IconGripVertical size={16} />
      </span>
      <span className="phase-name">{phase}</span>
      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => onRemove(phase)} disabled={disabled} title={`Remove ${phase}`}>
        <IconTrash size={14} />
      </ActionIcon>
    </li>
  );
}

// ---------- Main component ----------
interface ScanResult {
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  removedFiles: number;
}

export function SettingsDrawer({ onClose: _onClose, onScanComplete, onPhasesChanged }: SettingsDrawerProps) {
  // Base folder
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [folderEditing, setFolderEditing] = useState(false);

  // Scan
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Phases
  const [phases, setPhases] = useState<string[]>([]);
  const [newPhase, setNewPhase] = useState('');
  const [savingPhases, setSavingPhases] = useState(false);

  // Playback
  const [keepPlayHead, setKeepPlayHead] = useState(false);

  // General
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load all settings on mount
  useEffect(() => {
    Promise.all([
      onGetBaseFolder(),
      onGetPhases(),
      onGetKeepPlayHead(),
    ])
      .then(([folder, ph, kph]) => {
        setBaseFolder(folder);
        setFolderInput(folder ?? '');
        setPhases(ph);
        setKeepPlayHead(kph);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ---- Base folder ----
  const handleSaveFolder = async () => {
    const trimmed = folderInput.trim();
    if (!trimmed) return;
    await onSetBaseFolder(trimmed);
    setBaseFolder(trimmed);
    setFolderEditing(false);
  };

  // ---- Scan ----
  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = await onScanLibrary();
      setScanResult({
        totalFiles: result.totalFiles,
        newFiles: result.newFiles,
        updatedFiles: result.updatedFiles,
        removedFiles: result.removedFiles,
      });
      showSuccess({
        title: 'Scan Complete',
        message: `Found ${result.totalFiles} files (${result.newFiles} new, ${result.updatedFiles} updated)`,
      });
      onScanComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      setScanError(msg);
      showError({ title: 'Scan Failed', message: msg });
    } finally {
      setScanning(false);
    }
  };

  // ---- Phases ----
  const persistPhases = async (next: string[]) => {
    setSavingPhases(true);
    try {
      await onSetPhases(next);
      onPhasesChanged?.();
    } catch (err) {
      console.error('Failed to save phases:', err);
    } finally {
      setSavingPhases(false);
    }
  };

  const handleAddPhase = () => {
    const trimmed = newPhase.trim();
    if (!trimmed || phases.includes(trimmed)) return;
    const next = [...phases, trimmed];
    setPhases(next);
    setNewPhase('');
    persistPhases(next);
  };

  const handleRemovePhase = (p: string) => {
    const next = phases.filter(x => x !== p);
    setPhases(next);
    persistPhases(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = phases.indexOf(active.id as string);
    const newIdx = phases.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(phases, oldIdx, newIdx);
    setPhases(next);
    persistPhases(next);
  };

  // ---- Playback ----
  const handleKeepPlayHeadChange = async (checked: boolean) => {
    setKeepPlayHead(checked);
    try { await onSetKeepPlayHead(checked); } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading settings…</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" className="settings-drawer">
      {/* ── Music Library ── */}
      <Stack gap="xs">
        <Text className="section-title" c="dimmed">Music Library</Text>
        <Divider />

        {folderEditing ? (
          <Group gap="xs">
            <TextInput
              flex={1}
              size="xs"
              placeholder="/path/to/music"
              value={folderInput}
              onChange={e => setFolderInput(e.currentTarget.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveFolder()}
            />
            <Button size="xs" onClick={handleSaveFolder} disabled={!folderInput.trim()}>Save</Button>
            <Button size="xs" variant="subtle" onClick={() => { setFolderEditing(false); setFolderInput(baseFolder ?? ''); }}>Cancel</Button>
          </Group>
        ) : (
          <>
            <Text className="base-folder-path" c={baseFolder ? undefined : 'dimmed'}>
              {baseFolder ?? 'No folder set'}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconFolderOpen size={14} />}
                onClick={() => setFolderEditing(true)}
              >
                Change
              </Button>
              <Button
                size="xs"
                variant="filled"
                color="violet"
                leftSection={scanning ? <Loader size={14} color="white" /> : <IconRefresh size={14} />}
                onClick={handleScan}
                disabled={!baseFolder || scanning}
                loading={scanning}
              >
                Scan Library
              </Button>
            </Group>
          </>
        )}

        {scanError && <Alert color="red" variant="light" title="Scan Error">{scanError}</Alert>}

        {scanResult && (
          <Group gap="xs" className="scan-result" wrap="wrap">
            <Badge size="sm" color="teal" variant="light">{scanResult.totalFiles} songs</Badge>
            {scanResult.newFiles > 0 && <Badge size="sm" color="green" variant="light">{scanResult.newFiles} new</Badge>}
            {scanResult.updatedFiles > 0 && <Badge size="sm" color="yellow" variant="light">{scanResult.updatedFiles} updated</Badge>}
            {scanResult.removedFiles > 0 && <Badge size="sm" color="red" variant="light">{scanResult.removedFiles} removed</Badge>}
          </Group>
        )}
      </Stack>

      {/* ── Phase Management ── */}
      <Stack gap="xs">
        <Text className="section-title" c="dimmed">Phase Management</Text>
        <Divider />

        {phases.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">No phases configured yet.</Text>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={phases} strategy={verticalListSortingStrategy}>
              <ul className="phase-list">
                {phases.map(p => (
                  <SortablePhaseRow key={p} id={p} phase={p} onRemove={handleRemovePhase} disabled={savingPhases} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <Group gap="xs">
          <TextInput
            flex={1}
            size="xs"
            placeholder="New phase name…"
            value={newPhase}
            onChange={e => setNewPhase(e.currentTarget.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPhase()}
            disabled={savingPhases}
          />
          <ActionIcon
            size="input-xs"
            variant="light"
            color="violet"
            onClick={handleAddPhase}
            disabled={!newPhase.trim() || phases.includes(newPhase.trim()) || savingPhases}
            title="Add phase"
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
      </Stack>

      {/* ── Playback ── */}
      <Stack gap="xs">
        <Text className="section-title" c="dimmed">Playback</Text>
        <Divider />
        <Switch
          label="Keep play head position"
          description="Preserve playback position when switching tracks"
          checked={keepPlayHead}
          onChange={e => handleKeepPlayHeadChange(e.currentTarget.checked)}
          size="sm"
        />
      </Stack>

      {/* ── About ── */}
      <Stack gap="xs">
        <Text className="section-title" c="dimmed">About</Text>
        <Divider />
        <Text size="sm" c="dimmed" ta="center">
          Musicky · Moodboard Song Organization
        </Text>
      </Stack>
    </Stack>
  );
}
