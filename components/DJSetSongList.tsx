import React, { useState, useEffect } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  ActionIcon, 
  Card,
  Box,
  Badge,
  Loader
} from '@mantine/core';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconTrash, IconPlus } from '@tabler/icons-react';
import { onGetSetItems, onRemoveSongFromSet, onReorderSetItems } from './DJSetItems.telefunc';
import type { DJSetItem } from '../database/sqlite/queries/dj-sets';
// Browser-compatible basename function
const basename = (path: string): string => {
  return path.split('/').pop() || path.split('\\').pop() || path;
};

interface DJSetSongListProps {
  setId: number;
  onAddSongAfter: (position: number) => void;
  onItemsChange?: () => void;
}

interface SortableItemProps {
  item: DJSetItem;
  onRemove: (itemId: number) => void;
  onAddAfter: (position: number) => void;
}

function SortableItem({ item, onRemove, onAddAfter }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDisplayName = (filePath: string) => {
    const filename = basename(filePath);
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    return nameWithoutExt;
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card withBorder p="sm" mb="xs">
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              color="gray"
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab' }}
            >
              <IconGripVertical size={16} />
            </ActionIcon>
            
            <Box>
              <Text size="sm" fw={500}>
                {getDisplayName(item.file_path)}
              </Text>
              <Text size="xs" c="dimmed">
                {item.file_path}
              </Text>
            </Box>
          </Group>

          <Group>
            <Badge variant="light" size="sm">
              #{item.position + 1}
            </Badge>
            
            <ActionIcon
              data-testid="add-after-button"
              variant="subtle"
              color="blue"
              onClick={() => onAddAfter(item.position)}
              title="Add song after this one"
            >
              <IconPlus size={16} />
            </ActionIcon>
            
            <ActionIcon
              data-testid="remove-song-button"
              variant="subtle"
              color="red"
              onClick={() => onRemove(item.id)}
              title="Remove from set"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>
    </div>
  );
}

export function DJSetSongList({ setId, onAddSongAfter, onItemsChange }: DJSetSongListProps) {
  const [items, setItems] = useState<DJSetItem[]>([]);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (setId) {
      loadItems();
    }
  }, [setId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const setItems = await onGetSetItems(setId);
      setItems(setItems);
    } catch (error) {
      console.error('Error loading set items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    try {
      await onRemoveSongFromSet(setId, itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      onItemsChange?.();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      try {
        const itemIds = newItems.map(item => item.id);
        await onReorderSetItems(setId, itemIds);
        onItemsChange?.();
      } catch (error) {
        console.error('Error reordering items:', error);
        // Revert on error
        setItems(items);
      }
    }
  };

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="sm" />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Card withBorder p="xl" style={{ textAlign: 'center' }}>
        <Text c="dimmed" size="sm">
          This set is empty. Add some songs to get started!
        </Text>
        <ActionIcon
          data-testid="add-first-song-button"
          variant="outline"
          size="lg"
          mt="md"
          onClick={() => onAddSongAfter(-1)}
        >
          <IconPlus size={20} />
        </ActionIcon>
      </Card>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" mb="md">
        <Text size="sm" fw={500}>
          {items.length} song{items.length !== 1 ? 's' : ''} in set
        </Text>
        
        <ActionIcon
          data-testid="add-song-button"
          variant="outline"
          onClick={() => onAddSongAfter(-1)}
          title="Add song at the beginning"
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onRemove={handleRemoveItem}
              onAddAfter={onAddSongAfter}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Stack>
  );
}