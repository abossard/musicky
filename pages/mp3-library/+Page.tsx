import React, { useEffect, useState } from 'react';
import { FileBrowser } from '../../components/FileBrowser';
import { MP3MetadataViewer } from '../../components/MP3MetadataViewer';
import {
  onGetBaseFolder,
  onSetBaseFolder,
  onFilterLibrary,
  onGetHistory,
  onRevertHistory,
  onGetPendingEdits,
  onApplyPendingEdit,
  onRejectPendingEdit
} from '../../components/MP3Library.telefunc';
import { onGetPhases } from '../../components/Settings.telefunc';
import type { MP3LibraryScan, MP3EditHistory } from '../../lib/mp3-library';
import type { PendingEdit } from '../../lib/mp3-metadata';
import { Modal, Button, Group, Stack, MultiSelect, Text, Table, Paper, Tabs, Badge } from '@mantine/core';
import '../../components/MP3Library.css';

export default function MP3LibraryPage() {
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [scan, setScan] = useState<MP3LibraryScan | null>(null);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [history, setHistory] = useState<MP3EditHistory[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [processingEdits, setProcessingEdits] = useState<Set<number>>(new Set());
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
      performScan();
      loadHistory();
      loadPendingEdits();
    }
  }, [baseFolder]);

  const loadPendingEdits = async () => {
    try {
      const edits = await onGetPendingEdits();
      setPendingEdits(edits.filter(edit => edit.status === 'pending'));
    } catch (err) {
      console.error('Failed to load pending edits:', err);
    }
  };

  const performScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onFilterLibrary(includeTags, excludeTags);
      setScan(result);
      await loadPendingEdits(); // Refresh pending edits when scanning
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

  const handleApplyEdit = async (editId: number) => {
    setProcessingEdits(prev => new Set([...prev, editId]));
    
    try {
      const result = await onApplyPendingEdit(editId);
      
      if (result.success) {
        await loadPendingEdits(); // Refresh pending edits
        await performScan(); // Refresh the library to show updated files
      } else {
        setError(`Failed to apply edit: ${result.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edit');
    } finally {
      setProcessingEdits(prev => {
        const newSet = new Set(prev);
        newSet.delete(editId);
        return newSet;
      });
    }
  };

  const handleRejectEdit = async (editId: number) => {
    setProcessingEdits(prev => new Set([...prev, editId]));
    
    try {
      const result = await onRejectPendingEdit(editId);
      
      if (result.success) {
        await loadPendingEdits(); // Refresh pending edits
      } else {
        setError(`Failed to reject edit: ${result.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject edit');
    } finally {
      setProcessingEdits(prev => {
        const newSet = new Set(prev);
        newSet.delete(editId);
        return newSet;
      });
    }
  };

  // Helper function to get pending edit for a file
  const getPendingEditForFile = (filePath: string): PendingEdit | undefined => {
    return pendingEdits.find(edit => edit.filePath === filePath && edit.status === 'pending');
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
          
          <Tabs defaultValue="library">
            <Tabs.List>
              <Tabs.Tab value="library">Library</Tabs.Tab>
              <Tabs.Tab value="history">History</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="library" pt="md">
              {tags.length > 0 && (
                <Group mb="md">
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
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {scan.files.map(f => {
                      const pendingEdit = getPendingEditForFile(f.filePath);
                      const isProcessing = pendingEdit ? processingEdits.has(pendingEdit.id) : false;
                      
                      return (
                        <Table.Tr key={f.filePath}>
                          <Table.Td>{f.filePath.split('/').pop()}</Table.Td>
                          <Table.Td>
                            {pendingEdit ? (
                              <div>
                                <div className="pending-comment-old">
                                  {f.comment || '(no comment)'}
                                </div>
                                <div className="pending-comment-new">
                                  → {pendingEdit.newComment}
                                </div>
                                <Badge size="xs" color="orange" mt={4}>Pending</Badge>
                              </div>
                            ) : (
                              f.comment || '(no comment)'
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Button size="xs" onClick={() => setSelectedFile(f.filePath)}>
                                Edit
                              </Button>
                              {pendingEdit && (
                                <>
                                  <Button 
                                    size="xs" 
                                    color="green"
                                    loading={isProcessing}
                                    onClick={() => handleApplyEdit(pendingEdit.id)}
                                  >
                                    Apply
                                  </Button>
                                  <Button 
                                    size="xs" 
                                    color="red"
                                    loading={isProcessing}
                                    onClick={() => handleRejectEdit(pendingEdit.id)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}
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
            onPendingEditAdded={performScan}
          />
        )}
      </Modal>
    </Stack>
  );
}
