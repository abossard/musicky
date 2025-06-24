import React, { useEffect, useState } from 'react';
import { FileBrowser } from '../../components/FileBrowser';
import { MP3MetadataViewer } from '../../components/MP3MetadataViewer';
import { MP3Library } from '../../components/MP3Library';
import {
  onGetBaseFolder,
  onSetBaseFolder,
  onGetHistory,
  onRevertHistory
} from '../../components/MP3Library.telefunc';
import { onGetPhases } from '../../components/Settings.telefunc';
import type { MP3EditHistory } from '../../lib/mp3-library';
import { Modal, Button, Group, Stack, Text, Table, Paper, Tabs } from '@mantine/core';

export default function MP3LibraryPage() {
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [history, setHistory] = useState<MP3EditHistory[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [phases, setPhases] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const folder = await onGetBaseFolder();
      if (folder) {
        setBaseFolder(folder);
      }
      const p = await onGetPhases();
      setPhases(p);
    })();
  }, []);

  useEffect(() => {
    if (baseFolder) {
      loadHistory();
    }
  }, [baseFolder]);

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
      await loadHistory();
    } catch (err) {
      console.error(err);
    }
  };

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
          </Group>
          
          <Tabs defaultValue="library">
            <Tabs.List>
              <Tabs.Tab value="library">Library</Tabs.Tab>
              <Tabs.Tab value="history">History</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="library" pt="md">
              <MP3Library />
            </Tabs.Panel>

            <Tabs.Panel value="history" pt="md">
              {history.length > 0 ? (
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
              ) : (
                <Text c="dimmed" ta="center" py="xl">No edit history found</Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
      <Modal opened={!!selectedFile} onClose={() => setSelectedFile(null)} size="lg">
        {selectedFile && (
          <MP3MetadataViewer
            filePath={selectedFile}
            phases={phases}
            onPendingEditAdded={loadHistory}
          />
        )}
      </Modal>
    </Stack>
  );
}
