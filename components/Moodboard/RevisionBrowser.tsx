import { useState, useEffect, useCallback } from 'react';
import { Modal, Stack, Group, Badge, Text, Button, Box, Loader } from '@mantine/core';
import { IconRestore, IconCircleDot, IconArrowsShuffle } from '@tabler/icons-react';
import { onGetRevisions, onRestoreRevision } from './Moodboard.telefunc';

interface RevisionSummary {
  id: number;
  revision_number: number;
  message: string | null;
  created_at: string;
  node_count: number;
  edge_count: number;
}

interface RevisionBrowserProps {
  opened: boolean;
  onClose: () => void;
  boardId: number;
  onRestore: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

export function RevisionBrowser({ opened, onClose, boardId, onRestore }: RevisionBrowserProps) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await onGetRevisions(boardId);
      setRevisions(data);
    } catch (err) {
      console.error('Failed to load revisions', err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (opened) loadRevisions();
  }, [opened, loadRevisions]);

  const handleRestore = async (revisionId: number, revisionNumber: number) => {
    const confirmed = window.confirm(
      `Restore to revision v${revisionNumber}? This will replace the current board state.`
    );
    if (!confirmed) return;

    setRestoring(revisionId);
    try {
      await onRestoreRevision(boardId, revisionId);
      onRestore();
      onClose();
    } catch (err) {
      console.error('Failed to restore revision', err);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Revision History"
      size="md"
      data-testid="revision-browser"
    >
      {loading ? (
        <Group justify="center" p="lg">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">Loading revisions…</Text>
        </Group>
      ) : revisions.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="lg">
          No revisions yet. Revisions are created each time you save.
        </Text>
      ) : (
        <Stack gap="xs">
          {revisions.map((rev) => (
            <Box
              key={rev.id}
              p="sm"
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                border: '1px solid var(--mantine-color-dark-4)',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge variant="filled" color="violet" size="sm">
                    v{rev.revision_number}
                  </Badge>
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text size="xs" c="dimmed">
                      {formatRelativeTime(rev.created_at)}
                    </Text>
                    <Group gap="xs">
                      <Group gap={2}>
                        <IconCircleDot size={12} color="var(--mantine-color-dimmed)" />
                        <Text size="xs" c="dimmed">{rev.node_count} nodes</Text>
                      </Group>
                      <Group gap={2}>
                        <IconArrowsShuffle size={12} color="var(--mantine-color-dimmed)" />
                        <Text size="xs" c="dimmed">{rev.edge_count} edges</Text>
                      </Group>
                    </Group>
                  </Stack>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  color="violet"
                  leftSection={<IconRestore size={14} />}
                  loading={restoring === rev.id}
                  disabled={restoring !== null}
                  onClick={() => handleRestore(rev.id, rev.revision_number)}
                  data-testid="revision-restore"
                >
                  Restore
                </Button>
              </Group>
            </Box>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
