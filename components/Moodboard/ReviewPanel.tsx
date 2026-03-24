import { useState, useEffect, useCallback } from 'react';
import {
  Stack, Group, Text, Button, Badge, Card, Tabs,
  ScrollArea, Divider, ActionIcon, Loader, Alert, Tooltip,
  Checkbox,
} from '@mantine/core';
import {
  IconCheck, IconX, IconRefresh, IconUpload, IconDownload,
  IconArrowRight, IconFileMusic, IconAlertCircle, IconHistory,
  IconVinyl,
} from '@tabler/icons-react';
import {
  onPreviewExport,
  onPreviewImport,
  onApplyExport,
  onApplyImport,
  onRejectExport,
  onRejectImport,
  onGetPendingTagEdits,
  onGetTagEditHistory,
  onPreviewVDJExport,
  onApplyVDJExport,
} from '../TagSync.telefunc';
import type { PendingTagEdit, TagEditHistory } from '../../database/sqlite/queries/mp3-tag-edits';
import type { FileDiffSummary, TagDiff } from '../../lib/tag-sync-engine';
import './ReviewPanel.css';

export interface ReviewPanelProps {
  onClose?: () => void;
  onChangesApplied?: () => void;
}

// Group pending edits by file path
function groupEditsByFile(edits: PendingTagEdit[]): Map<string, PendingTagEdit[]> {
  const grouped = new Map<string, PendingTagEdit[]>();
  for (const edit of edits) {
    const group = grouped.get(edit.filePath) || [];
    group.push(edit);
    grouped.set(edit.filePath, group);
  }
  return grouped;
}

function formatFieldName(name: string): string {
  return name.startsWith('µ:') ? name : `µ:${name}`;
}

function truncateValue(value: string, max = 50): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

function fileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface FileEditCardProps {
  filePath: string;
  edits: PendingTagEdit[];
  applying: boolean;
  onApprove: (ids: number[]) => void;
  onReject: (ids: number[]) => void;
}

function FileEditCard({ filePath, edits, applying, onApprove, onReject }: FileEditCardProps) {
  const ids = edits.map(e => e.id);

  return (
    <Card className="review-diff-card" padding="sm" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconFileMusic size={16} />
          <Text fw={600} size="sm" className="review-file-name">{fileName(filePath)}</Text>
        </Group>
        <Badge size="xs" variant="light">
          {edits.length} change{edits.length !== 1 ? 's' : ''}
        </Badge>
      </Group>

      {edits.map((edit) => (
        <div key={edit.id} className="review-diff-field">
          <span className="review-field-name">{formatFieldName(edit.fieldName)}</span>
          <IconArrowRight size={12} color="var(--mantine-color-dimmed)" />
          {edit.originalValue ? (
            <span className="review-value-old">{truncateValue(edit.originalValue)}</span>
          ) : (
            <span className="review-value-empty">(none)</span>
          )}
          <IconArrowRight size={12} color="var(--mantine-color-green-6)" />
          <span className="review-value-new">{truncateValue(edit.newValue)}</span>
        </div>
      ))}

      <Group justify="flex-end" mt="xs" gap="xs">
        <Button
          size="xs"
          color="green"
          variant="light"
          leftSection={<IconCheck size={14} />}
          onClick={() => onApprove(ids)}
          loading={applying}
        >
          Approve
        </Button>
        <Button
          size="xs"
          color="red"
          variant="light"
          leftSection={<IconX size={14} />}
          onClick={() => onReject(ids)}
          loading={applying}
        >
          Reject
        </Button>
      </Group>
    </Card>
  );
}

interface VDJFileDiffCardProps {
  diff: FileDiffSummary;
  selected: boolean;
  onToggle: (filePath: string) => void;
}

function VDJFileDiffCard({ diff, selected, onToggle }: VDJFileDiffCardProps) {
  return (
    <Card className="review-diff-card" padding="sm" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Checkbox
            size="xs"
            checked={selected}
            onChange={() => onToggle(diff.filePath)}
          />
          <IconFileMusic size={16} />
          <Text fw={600} size="sm" className="review-file-name">
            {fileName(diff.filePath)}
          </Text>
        </Group>
        {diff.artist && (
          <Text size="xs" c="dimmed">{diff.artist}</Text>
        )}
      </Group>

      {diff.diffs.map((d: TagDiff, i: number) => (
        <div key={i} className="review-diff-field">
          <span className="review-field-name">{d.fieldName}</span>
          <IconArrowRight size={12} color="var(--mantine-color-dimmed)" />
          {d.currentValue ? (
            <span className="review-value-old">{truncateValue(d.currentValue, 80)}</span>
          ) : (
            <span className="review-value-empty">(none)</span>
          )}
          <IconArrowRight size={12} color="var(--mantine-color-green-6)" />
          <span className="review-value-new">{truncateValue(d.proposedValue, 80)}</span>
        </div>
      ))}
    </Card>
  );
}

export function ReviewPanel({ onClose: _onClose, onChangesApplied }: ReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('export');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exportEdits, setExportEdits] = useState<PendingTagEdit[]>([]);
  const [importEdits, setImportEdits] = useState<PendingTagEdit[]>([]);
  const [history, setHistory] = useState<TagEditHistory[]>([]);

  // VDJ Export state
  const [vdjDiffs, setVdjDiffs] = useState<FileDiffSummary[]>([]);
  const [vdjSelected, setVdjSelected] = useState<Set<string>>(new Set());
  const [vdjScanning, setVdjScanning] = useState(false);
  const [vdjApplying, setVdjApplying] = useState(false);
  const [vdjResult, setVdjResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [vdjOptions, setVdjOptions] = useState({
    writeGenre: true,
    writeComment: true,
    writeGrouping: true,
    writeMusickTags: true,
    preserveExistingComment: true,
  });

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, imp, hist] = await Promise.all([
        onGetPendingTagEdits('export'),
        onGetPendingTagEdits('import'),
        onGetTagEditHistory(),
      ]);
      setExportEdits(exp);
      setImportEdits(imp);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load edits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleScan = useCallback(async (direction: 'export' | 'import') => {
    setScanning(true);
    setError(null);
    try {
      if (direction === 'export') {
        await onPreviewExport();
      } else {
        await onPreviewImport();
      }
      await loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [loadPending]);

  const handleApprove = useCallback(async (ids: number[], direction: 'export' | 'import') => {
    setApplying(true);
    setError(null);
    try {
      const result = direction === 'export'
        ? await onApplyExport(ids)
        : await onApplyImport(ids);
      if (result.failed.length > 0) {
        setError(`${result.failed.length} edit(s) failed`);
      }
      await loadPending();
      onChangesApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  }, [loadPending, onChangesApplied]);

  const handleReject = useCallback(async (ids: number[], direction: 'export' | 'import') => {
    setApplying(true);
    try {
      if (direction === 'export') {
        await onRejectExport(ids);
      } else {
        await onRejectImport(ids);
      }
      await loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setApplying(false);
    }
  }, [loadPending]);

  const handleApproveAll = useCallback((direction: 'export' | 'import') => {
    const edits = direction === 'export' ? exportEdits : importEdits;
    const ids = edits.map(e => e.id);
    if (ids.length > 0) handleApprove(ids, direction);
  }, [exportEdits, importEdits, handleApprove]);

  const handleRejectAll = useCallback((direction: 'export' | 'import') => {
    const edits = direction === 'export' ? exportEdits : importEdits;
    const ids = edits.map(e => e.id);
    if (ids.length > 0) handleReject(ids, direction);
  }, [exportEdits, importEdits, handleReject]);

  // VDJ Export handlers
  const handleVDJScan = useCallback(async () => {
    setVdjScanning(true);
    setError(null);
    setVdjResult(null);
    try {
      const diffs = await onPreviewVDJExport();
      setVdjDiffs(diffs);
      setVdjSelected(new Set(diffs.map(d => d.filePath)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VDJ scan failed');
    } finally {
      setVdjScanning(false);
    }
  }, []);

  const handleVDJToggle = useCallback((filePath: string) => {
    setVdjSelected(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const handleVDJToggleAll = useCallback(() => {
    if (vdjSelected.size === vdjDiffs.length) {
      setVdjSelected(new Set());
    } else {
      setVdjSelected(new Set(vdjDiffs.map(d => d.filePath)));
    }
  }, [vdjSelected.size, vdjDiffs]);

  const handleVDJApply = useCallback(async () => {
    const paths = [...vdjSelected];
    if (paths.length === 0) return;
    setVdjApplying(true);
    setError(null);
    setVdjResult(null);
    try {
      const result = await onApplyVDJExport(paths);
      setVdjResult(result);
      if (result.success > 0) {
        // Re-scan to update diffs
        const diffs = await onPreviewVDJExport();
        setVdjDiffs(diffs);
        setVdjSelected(new Set(diffs.map(d => d.filePath)));
        onChangesApplied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VDJ export failed');
    } finally {
      setVdjApplying(false);
    }
  }, [vdjSelected, onChangesApplied]);

  const totalPending = exportEdits.length + importEdits.length;

  const renderEditList = (edits: PendingTagEdit[], direction: 'export' | 'import') => {
    const grouped = groupEditsByFile(edits);

    if (loading) {
      return (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading pending edits…</Text>
        </Group>
      );
    }

    if (edits.length === 0) {
      return (
        <Stack align="center" py="xl" gap="xs">
          <Text size="sm" c="dimmed">No pending {direction} edits.</Text>
          <Text size="xs" c="dimmed">Click "Scan" to check for differences.</Text>
        </Stack>
      );
    }

    return (
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Button
              size="xs"
              color="green"
              variant="filled"
              leftSection={<IconCheck size={14} />}
              onClick={() => handleApproveAll(direction)}
              loading={applying}
              data-testid="review-approve-all"
            >
              Approve All
            </Button>
            <Button
              size="xs"
              color="red"
              variant="filled"
              leftSection={<IconX size={14} />}
              onClick={() => handleRejectAll(direction)}
              loading={applying}
              data-testid="review-reject-all"
            >
              Reject All
            </Button>
          </Group>
          <Badge size="sm" variant="light" color="violet">
            {edits.length} pending
          </Badge>
        </Group>

        <ScrollArea.Autosize mah="calc(100vh - 380px)">
          <Stack gap="xs">
            {[...grouped.entries()].map(([filePath, fileEdits]) => (
              <FileEditCard
                key={filePath}
                filePath={filePath}
                edits={fileEdits}
                applying={applying}
                onApprove={(ids) => handleApprove(ids, direction)}
                onReject={(ids) => handleReject(ids, direction)}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    );
  };

  return (
    <Stack gap="md" className="review-panel">
      <Group justify="space-between">
        <Group gap="xs">
          <Text size="lg" fw={700}>Review Pending Changes</Text>
          {totalPending > 0 && (
            <Badge size="lg" variant="filled" color="violet" circle>
              {totalPending}
            </Badge>
          )}
        </Group>
        <Tooltip label="Refresh">
          <ActionIcon variant="subtle" onClick={loadPending} loading={loading}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="export" leftSection={<IconUpload size={14} />}>
            Export
            {exportEdits.length > 0 && (
              <Badge size="xs" ml="xs" variant="filled" color="violet">{exportEdits.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="import" leftSection={<IconDownload size={14} />}>
            Import
            {importEdits.length > 0 && (
              <Badge size="xs" ml="xs" variant="filled" color="cyan">{importEdits.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="vdjexport" leftSection={<IconVinyl size={14} />} data-testid="vdj-export-tab">
            VDJ Export
            {vdjDiffs.length > 0 && (
              <Badge size="xs" ml="xs" variant="filled" color="orange">{vdjDiffs.length}</Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="export" pt="sm">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Dashboard → ID3 file tags</Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                onClick={() => handleScan('export')}
                loading={scanning}
              >
                Scan Library
              </Button>
            </Group>
            {renderEditList(exportEdits, 'export')}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="import" pt="sm">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">ID3 µ: tags → Dashboard</Text>
              <Button
                size="xs"
                variant="light"
                color="cyan"
                leftSection={<IconRefresh size={14} />}
                onClick={() => handleScan('import')}
                loading={scanning}
              >
                Scan Files
              </Button>
            </Group>
            {renderEditList(importEdits, 'import')}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="vdjexport" pt="sm">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Write Moodboard tags into standard ID3 frames (Genre, Comment, Grouping)
              so Virtual DJ and other software can read them.
            </Text>

            {/* Options */}
            <Card padding="xs" withBorder className="review-diff-card">
              <Stack gap={6}>
                <Checkbox
                  size="xs"
                  label="Write Genre (TCON)"
                  checked={vdjOptions.writeGenre}
                  onChange={(e) => setVdjOptions(o => ({ ...o, writeGenre: e.currentTarget.checked }))}
                />
                <Checkbox
                  size="xs"
                  label="Write Comment (COMM)"
                  checked={vdjOptions.writeComment}
                  onChange={(e) => setVdjOptions(o => ({ ...o, writeComment: e.currentTarget.checked }))}
                />
                <Checkbox
                  size="xs"
                  label="Write Grouping (TIT1)"
                  checked={vdjOptions.writeGrouping}
                  onChange={(e) => setVdjOptions(o => ({ ...o, writeGrouping: e.currentTarget.checked }))}
                />
                <Checkbox
                  size="xs"
                  label="Write Musicky Tags (µ:)"
                  checked={vdjOptions.writeMusickTags}
                  onChange={(e) => setVdjOptions(o => ({ ...o, writeMusickTags: e.currentTarget.checked }))}
                />
                <Checkbox
                  size="xs"
                  label="Preserve existing comments"
                  checked={vdjOptions.preserveExistingComment}
                  onChange={(e) => setVdjOptions(o => ({ ...o, preserveExistingComment: e.currentTarget.checked }))}
                />
              </Stack>
            </Card>

            {/* Scan button */}
            <Group justify="flex-end">
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconRefresh size={14} />}
                onClick={handleVDJScan}
                loading={vdjScanning}
                data-testid="vdj-preview-btn"
              >
                Preview VDJ Export
              </Button>
            </Group>

            {/* Result message */}
            {vdjResult && (
              <Alert
                color={vdjResult.failed > 0 ? 'yellow' : 'green'}
                withCloseButton
                onClose={() => setVdjResult(null)}
              >
                Processed {vdjResult.success} file{vdjResult.success !== 1 ? 's' : ''} successfully.
                {vdjResult.failed > 0 && ` ${vdjResult.failed} failed.`}
                {vdjResult.errors.length > 0 && (
                  <Text size="xs" mt={4}>{vdjResult.errors.join('; ')}</Text>
                )}
              </Alert>
            )}

            {/* Diff preview */}
            {vdjScanning && (
              <Group justify="center" py="xl">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Scanning library…</Text>
              </Group>
            )}

            {!vdjScanning && vdjDiffs.length === 0 && (
              <Stack align="center" py="xl" gap="xs">
                <Text size="sm" c="dimmed">No VDJ export diffs found.</Text>
                <Text size="xs" c="dimmed">Click "Preview VDJ Export" to scan for differences.</Text>
              </Stack>
            )}

            {!vdjScanning && vdjDiffs.length > 0 && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Checkbox
                    size="xs"
                    label={`Select all (${vdjSelected.size}/${vdjDiffs.length})`}
                    checked={vdjSelected.size === vdjDiffs.length}
                    indeterminate={vdjSelected.size > 0 && vdjSelected.size < vdjDiffs.length}
                    onChange={handleVDJToggleAll}
                  />
                  <Badge size="sm" variant="light" color="orange">
                    {vdjDiffs.length} file{vdjDiffs.length !== 1 ? 's' : ''} with changes
                  </Badge>
                </Group>

                <ScrollArea.Autosize mah="calc(100vh - 500px)">
                  <Stack gap="xs">
                    {vdjDiffs.map((diff) => (
                      <VDJFileDiffCard
                        key={diff.filePath}
                        diff={diff}
                        selected={vdjSelected.has(diff.filePath)}
                        onToggle={handleVDJToggle}
                      />
                    ))}
                  </Stack>
                </ScrollArea.Autosize>

                <Button
                  color="orange"
                  leftSection={<IconCheck size={14} />}
                  onClick={handleVDJApply}
                  loading={vdjApplying}
                  disabled={vdjSelected.size === 0}
                  data-testid="vdj-apply-btn"
                >
                  Process {vdjSelected.size} file{vdjSelected.size !== 1 ? 's' : ''}
                </Button>
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* History Section */}
      {history.length > 0 && (
        <>
          <Divider
            label={
              <Group gap={4}>
                <IconHistory size={14} />
                <Text size="xs">History</Text>
              </Group>
            }
            labelPosition="left"
          />
          <ScrollArea.Autosize mah={200}>
            <Stack gap={4}>
              {history.slice(0, 20).map((h) => (
                <Group key={h.id} gap="xs" className="review-history-row">
                  <Badge
                    size="xs"
                    variant="dot"
                    color={h.reverted ? 'yellow' : 'green'}
                  >
                    {h.reverted ? 'Reverted' : h.direction === 'export' ? 'Exported' : 'Imported'}
                  </Badge>
                  <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                    {fileName(h.filePath)} — {formatFieldName(h.fieldName)}
                  </Text>
                  <Text size="xs" c="dimmed">{timeAgo(h.appliedAt)}</Text>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        </>
      )}
    </Stack>
  );
}
