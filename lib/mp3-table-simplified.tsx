/**
 * Simplified Table Configuration
 * 
 * Following "A Philosophy of Software Design":
 * - Deep modules hiding complex column configuration
 * - Information hiding of implementation details
 * - Simple, focused interface
 */

import React from 'react';
import { DataTableColumn } from 'mantine-datatable';
import { Group, Button, Badge, ActionIcon, Text } from '@mantine/core';
import { IconPlay, IconCheck, IconX } from '@tabler/icons-react';
import { MP3Metadata, PendingEdit } from './mp3-metadata';
import { AudioQueueType } from '../hooks/useAudioQueue';

interface TableColumnConfig {
  phases: string[];
  pendingEdits: PendingEdit[];
  audioQueue: AudioQueueType;
  onPhaseToggle: (filePath: string, phase: string) => Promise<void>;
  onApplyEdit: (editId: number) => Promise<void>;
  onRejectEdit: (editId: number) => Promise<void>;
}

/**
 * Creates simplified table columns with essential functionality only.
 * Hides complex implementation details behind a clean interface.
 */
export function createSimplifiedTableColumns(config: TableColumnConfig): DataTableColumn<MP3Metadata>[] {
  const { phases, pendingEdits, audioQueue, onPhaseToggle, onApplyEdit, onRejectEdit } = config;

  return [
    // Play button column
    {
      accessor: 'play',
      title: '',
      width: 50,
      render: (file) => (
        <ActionIcon
          variant="subtle"
          onClick={() => audioQueue.playFile(file)}
          color={audioQueue.currentTrack?.filePath === file.filePath ? 'blue' : 'gray'}
        >
          <IconPlay size={14} />
        </ActionIcon>
      )
    },

    // File info column
    {
      accessor: 'info',
      title: 'Track',
      render: (file) => (
        <div>
          <Text size="sm" fw={500}>
            {file.title || getFileName(file.filePath)}
          </Text>
          <Text size="xs" c="dimmed">
            {file.artist && `${file.artist} • `}{file.album}
          </Text>
        </div>
      )
    },

    // Phase badges column
    {
      accessor: 'phases',
      title: 'Phases',
      render: (file) => {
        const activePhases = extractActivePhases(file.comment || '', phases);
        return (
          <Group gap="xs">
            {activePhases.map(phase => (
              <Badge
                key={phase}
                size="sm"
                variant="filled"
                style={{ cursor: 'pointer' }}
                onClick={() => onPhaseToggle(file.filePath, phase)}
              >
                {phase}
              </Badge>
            ))}
          </Group>
        );
      }
    },

    // Pending edits column
    {
      accessor: 'pendingEdits',
      title: 'Edits',
      render: (file) => {
        const fileEdits = getPendingEditsForFile(file.filePath, pendingEdits);
        if (fileEdits.length === 0) return null;

        return (
          <Group gap="xs">
            {fileEdits.map(edit => (
              <Group key={edit.id} gap={4}>
                <Badge size="sm" color="orange">
                  Edit
                </Badge>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="green"
                  onClick={() => onApplyEdit(edit.id)}
                >
                  <IconCheck size={12} />
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => onRejectEdit(edit.id)}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Group>
            ))}
          </Group>
        );
      }
    },

    // Duration column
    {
      accessor: 'duration',
      title: 'Duration',
      width: 100,
      render: (file) => formatDuration(file.duration)
    }
  ];
}

// Helper functions - pure calculations
function getFileName(filePath: string): string {
  return filePath.split('/').pop()?.replace('.mp3', '') || 'Unknown';
}

function extractActivePhases(comment: string, availablePhases: string[]): string[] {
  const hashtagRegex = /#(\w+)/g;
  const tags = [];
  let match;
  
  while ((match = hashtagRegex.exec(comment)) !== null) {
    const tag = match[1].toLowerCase();
    if (availablePhases.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return [...new Set(tags)];
}

function getPendingEditsForFile(filePath: string, pendingEdits: PendingEdit[]): PendingEdit[] {
  return pendingEdits.filter(edit => edit.filePath === filePath);
}

function formatDuration(duration?: number): string {
  if (!duration) return '--:--';
  
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}