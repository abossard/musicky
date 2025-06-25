import React, { useState } from 'react';
import { Box, Button, Group, Text, Paper, Stack } from '@mantine/core';
import { IconMusic } from '@tabler/icons-react';
import { AudioPlayer } from './AudioPlayer';

export interface AudioPlayerDemoProps {
  /** Path to the MP3 file */
  src: string;
  /** Display title for the track */
  title?: string;
  /** Artist name */
  artist?: string;
  /** Show as a collapsible demo */
  collapsible?: boolean;
}

export function AudioPlayerDemo({
  src,
  title = 'Audio Track',
  artist = 'Unknown Artist',
  collapsible = false
}: AudioPlayerDemoProps) {
  const [isVisible, setIsVisible] = useState(!collapsible);

  if (collapsible && !isVisible) {
    return (
      <Paper shadow="xs" p="md" radius="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconMusic size={20} />
            <Text fw={500}>{title}</Text>
            {artist && <Text size="sm" c="dimmed">by {artist}</Text>}
          </Group>
          <Button 
            variant="light" 
            size="xs"
            onClick={() => setIsVisible(true)}
          >
            Play
          </Button>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper shadow="sm" p="lg" radius="md">
      <Stack gap="md">
        {collapsible && (
          <Group justify="space-between">
            <Group gap="sm">
              <IconMusic size={20} />
              <Text fw={500}>Audio Player</Text>
            </Group>
            <Button 
              variant="subtle" 
              size="xs"
              onClick={() => setIsVisible(false)}
            >
              Hide
            </Button>
          </Group>
        )}
        
        <AudioPlayer
          src={src}
          title={title}
          artist={artist}
          onError={(error) => {
            console.error('Audio player error:', error);
            // You could show a notification here using Mantine's notifications
          }}
          onEnded={() => {
            console.log('Track ended');
            // You could auto-play the next track here if implementing a playlist
          }}
        />
      </Stack>
    </Paper>
  );
}

// Helper component for quick testing
export function QuickAudioDemo() {
  return (
    <Box maw={600} mx="auto" p="md">
      <AudioPlayerDemo
        src="/lifekiller.mp3"
        title="Life Killer"
        artist="Sample Track"
        collapsible={true}
      />
    </Box>
  );
}
