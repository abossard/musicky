import React, { useState } from 'react';
import { Stack, Title, Card, Group, Button, Text, Alert } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMusic, IconInfoCircle } from '@tabler/icons-react';
import { DJSetSelector } from '../../components/DJSetSelector';
import { DJSetSongList } from '../../components/DJSetSongList';
import { SongSearchPopup } from '../../components/SongSearchPopup';

export default function DJSetsPage() {
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [insertAfterPosition, setInsertAfterPosition] = useState(-1);
  const [searchPopupOpened, searchPopupHandlers] = useDisclosure(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddSongAfter = (position: number) => {
    setInsertAfterPosition(position);
    searchPopupHandlers.open();
  };

  const handleSongAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSetChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>
          <Group>
            <IconMusic size={24} />
            DJ Set Management
          </Group>
        </Title>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} title="Getting Started" color="blue">
        <Text size="sm">
          Create a new DJ set or select an existing one to start building your playlist. 
          You can search for songs from your music library and drag to reorder them.
        </Text>
      </Alert>

      <Card withBorder p="lg">
        <Stack gap="md">
          <Text fw={500} size="lg">Select DJ Set</Text>
          <DJSetSelector
            selectedSetId={selectedSetId}
            onSetSelect={setSelectedSetId}
            onSetChange={handleSetChange}
          />
        </Stack>
      </Card>

      {selectedSetId && (
        <Card withBorder p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500} size="lg">Songs in Set</Text>
              <Button
                data-testid="add-song-main-button"
                variant="outline"
                size="sm"
                leftSection={<IconMusic size={16} />}
                onClick={() => handleAddSongAfter(-1)}
              >
                Add Song
              </Button>
            </Group>

            <DJSetSongList
              key={refreshKey}
              setId={selectedSetId}
              onAddSongAfter={handleAddSongAfter}
              onItemsChange={handleSongAdded}
            />
          </Stack>
        </Card>
      )}

      {selectedSetId && (
        <SongSearchPopup
          opened={searchPopupOpened}
          onClose={searchPopupHandlers.close}
          setId={selectedSetId}
          insertAfterPosition={insertAfterPosition}
          onSongAdded={() => {
            handleSongAdded();
            searchPopupHandlers.close();
          }}
        />
      )}
    </Stack>
  );
}