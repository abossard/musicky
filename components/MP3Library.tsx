import React, { useState, useEffect } from 'react';
import { Checkbox, Stack, Group, Badge, Text, Button, Box, Image, ActionIcon } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconMusic, IconApps, IconX } from '@tabler/icons-react';
import type { MP3Metadata, PendingEdit } from '../lib/mp3-metadata';
import { onGetAllMP3Files, onUpdateFilePhases, onGetPendingEdits, onApplyPendingEdit, onRejectPendingEdit, onGetSingleMP3File } from './MP3Library.telefunc';
import { onGetPhases } from './Settings.telefunc';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { GlobalAudioPlayer } from './GlobalAudioPlayer';
import { PlayButton } from './PlayButton';
import './MP3Library.css';

interface MP3LibraryProps {}

export function MP3Library({}: MP3LibraryProps) {
  const [mp3Files, setMp3Files] = useState<MP3Metadata[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFiles, setUpdatingFiles] = useState<Set<string>>(new Set());
  const [editActions, setEditActions] = useState<{ [key: number]: 'apply' | 'reject' }>({});
  
  // Audio queue management
  const audioQueue = useAudioQueue();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [scanResult, availablePhases, edits] = await Promise.all([
        onGetAllMP3Files(),
        onGetPhases(),
        onGetPendingEdits()
      ]);
      
      setMp3Files(scanResult.files);
      setPhases(availablePhases);
      setPendingEdits(edits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MP3 library');
    } finally {
      setLoading(false);
    }
  };

  const refreshPendingEdits = async () => {
    try {
      const edits = await onGetPendingEdits();
      setPendingEdits(edits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh pending edits');
    }
  };

  const updateSingleFile = async (filePath: string) => {
    try {
      console.log(`[MP3Library] Updating metadata for file: ${filePath}`);
      const result = await onGetSingleMP3File(filePath);
      
      if (result.success && result.file) {
        setMp3Files(prev => prev.map(file => 
          file.filePath === filePath ? result.file : file
        ));
        console.log(`[MP3Library] Successfully updated metadata for: ${filePath}`);
      } else {
        console.warn(`[MP3Library] Failed to update file metadata: ${result.error}`);
        setError(result.error || 'Failed to update file metadata');
      }
    } catch (err) {
      console.error(`[MP3Library] Error updating single file:`, err);
      setError(err instanceof Error ? err.message : 'Failed to update file metadata');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getFilePhases = (comment: string): string[] => {
    const hashtags = comment.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.slice(1)).filter(tag => phases.includes(tag));
  };

  const getFilePendingEdit = (filePath: string): PendingEdit | undefined => {
    return pendingEdits.find(edit => edit.filePath === filePath && edit.status === 'pending');
  };

  const getEffectiveComment = (filePath: string, originalComment: string): string => {
    const pendingEdit = getFilePendingEdit(filePath);
    return pendingEdit ? pendingEdit.newComment : originalComment;
  };

  const getEffectivePhases = (filePath: string, originalComment: string): string[] => {
    const effectiveComment = getEffectiveComment(filePath, originalComment);
    return getFilePhases(effectiveComment);
  };

  const handlePhaseToggle = async (filePath: string, phase: string, checked: boolean) => {
    setUpdatingFiles(prev => new Set([...prev, filePath]));
    
    try {
      const file = mp3Files.find(f => f.filePath === filePath);
      if (!file) return;
      
      const effectiveComment = getEffectiveComment(filePath, file.comment || '');
      const currentPhases = getFilePhases(effectiveComment);
      const newPhases = checked 
        ? [...currentPhases, phase]
        : currentPhases.filter(p => p !== phase);
      
      const result = await onUpdateFilePhases(filePath, newPhases);
      
      if (result.success) {
        // Only refresh pending edits, not all data
        await refreshPendingEdits();
      } else {
        setError(result.error || 'Failed to update phases');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update phases');
    } finally {
      setUpdatingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  const handleApplyEdit = async (editId: number) => {
    setEditActions(prev => ({ ...prev, [editId]: 'apply' }));
    try {
      // Find the edit to get the file path before applying
      const edit = pendingEdits.find(e => e.id === editId);
      if (!edit) {
        setError('Edit not found');
        return;
      }
      
      const result = await onApplyPendingEdit(editId);
      if (result.success) {
        // Refresh pending edits AND update the affected file's metadata
        await Promise.all([
          refreshPendingEdits(),
          updateSingleFile(edit.filePath)
        ]);
      } else {
        setError(result.error || 'Failed to apply edit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edit');
    } finally {
      setEditActions(prev => {
        const newState = { ...prev };
        delete newState[editId];
        return newState;
      });
    }
  };

  const handleRejectEdit = async (editId: number) => {
    setEditActions(prev => ({ ...prev, [editId]: 'reject' }));
    try {
      const result = await onRejectPendingEdit(editId);
      if (result.success) {
        await refreshPendingEdits();
      } else {
        setError(result.error || 'Failed to reject edit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject edit');
    } finally {
      setEditActions(prev => {
        const newState = { ...prev };
        delete newState[editId];
        return newState;
      });
    }
  };

  const dismissError = () => {
    setError(null);
  };

  // Helper function to format genre array as string
  const formatGenre = (genre?: string[]) => {
    if (!genre || genre.length === 0) return '—';
    return genre.join(', ');
  };

  // Helper function to format track number
  const formatTrack = (track?: { no: number | null; of: number | null }) => {
    if (!track || !track.no) return '—';
    if (track.of) return `${track.no}/${track.of}`;
    return track.no.toString();
  };

  // Helper function to get filename from path
  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  if (loading) {
    return (
      <Stack gap="md" className="mp3-library">
        <Text>Loading MP3 library...</Text>
      </Stack>
    );
  }

  const columns = [
    {
      accessor: 'play',
      title: 'Play',
      width: 60,
      render: (file: MP3Metadata) => (
        <PlayButton
          track={file}
          isCurrentTrack={audioQueue.currentTrack?.filePath === file.filePath}
          isPlaying={audioQueue.isPlaying}
          onPlayTrack={audioQueue.playTrack}
          onTogglePlayPause={audioQueue.togglePlayPause}
        />
      ),
    },
    {
      accessor: 'artworkDataUrl',
      title: 'Album Art',
      width: 80,
      render: ({ artworkDataUrl }: MP3Metadata) => (
        <Box className="artwork-thumbnail">
          {artworkDataUrl ? (
            <Image
              src={artworkDataUrl}
              alt="Album artwork"
              className="artwork-image"
              w={50}
              h={50}
              fit="cover"
              radius="sm"
            />
          ) : (
            <Box className="artwork-placeholder">
              <IconMusic size={20} />
            </Box>
          )}
        </Box>
      ),
    },
    {
      accessor: 'title',
      title: 'Song Name',
      render: ({ title, filePath }: MP3Metadata) => (
        <Text size="sm" fw={500} title={filePath}>
          {title || getFileName(filePath)}
        </Text>
      ),
    },
    {
      accessor: 'artist',
      title: 'Artist',
      render: ({ artist }: MP3Metadata) => (
        <Text size="sm">{artist || '—'}</Text>
      ),
    },
    {
      accessor: 'genre',
      title: 'Genre',
      render: ({ genre }: MP3Metadata) => (
        <Text size="sm">{formatGenre(genre)}</Text>
      ),
    },
    {
      accessor: 'phases',
      title: 'Phases',
      width: 250,
      render: (file: MP3Metadata) => {
        const pendingEdit = getFilePendingEdit(file.filePath);
        const effectiveComment = getEffectiveComment(file.filePath, file.comment || '');
        const currentPhases = getFilePhases(effectiveComment);
        const isUpdating = updatingFiles.has(file.filePath);

        return (
          <Stack gap="xs">
            {phases.map((phase) => (
              <Checkbox
                key={phase}
                label={phase}
                size="xs"
                checked={currentPhases.includes(phase)}
                onChange={(event) => 
                  handlePhaseToggle(file.filePath, phase, event.currentTarget.checked)
                }
                disabled={isUpdating}
              />
            ))}
          </Stack>
        );
      },
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 140,
      render: (file: MP3Metadata) => {
        const pendingEdit = getFilePendingEdit(file.filePath);
        const isUpdating = updatingFiles.has(file.filePath);

        return (
          <Group gap="xs">
            {pendingEdit ? (
              <>
                <Button
                  size="xs"
                  color="green"
                  onClick={() => handleApplyEdit(pendingEdit.id)}
                  disabled={isUpdating || !!editActions[pendingEdit.id]}
                  loading={editActions[pendingEdit.id] === 'apply'}
                >
                  Apply
                </Button>
                <ActionIcon
                  size="sm"
                  color="red"
                  onClick={() => handleRejectEdit(pendingEdit.id)}
                  disabled={isUpdating || !!editActions[pendingEdit.id]}
                  loading={editActions[pendingEdit.id] === 'reject'}
                >
                  <IconX size={14} />
                </ActionIcon>
              </>
            ) : (
              <Text size="xs" c="dimmed">No pending</Text>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack gap="md" className="mp3-library">
      <Group justify="space-between">
        <Text size="xl" fw={700}>MP3 Library</Text>
        <Button onClick={loadData} disabled={loading} leftSection={<IconApps size={16} />}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </Group>

      {/* Global Audio Player */}
      <GlobalAudioPlayer
        currentTrack={audioQueue.currentTrack}
        isPlaying={audioQueue.isPlaying}
        volume={audioQueue.volume}
        onPlayPauseChange={audioQueue.setIsPlaying}
        onVolumeChange={audioQueue.setVolume}
        onError={(error) => {
          console.error('Audio player error:', error);
          setError(`Audio error: ${error}`);
        }}
        onEnded={() => {
          console.log('Track ended');
          audioQueue.setIsPlaying(false);
        }}
      />
      
      {error && (
        <Box className="error-message">
          <Text>{error}</Text>
          <ActionIcon onClick={dismissError} variant="subtle" color="red">
            <IconX size={16} />
          </ActionIcon>
        </Box>
      )}

      {mp3Files.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl">
          No MP3 files found. Make sure the base folder is set and contains MP3 files.
        </Text>
      ) : (
        <Box>
          <Text size="sm" c="dimmed" mb="md">
            Found {mp3Files.length} MP3 file{mp3Files.length !== 1 ? 's' : ''}
          </Text>
          
          <DataTable
            withTableBorder
            borderRadius="sm"
            withColumnBorders
            striped
            highlightOnHover
            records={mp3Files}
            columns={columns}
            rowClassName={(file) => {
              const pendingEdit = getFilePendingEdit(file.filePath);
              const isUpdating = updatingFiles.has(file.filePath);
              const hasPending = !!pendingEdit;
              const isCurrentTrack = audioQueue.currentTrack?.filePath === file.filePath;
              
              const classes = [];
              if (isUpdating) classes.push('updating');
              if (hasPending) classes.push('has-pending');
              if (isCurrentTrack) classes.push('current-track');
              
              return classes.join(' ');
            }}
            noRecordsText="No MP3 files found"
          />
        </Box>
      )}
    </Stack>
  );
}