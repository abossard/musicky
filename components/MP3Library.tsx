import React, { useEffect } from 'react';
import { Stack, Group, Text, Button, Box, ActionIcon } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconApps, IconX } from '@tabler/icons-react';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { GlobalAudioPlayer } from './GlobalAudioPlayer';
import { useMP3LibraryState } from '../lib/mp3-library-state';
import { useDataLoader, usePhaseActions, useEditActions, useKeepPlayHeadLoader } from '../lib/mp3-library-effects';
import { createTableColumns } from '../lib/mp3-table-config';
import { getRowClassName } from '../lib/mp3-data-utils';
import './MP3Library.css';

interface MP3LibraryProps {}

export function MP3Library({}: MP3LibraryProps) {
  const [state, dispatch] = useMP3LibraryState();
  const audioQueue = useAudioQueue();

  // Load keep play head setting on mount
  useKeepPlayHeadLoader(audioQueue);

  // Data loading and management
  const { loadData, refreshPendingEdits, updateSingleFile } = useDataLoader(dispatch);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Phase and edit actions
  const { handlePhaseToggle } = usePhaseActions(state, dispatch, { refreshPendingEdits });

  const { handleApplyEdit, handleRejectEdit } = useEditActions(state, dispatch, { refreshPendingEdits, updateSingleFile });

  const dismissError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };


  if (state.loading) {
    return (
      <Stack gap="md" className="mp3-library">
        <Text>Loading MP3 library...</Text>
      </Stack>
    );
  }

  // Table configuration
  const columns = createTableColumns({
    phases: state.phases,
    pendingEdits: state.pendingEdits,
    updatingFiles: state.updatingFiles,
    editActions: state.editActions,
    audioQueue,
    onPhaseToggle: handlePhaseToggle,
    onApplyEdit: handleApplyEdit,
    onRejectEdit: handleRejectEdit
  });

  return (
    <Stack gap="md" className="mp3-library">
      <Group justify="space-between">
        <Text size="xl" fw={700}>MP3 Library</Text>
        <Button onClick={loadData} disabled={state.loading} leftSection={<IconApps size={16} />}>
          {state.loading ? 'Loading...' : 'Refresh'}
        </Button>
      </Group>

      {/* Global Audio Player */}
      <GlobalAudioPlayer
        currentTrack={audioQueue.currentTrack}
        isPlaying={audioQueue.isPlaying}
        volume={audioQueue.volume}
        savedPosition={audioQueue.savedPosition}
        onPlayPauseChange={audioQueue.setIsPlaying}
        onVolumeChange={audioQueue.setVolume}
        onTimeUpdate={audioQueue.setCurrentTime}
        onError={(error) => {
          console.error('Audio player error:', error);
          dispatch({ type: 'SET_ERROR', error: `Audio error: ${error}` });
        }}
        onEnded={() => {
          console.log('Track ended');
          audioQueue.setIsPlaying(false);
        }}
      />
      
      {state.error && (
        <Box className="error-message">
          <Text>{state.error}</Text>
          <ActionIcon onClick={dismissError} variant="subtle" color="red">
            <IconX size={16} />
          </ActionIcon>
        </Box>
      )}

      {state.mp3Files.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl">
          No MP3 files found. Make sure the base folder is set and contains MP3 files.
        </Text>
      ) : (
        <Box>
          <Text size="sm" c="dimmed" mb="md">
            Found {state.mp3Files.length} MP3 file{state.mp3Files.length !== 1 ? 's' : ''}
          </Text>
          
          <DataTable
            withTableBorder
            borderRadius="sm"
            withColumnBorders
            striped
            highlightOnHover
            records={state.mp3Files}
            columns={columns}
            idAccessor="filePath"
            rowClassName={(file) => getRowClassName(
              file,
              state.pendingEdits,
              state.updatingFiles,
              audioQueue.currentTrack?.filePath
            )}
            noRecordsText="No MP3 files found"
          />
        </Box>
      )}
    </Stack>
  );
}