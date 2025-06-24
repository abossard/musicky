import React, { useEffect, useState } from 'react';
import { onGetPendingEdits, onApplyPendingEdits, onDeletePendingEdit, onUndoAppliedEdit } from '../../components/MP3MetadataViewer.telefunc';
import type { PendingEdit } from '../../lib/mp3-metadata';
import { Button, Group, Stack, Table, Text, TextInput, Switch } from '@mantine/core';

export default function ReviewChangesPage() {
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hideApplied, setHideApplied] = useState(false);

  useEffect(() => {
    loadEdits();
  }, []);

  const loadEdits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await onGetPendingEdits();
      setEdits(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load edits');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (id: number) => {
    await onApplyPendingEdits([id]);
    await loadEdits();
  };

  const handleReject = async (id: number) => {
    await onDeletePendingEdit(id);
    await loadEdits();
  };

  const handleUndo = async (id: number) => {
    await onUndoAppliedEdit(id);
    await loadEdits();
  };

  const filtered = edits.filter(e => {
    if (hideApplied && e.status === 'applied') return false;
    const term = search.toLowerCase();
    return (
      e.filePath.toLowerCase().includes(term) ||
      e.newComment.toLowerCase().includes(term) ||
      (e.originalComment || '').toLowerCase().includes(term)
    );
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">Review Changes</Text>
        <Button size="xs" onClick={loadEdits} loading={loading}>Refresh</Button>
      </Group>
      <Group>
        <TextInput placeholder="Search" value={search} onChange={e => setSearch(e.currentTarget.value)} />
        <Switch label="Hide applied" checked={hideApplied} onChange={e => setHideApplied(e.currentTarget.checked)} />
      </Group>
      {error && <Text c="red">Error: {error}</Text>}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>File</Table.Th>
            <Table.Th>Original</Table.Th>
            <Table.Th>New</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map(edit => (
            <Table.Tr key={edit.id}>
              <Table.Td>{edit.filePath}</Table.Td>
              <Table.Td>{edit.originalComment}</Table.Td>
              <Table.Td>{edit.newComment}</Table.Td>
              <Table.Td>{edit.status}</Table.Td>
              <Table.Td>
                {edit.status === 'pending' && (
                  <Group gap="xs">
                    <Button size="xs" onClick={() => handleApply(edit.id)}>Apply</Button>
                    <Button size="xs" color="red" onClick={() => handleReject(edit.id)}>Reject</Button>
                  </Group>
                )}
                {edit.status === 'applied' && (
                  <Button size="xs" onClick={() => handleUndo(edit.id)}>Undo</Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
