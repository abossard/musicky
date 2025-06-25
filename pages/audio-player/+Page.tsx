import React from 'react';
import { Container, Title, Paper, Space } from '@mantine/core';
import { AudioPlayer } from '../../components/AudioPlayer';

export function Page() {
  return (
    <Container size="md" py="xl">
      <Title order={1} mb="lg">
        Audio Player Demo
      </Title>
      
      <Paper shadow="sm" p="lg" radius="md">
        <Title order={3} mb="md">
          Sample Track
        </Title>
        
        <AudioPlayer
          src="/lifekiller.mp3"
          title="Life Killer"
          artist="Unknown Artist"
          onError={(error: string) => console.error('Audio player error:', error)}
          onEnded={() => console.log('Track ended')}
        />
      </Paper>

      <Space h="xl" />

      <Paper shadow="sm" p="lg" radius="md">
        <Title order={3} mb="md">
          Features
        </Title>
        
        <ul>
          <li>Play/Pause controls with visual feedback</li>
          <li>Interactive progress bar with click-to-seek</li>
          <li>Drag seeking support</li>
          <li>Volume control with mute functionality</li>
          <li>Time display (current/total)</li>
          <li>Loading states and error handling</li>
          <li>Responsive design</li>
        </ul>
      </Paper>
    </Container>
  );
}
