import React, { useEffect, useState } from 'react';
import { FileBrowser } from '../../components/FileBrowser';
import { MP3MetadataViewer } from '../../components/MP3MetadataViewer';
import { PendingEditsManager } from '../../components/PendingEditsManager';
import {
  onGetBaseFolder,
  onSetBaseFolder,
  onFilterLibrary,
  onGetHistory,
  onRevertHistory
} from '../../components/MP3Library.telefunc';
import type { MP3LibraryScan, MP3EditHistory } from '../../lib/mp3-library';
import { Modal, Button, Group, Stack, MultiSelect, Text, Table, Paper } from '@mantine/core';

export default function MP3LibraryPage() {
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [scan, setScan] = useState<MP3LibraryScan | null>(null);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [history, setHistory] = useState<MP3EditHistory[]>([]);

  useEffect(() => {
    (async () => {
      const folder = await onGetBaseFolder();
      if (folder) {
        setBaseFolder(folder);
      }
    })();
  }, []);

  useEffect(() => {
    if (baseFolder) {
      performScan();
      loadHistory();
    }
  }, [baseFolder]);

  const performScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onFilterLibrary(includeTags, excludeTags);
      setScan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const h = await onGetHistory();
      setHistory(h);
    } catch {
      // ignore
    }
  };

  const handleSelectFolder = async (folder: string) => {
    await onSetBaseFolder(folder);
    setBaseFolder(folder);
  };

  const handleRevert = async (id: number) => {
    try {
      await onRevertHistory(id);
      await performScan();
      await loadHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const tags = scan?.tags || [];

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">MP3 Library</Text>
      {!baseFolder && (
        <Paper p="md" withBorder>
          <Text mb="sm">Select your music folder:</Text>
          <FileBrowser onFolderSelect={handleSelectFolder} showFilters={false} allowMultipleSelection={false} />
        </Paper>
      )}
      {baseFolder && (
        <Stack gap="md">
          <Group>
            <Text>Base folder: {baseFolder}</Text>
            <Button size="xs" onClick={() => setBaseFolder(null)}>Change</Button>
            <Button size="xs" onClick={performScan} loading={loading}>Rescan</Button>
          </Group>
          {tags.length > 0 && (
            <Group>
              <MultiSelect
                label="Include tags"
                data={tags}
                value={includeTags}
                onChange={setIncludeTags}
                clearable
                searchable
              />
              <MultiSelect
                label="Exclude tags"
                data={tags}
                value={excludeTags}
                onChange={setExcludeTags}
                clearable
                searchable
              />
              <Button onClick={performScan}>Apply Filters</Button>
            </Group>
          )}
          {error && <Text c="red">Error: {error}</Text>}
          {scan && (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Comment</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {scan.files.map(f => (
                  <Table.Tr key={f.filePath}>
                    <Table.Td>{f.filePath}</Table.Td>
                    <Table.Td>{f.comment}</Table.Td>
                    <Table.Td>
                      <Button size="xs" onClick={() => setSelectedFile(f.filePath)}>Edit</Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <PendingEditsManager onRefresh={performScan} />
          {history.length > 0 && (
            <Stack gap="xs">
              <Text fw={500}>Edit History</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Old</Table.Th>
                    <Table.Th>New</Table.Th>
                    <Table.Th>Reverted</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.map(h => (
                    <Table.Tr key={h.id}>
                      <Table.Td>{h.filePath}</Table.Td>
                      <Table.Td>{h.oldComment}</Table.Td>
                      <Table.Td>{h.newComment}</Table.Td>
                      <Table.Td>{h.reverted ? 'yes' : 'no'}</Table.Td>
                      <Table.Td>
                        {!h.reverted && (
                          <Button size="xs" onClick={() => handleRevert(h.id)}>Revert</Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          )}
        </Stack>
      )}
      <Modal opened={!!selectedFile} onClose={() => setSelectedFile(null)} size="lg">
        {selectedFile && (
          <MP3MetadataViewer
            filePath={selectedFile}
            availableTags={tags}
            onPendingEditAdded={performScan}
          />
        )}
      </Modal>
    </Stack>
  );
}
