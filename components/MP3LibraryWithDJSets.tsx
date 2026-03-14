import React, { useEffect } from 'react';
import { Stack, Group, Text, Button, Box, ActionIcon, Switch, Select, Badge, Alert } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconApps, IconX, IconMusic, IconCheck, IconPlus } from '@tabler/icons-react';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { GlobalAudioPlayer } from './GlobalAudioPlayer';
import { useMP3LibraryState } from '../lib/mp3-library-state';
import { useDataLoader, usePhaseActions, useEditActions, useKeepPlayHeadLoader } from '../lib/mp3-library-effects';
import { createTableColumns } from '../lib/mp3-table-config';
import { getRowClassName } from '../lib/mp3-data-utils';
import { useDJSetContext } from '../contexts/DJSetContext';
import './MP3Library.css';

interface MP3LibraryWithDJSetsProps {}

export function MP3LibraryWithDJSets({}: MP3LibraryWithDJSetsProps) {
  const [state, dispatch] = useMP3LibraryState();
  const audioQueue = useAudioQueue();
  const djSetContext = useDJSetContext();

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

  const handleAddSelectedToSet = async () => {
    try {
      await djSetContext.addSelectedToSet();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to add songs to set' });
    }
  };

  if (state.loading) {
    return (
      <Stack gap="md" className="mp3-library">
        <Text>Loading MP3 library...</Text>
      </Stack>
    );
  }

  // Enhanced table configuration with DJ Set support
  const columns = createTableColumns({
    phases: state.phases,
    pendingEdits: state.pendingEdits,
    updatingFiles: state.updatingFiles,
    editActions: state.editActions,
    audioQueue,
    onPhaseToggle: handlePhaseToggle,
    onApplyEdit: handleApplyEdit,
    onRejectEdit: handleRejectEdit,
    // DJ Set integration
    isDJSetMode: djSetContext.isDJSetMode,
    selectedFiles: djSetContext.selectedFiles,
    onFileSelect: djSetContext.toggleFileSelection
  });

  return (
    <Stack gap="md" className="mp3-library">
      <Group justify="space-between">
        <Text size="xl" fw={700}>MP3 Library</Text>
        <Button onClick={loadData} disabled={state.loading} leftSection={<IconApps size={16} />}>
          {state.loading ? 'Loading...' : 'Refresh'}
        </Button>
      </Group>

      {/* DJ Set Mode Controls */}
      <Box>
        <Group mb="md">
          <Switch
            data-testid="dj-set-mode-toggle"
            label="DJ Set Mode"
            description="Enable to select songs for DJ sets"
            checked={djSetContext.isDJSetMode}
            onChange={(event) => djSetContext.setDJSetMode(event.currentTarget.checked)}
            leftSection={<IconMusic size={16} />}
          />
        </Group>

        {djSetContext.isDJSetMode && (
          <Stack gap="sm">
            <Group>
              <Select
                data-testid="active-set-selector"
                placeholder="Select active DJ set"
                value={djSetContext.activeSet?.id.toString() || null}
                onChange={(value) => {
                  const set = djSetContext.availableSets.find(s => s.id.toString() === value);
                  djSetContext.setActiveSet(set || null);
                }}
                data={djSetContext.availableSets.map(set => ({
                  value: set.id.toString(),
                  label: set.name
                }))}
                style={{ flex: 1 }}
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={djSetContext.refreshSets}
                leftSection={<IconApps size={16} />}
              >
                Refresh Sets
              </Button>
            </Group>

            {djSetContext.activeSet && (
              <Alert color="blue" variant="light">
                <Group justify="space-between">
                  <Text size="sm">
                    Active set: <strong>{djSetContext.activeSet.name}</strong>
                    {djSetContext.selectedFiles.length > 0 && (
                      <Badge ml="xs" variant="light">
                        {djSetContext.selectedFiles.length} selected
                      </Badge>
                    )}
                  </Text>
                  
                  {djSetContext.selectedFiles.length > 0 && (
                    <Group>
                      <Button
                        data-testid="add-to-set-button"
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={handleAddSelectedToSet}
                        loading={djSetContext.loading}
                      >
                        Add to Set
                      </Button>
                      <Button
                        data-testid="clear-selection-button"
                        size="xs"
                        variant="outline"
                        onClick={djSetContext.clearSelection}
                      >
                        Clear Selection
                      </Button>
                    </Group>
                  )}
                </Group>
              </Alert>
            )}

            {djSetContext.isDJSetMode && !djSetContext.activeSet && (
              <Alert color="orange" variant="light">
                <Text size="sm">
                  Select a DJ set to start adding songs. You can create new sets from the DJ Sets page.
                </Text>
              </Alert>
            )}
          </Stack>
        )}
      </Box>

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
            {djSetContext.isDJSetMode && djSetContext.selectedFiles.length > 0 && (
              <> • {djSetContext.selectedFiles.length} selected</>
            )}
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
            rowClassName={(file) => {
              const baseClassName = getRowClassName(
                file,
                state.pendingEdits,
                state.updatingFiles,
                audioQueue.currentTrack?.filePath
              );
              
              // Add selected class for DJ Set mode
              if (djSetContext.isDJSetMode && djSetContext.selectedFiles.includes(file.filePath)) {
                return `${baseClassName} selected-for-dj-set`;
              }
              
              return baseClassName;
            }}
            noRecordsText="No MP3 files found"
          />
        </Box>
      )}
    </Stack>
  );
}