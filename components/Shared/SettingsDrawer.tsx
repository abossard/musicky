import { useState, useEffect } from 'react';
import {
  Stack, Group, TextInput, Button, Switch,
  Divider, Text, Badge, Loader, Alert,
} from '@mantine/core';
import {
  IconFolderOpen, IconRefresh,
} from '@tabler/icons-react';

import { onGetKeepPlayHead, onSetKeepPlayHead } from '../Settings.telefunc';
import { onGetBaseFolder, onSetBaseFolder, onScanLibrary } from '../Moodboard/MoodboardPage.telefunc';
import { showSuccess, showError } from '../../lib/notifications';
import './SettingsDrawer.css';

export interface SettingsDrawerProps {
  onClose?: () => void;
  onScanComplete?: () => void;
}

// ---------- Main component ----------
interface ScanResult {
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  removedFiles: number;
}

export function SettingsDrawer({ onClose: _onClose, onScanComplete }: SettingsDrawerProps) {
  // Base folder
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [folderEditing, setFolderEditing] = useState(false);

  // Scan
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Playback
  const [keepPlayHead, setKeepPlayHead] = useState(false);

  // General
  const [loading, setLoading] = useState(true);

  // Load all settings on mount
  useEffect(() => {
    Promise.all([
      onGetBaseFolder(),
      onGetKeepPlayHead(),
    ])
      .then(([folder, kph]) => {
        setBaseFolder(folder);
        setFolderInput(folder ?? '');
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
                data-testid="settings-scan-library"
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
