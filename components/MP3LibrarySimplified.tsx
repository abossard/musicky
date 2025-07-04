/**
 * Simplified MP3Library Component
 * 
 * Following "A Philosophy of Software Design" principles:
 * - Reduced surface area with simpler interface
 * - Deep modules hiding complex table configuration
 * - Clear separation of concerns
 */

import React from 'react';
import { Stack, Group, Text, Button, Alert } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconApps, IconX, IconAlertCircle } from '@tabler/icons-react';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { useMusicLibrary, usePendingEdits } from '../hooks/use-music-library';
import { GlobalAudioPlayer } from './GlobalAudioPlayer';
import { createSimplifiedTableColumns } from '../lib/mp3-table-simplified';
import { getRowClassName } from '../lib/mp3-data-utils';
import './MP3Library.css';

interface MP3LibraryProps {}

/**
 * Main MP3 Library component with simplified architecture.
 * Uses stratified design with clear separation between data, business logic, and UI.
 */
export function MP3Library({}: MP3LibraryProps) {
  // Data layer - single source of truth
  const library = useMusicLibrary();
  const pendingEdits = usePendingEdits();
  const audioQueue = useAudioQueue();

  // Business logic layer - pure functions for data transformations
  const handlePhaseToggle = async (filePath: string, phase: string) => {
    try {
      const { togglePhaseForFile } = await import('../lib/mp3-business-logic');
      const updatedFile = await togglePhaseForFile(filePath, phase);
      library.updateFile(updatedFile);
    } catch (error) {
      console.error('Phase toggle failed:', error);
    }
  };

  // Error display helper
  const renderError = (error: string) => (
    <Alert
      icon={<IconAlertCircle size={16} />}
      title="Error"
      color="red"
      withCloseButton
      onClose={library.clearError}
      mb="md"
    >
      {error}
    </Alert>
  );

  // Loading state
  if (library.loading && library.data.files.length === 0) {
    return (
      <Stack gap="md" className="mp3-library">
        <Text>Loading MP3 library...</Text>
      </Stack>
    );
  }

  // Table configuration - abstracted to hide complexity
  const columns = createSimplifiedTableColumns({
    phases: library.data.phases,
    pendingEdits: library.data.pendingEdits,
    audioQueue,
    onPhaseToggle: handlePhaseToggle,
    onApplyEdit: pendingEdits.applyEdit,
    onRejectEdit: pendingEdits.rejectEdit
  });

  return (
    <Stack gap="md" className="mp3-library">
      {/* Header with actions */}
      <Group justify="space-between">
        <Text size="xl" fw={700}>MP3 Library</Text>
        <Button 
          onClick={() => library.loadData()} 
          disabled={library.loading} 
          leftSection={<IconApps size={16} />}
        >
          {library.loading ? 'Loading...' : 'Refresh'}
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
        onError={(error) => console.error('Audio error:', error)}
        onEnded={() => audioQueue.setIsPlaying(false)}
      />
      
      {/* Error display */}
      {library.error && renderError(library.error)}
      {pendingEdits.error && renderError(pendingEdits.error)}

      {/* Main content */}
      {library.data.files.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl">
          No MP3 files found. Make sure the base folder is set and contains MP3 files.
        </Text>
      ) : (
        <Stack>
          <Text size="sm" c="dimmed">
            Found {library.data.files.length} MP3 file{library.data.files.length !== 1 ? 's' : ''}
            {library.data.pendingEdits.length > 0 && (
              <>, {library.data.pendingEdits.length} pending edit{library.data.pendingEdits.length !== 1 ? 's' : ''}</>
            )}
          </Text>
          
          <DataTable
            withTableBorder
            borderRadius="sm"
            withColumnBorders
            striped
            highlightOnHover
            records={library.data.files}
            columns={columns}
            idAccessor="filePath"
            rowClassName={(file) => getRowClassName(
              file,
              library.data.pendingEdits,
              new Set(), // No updating files state needed with simplified approach
              audioQueue.currentTrack?.filePath
            )}
            noRecordsText="No MP3 files found"
          />
        </Stack>
      )}
    </Stack>
  );
}