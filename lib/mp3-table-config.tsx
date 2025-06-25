import React from 'react';
import { Checkbox, Stack, Group, Badge, Text, Button, Box, Image, ActionIcon } from '@mantine/core';
import { IconMusic, IconX } from '@tabler/icons-react';
import { MP3Metadata, PendingEdit } from './mp3-metadata';
import { PlayButton } from '../components/PlayButton';
import { 
  getDisplayTitle, 
  getDisplayArtist, 
  getDisplayGenre, 
  findPendingEdit, 
  getEffectivePhases 
} from './mp3-data-utils';

export interface ColumnConfig {
  accessor: string;
  title: string;
  width?: number;
  render: (file: MP3Metadata) => React.ReactNode;
}

export interface TableConfigOptions {
  phases: string[];
  pendingEdits: PendingEdit[];
  updatingFiles: Set<string>;
  editActions: { [key: number]: 'apply' | 'reject' };
  audioQueue: {
    currentTrack?: MP3Metadata | null;
    isPlaying: boolean;
    playTrack: (track: MP3Metadata) => void;
  };
  onPhaseToggle: (filePath: string, phase: string, checked: boolean) => void;
  onApplyEdit: (editId: number) => void;
  onRejectEdit: (editId: number) => void;
}

export const createTableColumns = (options: TableConfigOptions): ColumnConfig[] => {
  const {
    phases,
    pendingEdits,
    updatingFiles,
    editActions,
    audioQueue,
    onPhaseToggle,
    onApplyEdit,
    onRejectEdit
  } = options;

  return [
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
        />
      ),
    },
    {
      accessor: 'artworkDataUrl',
      title: 'Album Art',
      width: 80,
      render: (file: MP3Metadata) => (
        <Box className="artwork-thumbnail">
          {file.artworkDataUrl ? (
            <Image
              src={file.artworkDataUrl}
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
      render: (file: MP3Metadata) => (
        <Text size="sm" fw={500} title={file.filePath}>
          {getDisplayTitle(file)}
        </Text>
      ),
    },
    {
      accessor: 'artist',
      title: 'Artist',
      render: (file: MP3Metadata) => (
        <Text size="sm">{getDisplayArtist(file)}</Text>
      ),
    },
    {
      accessor: 'genre',
      title: 'Genre',
      render: (file: MP3Metadata) => (
        <Text size="sm">{getDisplayGenre(file)}</Text>
      ),
    },
    {
      accessor: 'phases',
      title: 'Phases',
      width: 250,
      render: (file: MP3Metadata) => {
        const currentPhases = getEffectivePhases(pendingEdits, phases, file.filePath, file.comment || '');
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
                  onPhaseToggle(file.filePath, phase, event.currentTarget.checked)
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
        const pendingEdit = findPendingEdit(pendingEdits, file.filePath);
        const isUpdating = updatingFiles.has(file.filePath);

        return (
          <Group gap="xs">
            {pendingEdit ? (
              <>
                <Button
                  size="xs"
                  color="green"
                  onClick={() => onApplyEdit(pendingEdit.id)}
                  disabled={isUpdating || !!editActions[pendingEdit.id]}
                  loading={editActions[pendingEdit.id] === 'apply'}
                >
                  Apply
                </Button>
                <ActionIcon
                  size="sm"
                  color="red"
                  onClick={() => onRejectEdit(pendingEdit.id)}
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
};