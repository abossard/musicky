import React, { useState, useCallback } from 'react';
import {
  Stack, Group, Text, Button, Box, Tabs, Badge, Card,
  Checkbox, Loader, Alert, Tooltip, ActionIcon, Progress,
} from '@mantine/core';
import {
  IconUpload, IconDownload, IconCheck, IconX, IconRefresh,
  IconArrowRight, IconFileMusic, IconAlertCircle,
} from '@tabler/icons-react';
import {
  onPreviewExport,
  onPreviewImport,
  onApplyExport,
  onApplyImport,
  onRejectExport,
  onRejectImport,
  onGetPendingTagEdits,
} from './TagSync.telefunc';
import type { PendingTagEdit } from '../database/sqlite/queries/mp3-tag-edits';
import type { FileDiffSummary, TagDiff } from '../lib/tag-sync-engine';
import './TagSync.css';

interface FileDiffCardProps {
  summary: FileDiffSummary;
  editIds: number[];
  selectedEdits: Set<number>;
  onToggleEdit: (id: number) => void;
  onToggleFile: (ids: number[], selected: boolean) => void;
}

function FileDiffCard({ summary, editIds, selectedEdits, onToggleEdit, onToggleFile }: FileDiffCardProps) {
  const allSelected = editIds.every(id => selectedEdits.has(id));
  const someSelected = editIds.some(id => selectedEdits.has(id));

  return (
    <Card className="diff-card" padding="sm">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={() => onToggleFile(editIds, !allSelected)}
            size="xs"
          />
          <IconFileMusic size={16} />
          <Text fw={600} size="sm">{summary.title || 'Unknown Title'}</Text>
          <Text size="xs" c="dimmed">{summary.artist || 'Unknown Artist'}</Text>
        </Group>
        <Badge size="xs" variant="light">
          {summary.diffs.length} change{summary.diffs.length !== 1 ? 's' : ''}
        </Badge>
      </Group>

      {summary.diffs.map((diff, i) => {
        const editId = editIds[i];
        return (
          <div key={i} className="diff-field">
            <Checkbox
              checked={selectedEdits.has(editId)}
              onChange={() => onToggleEdit(editId)}
              size="xs"
            />
            <span className="diff-field-name">{formatFieldName(diff.fieldName)}</span>
            <IconArrowRight size={12} color="var(--mantine-color-dimmed)" />
            {diff.currentValue ? (
              <span className="diff-value-old">{truncateValue(diff.currentValue)}</span>
            ) : (
              <span className="diff-value-empty">(empty)</span>
            )}
            <IconArrowRight size={12} color="var(--mantine-color-green-6)" />
            <span className="diff-value-new">{truncateValue(diff.proposedValue)}</span>
          </div>
        );
      })}
    </Card>
  );
}

function formatFieldName(name: string): string {
  if (name.startsWith('µ:')) return name.slice(2);
  return name;
}

function truncateValue(value: string, max = 60): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

export function TagSync() {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [exportSummaries, setExportSummaries] = useState<FileDiffSummary[]>([]);
  const [exportEditIds, setExportEditIds] = useState<Map<string, number[]>>(new Map());
  const [selectedExports, setSelectedExports] = useState<Set<number>>(new Set());

  // Import state
  const [importSummaries, setImportSummaries] = useState<FileDiffSummary[]>([]);
  const [importEditIds, setImportEditIds] = useState<Map<string, number[]>>(new Map());
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());

  // Export progress
  const [applyProgress, setApplyProgress] = useState<{ done: number; total: number } | null>(null);

  const handleScanExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onPreviewExport();
      setExportSummaries(result.summaries);

      // Get the created edit IDs
      const edits = await onGetPendingTagEdits('export');
      const idMap = new Map<string, number[]>();
      const allIds = new Set<number>();

      for (const summary of result.summaries) {
        const fileEdits = edits.filter(e => e.filePath === summary.filePath);
        const ids = fileEdits.map(e => e.id);
        idMap.set(summary.filePath, ids);
        ids.forEach(id => allIds.add(id));
      }

      setExportEditIds(idMap);
      setSelectedExports(allIds); // Select all by default
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScanImport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onPreviewImport();
      setImportSummaries(result.summaries);

      const edits = await onGetPendingTagEdits('import');
      const idMap = new Map<string, number[]>();
      const allIds = new Set<number>();

      for (const summary of result.summaries) {
        const fileEdits = edits.filter(e => e.filePath === summary.filePath);
        const ids = fileEdits.map(e => e.id);
        idMap.set(summary.filePath, ids);
        ids.forEach(id => allIds.add(id));
      }

      setImportEditIds(idMap);
      setSelectedImports(allIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApplyExport = useCallback(async () => {
    const ids = [...selectedExports];
    if (ids.length === 0) return;

    setApplying(true);
    setApplyProgress({ done: 0, total: ids.length });
    setError(null);

    try {
      const result = await onApplyExport(ids);
      setApplyProgress({ done: result.success, total: ids.length });

      if (result.failed.length > 0) {
        setError(`${result.failed.length} edit(s) failed: ${result.failed.map(f => f.error).join(', ')}`);
      }

      // Reject unselected edits
      const allExportIds = [...exportEditIds.values()].flat();
      const unselected = allExportIds.filter(id => !selectedExports.has(id));
      if (unselected.length > 0) {
        await onRejectExport(unselected);
      }

      // Refresh
      setExportSummaries([]);
      setSelectedExports(new Set());
      setExportEditIds(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setApplying(false);
      setApplyProgress(null);
    }
  }, [selectedExports, exportEditIds]);

  const handleApplyImport = useCallback(async () => {
    const ids = [...selectedImports];
    if (ids.length === 0) return;

    setApplying(true);
    setError(null);

    try {
      const result = await onApplyImport(ids);

      if (result.failed.length > 0) {
        setError(`${result.failed.length} import(s) failed: ${result.failed.map(f => f.error).join(', ')}`);
      }

      const allImportIds = [...importEditIds.values()].flat();
      const unselected = allImportIds.filter(id => !selectedImports.has(id));
      if (unselected.length > 0) {
        await onRejectImport(unselected);
      }

      setImportSummaries([]);
      setSelectedImports(new Set());
      setImportEditIds(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setApplying(false);
    }
  }, [selectedImports, importEditIds]);

  const toggleEdit = useCallback((id: number, set: Set<number>, setter: React.Dispatch<React.SetStateAction<Set<number>>>) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }, []);

  const toggleFileEdits = useCallback((ids: number[], selected: boolean, setter: React.Dispatch<React.SetStateAction<Set<number>>>) => {
    setter(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id); else next.delete(id);
      }
      return next;
    });
  }, []);

  return (
    <Stack gap="md" className="tag-sync">
      <Group justify="space-between">
        <Group gap="xs">
          <Text size="xl" fw={700}>Tag Sync</Text>
          <Badge size="sm" variant="light" color="violet">µ: tags</Badge>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as 'export' | 'import')}>
        <Tabs.List>
          <Tabs.Tab value="export" leftSection={<IconUpload size={14} />}>
            Export to Files
            {exportSummaries.length > 0 && (
              <Badge size="xs" ml="xs" variant="filled" color="violet">{exportSummaries.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="import" leftSection={<IconDownload size={14} />}>
            Import from Files
            {importSummaries.length > 0 && (
              <Badge size="xs" ml="xs" variant="filled" color="cyan">{importSummaries.length}</Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="export" pt="sm">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Compare dashboard metadata against MP3 file tags. Selected changes will be written to files.
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleScanExport}
                  loading={loading}
                >
                  Scan Library
                </Button>
                {exportSummaries.length > 0 && (
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<IconCheck size={14} />}
                    onClick={handleApplyExport}
                    loading={applying}
                    disabled={selectedExports.size === 0}
                  >
                    Apply {selectedExports.size} Edit{selectedExports.size !== 1 ? 's' : ''}
                  </Button>
                )}
              </Group>
            </Group>

            {applyProgress && (
              <Progress value={(applyProgress.done / applyProgress.total) * 100} size="sm" color="green" animated />
            )}

            {loading && (
              <Group justify="center" py="xl">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Scanning library for differences…</Text>
              </Group>
            )}

            {!loading && exportSummaries.length === 0 && (
              <div className="no-diffs">
                <Text size="sm">No differences found. Dashboard and file tags are in sync, or scan hasn't been run yet.</Text>
                <Text size="xs" c="dimmed" mt="xs">Click "Scan Library" to check for differences.</Text>
              </div>
            )}

            {exportSummaries.map(summary => (
              <FileDiffCard
                key={summary.filePath}
                summary={summary}
                editIds={exportEditIds.get(summary.filePath) || []}
                selectedEdits={selectedExports}
                onToggleEdit={(id) => toggleEdit(id, selectedExports, setSelectedExports)}
                onToggleFile={(ids, sel) => toggleFileEdits(ids, sel, setSelectedExports)}
              />
            ))}

            {exportSummaries.length > 0 && (
              <Box className="sync-stats">
                <Group gap="md">
                  <Text size="xs" c="dimmed">
                    {exportSummaries.length} file{exportSummaries.length !== 1 ? 's' : ''} with changes
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedExports.size} edit{selectedExports.size !== 1 ? 's' : ''} selected
                  </Text>
                </Group>
              </Box>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="import" pt="sm">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Scan MP3 files for µ: tags and import metadata into the dashboard.
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  color="cyan"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleScanImport}
                  loading={loading}
                >
                  Scan Files
                </Button>
                {importSummaries.length > 0 && (
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<IconCheck size={14} />}
                    onClick={handleApplyImport}
                    loading={applying}
                    disabled={selectedImports.size === 0}
                  >
                    Import {selectedImports.size} Edit{selectedImports.size !== 1 ? 's' : ''}
                  </Button>
                )}
              </Group>
            </Group>

            {loading && (
              <Group justify="center" py="xl">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Scanning files for µ: tags…</Text>
              </Group>
            )}

            {!loading && importSummaries.length === 0 && (
              <div className="no-diffs">
                <Text size="sm">No µ: tags found in files, or everything is already imported.</Text>
                <Text size="xs" c="dimmed" mt="xs">Click "Scan Files" to check for importable tags.</Text>
              </div>
            )}

            {importSummaries.map(summary => (
              <FileDiffCard
                key={summary.filePath}
                summary={summary}
                editIds={importEditIds.get(summary.filePath) || []}
                selectedEdits={selectedImports}
                onToggleEdit={(id) => toggleEdit(id, selectedImports, setSelectedImports)}
                onToggleFile={(ids, sel) => toggleFileEdits(ids, sel, setSelectedImports)}
              />
            ))}

            {importSummaries.length > 0 && (
              <Box className="sync-stats">
                <Group gap="md">
                  <Text size="xs" c="dimmed">
                    {importSummaries.length} file{importSummaries.length !== 1 ? 's' : ''} with µ: tags
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedImports.size} edit{selectedImports.size !== 1 ? 's' : ''} selected
                  </Text>
                </Group>
              </Box>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
