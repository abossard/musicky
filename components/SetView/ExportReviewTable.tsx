import { useState, useEffect, useCallback } from 'react';
import { Stack, Group, Table, Checkbox, Button, Text, Badge, Loader, Alert, Box } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { onPreviewHashtagExport, onApplyHashtagExport } from '../TagSync.telefunc';

interface ExportReviewTableProps {
  onClose: () => void;
}

interface PreviewRow {
  filePath: string;
  title: string;
  artist: string;
  currentComment: string;
  proposedComment: string;
  hasChanges: boolean;
}

function extractHashtags(comment: string): string[] {
  return (comment.match(/#\w+/g) ?? []);
}

const TAG_COLORS: Record<string, string> = {
  '#techno': 'cyan',
  '#dark': 'pink',
  '#peak': 'violet',
  '#melodic': 'teal',
  '#acid': 'lime',
  '#hard': 'red',
  '#deep': 'blue',
  '#progressive': 'indigo',
  '#minimal': 'gray',
  '#vocal': 'orange',
};

function tagColor(tag: string): string {
  return TAG_COLORS[tag.toLowerCase()] ?? 'gray';
}

function TagBadges({ tags, variant }: { tags: string[]; variant: 'current' | 'new' }) {
  if (tags.length === 0) return <Text size="sm" c="dimmed">—</Text>;
  return (
    <Group gap={4} wrap="wrap">
      {tags.map((t) => (
        <Badge
          key={t}
          size="sm"
          color={variant === 'new' ? tagColor(t) : 'gray'}
          variant={variant === 'new' ? 'filled' : 'outline'}
        >
          {t}
        </Badge>
      ))}
    </Group>
  );
}

export function ExportReviewTable({ onClose }: ExportReviewTableProps) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    onPreviewHashtagExport().then((data) => {
      if (cancelled) return;
      const changed = data.filter((r) => r.hasChanges);
      setRows(changed);
      setSelected(new Set(changed.map((r) => r.filePath)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleOne = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(rows.map((r) => r.filePath))), [rows]);
  const selectNone = useCallback(() => setSelected(new Set()), []);

  const applySelected = useCallback(async () => {
    const paths = rows.filter((r) => selected.has(r.filePath)).map((r) => r.filePath);
    if (paths.length === 0) return;
    setApplying(true);
    try {
      const res = await onApplyHashtagExport(paths);
      setResult(res);
    } finally {
      setApplying(false);
    }
  }, [rows, selected]);

  if (loading) {
    return (
      <Stack align="center" justify="center" h={200}>
        <Loader size="lg" />
        <Text c="dimmed">Scanning files…</Text>
      </Stack>
    );
  }

  if (result) {
    return (
      <Stack p="md">
        <Alert color="green" icon={<IconCheck size={18} />} title="Export Complete">
          Updated tags in {result.success} file{result.success !== 1 ? 's' : ''}.
          {result.failed.length > 0 && (
            <Text size="sm" c="red" mt="xs">
              Failed: {result.failed.join(', ')}
            </Text>
          )}
        </Alert>
        <Button variant="light" onClick={onClose}>Close</Button>
      </Stack>
    );
  }

  if (rows.length === 0) {
    return (
      <Stack align="center" justify="center" h={200}>
        <IconCheck size={48} color="var(--mantine-color-green-6)" />
        <Text c="dimmed">All songs up to date — no changes needed</Text>
        <Button variant="light" onClick={onClose}>Close</Button>
      </Stack>
    );
  }

  return (
    <Stack data-testid="export-review-table" p="xs" gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{selected.size} of {rows.length} selected</Text>
        <Group gap="xs">
          <Button size="xs" variant="subtle" onClick={selectAll}>Accept All</Button>
          <Button size="xs" variant="subtle" onClick={selectNone}>Reject All</Button>
          <Button
            size="xs"
            disabled={selected.size === 0 || applying}
            loading={applying}
            onClick={applySelected}
          >
            Apply Selected
          </Button>
        </Group>
      </Group>

      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>
                <Checkbox
                  checked={selected.size === rows.length}
                  indeterminate={selected.size > 0 && selected.size < rows.length}
                  onChange={() => (selected.size === rows.length ? selectNone() : selectAll())}
                  aria-label="Toggle all"
                />
              </Table.Th>
              <Table.Th>Song</Table.Th>
              <Table.Th>Current Tags</Table.Th>
              <Table.Th>New Tags</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.filePath}>
                <Table.Td>
                  <Checkbox
                    checked={selected.has(row.filePath)}
                    onChange={() => toggleOne(row.filePath)}
                    aria-label={`Select ${row.title}`}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{row.title}</Text>
                  <Text size="xs" c="dimmed">{row.artist}</Text>
                </Table.Td>
                <Table.Td>
                  <TagBadges tags={extractHashtags(row.currentComment)} variant="current" />
                </Table.Td>
                <Table.Td>
                  <TagBadges tags={extractHashtags(row.proposedComment)} variant="new" />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </Stack>
  );
}
