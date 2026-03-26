import { useState } from 'react';
import { ActionIcon, Tooltip, Popover, ScrollArea, Stack, Box, Text, Group, Badge, TextInput, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { TAG_PRESETS } from './moodboard-constants';
import type { TagCategory } from '../../lib/types';

interface TagPaletteProps {
  onAddTag: (label: string, category: TagCategory, color: string) => void;
}

export function TagPalette({ onAddTag }: TagPaletteProps) {
  const [opened, setOpened] = useState(false);
  const [customTagText, setCustomTagText] = useState('');

  const addTag = (label: string, category: TagCategory, color: string) => {
    onAddTag(label, category, color);
    setOpened(false);
  };

  const addCustomTag = () => {
    if (!customTagText.trim()) return;
    onAddTag(customTagText.trim(), 'custom', 'gray');
    setCustomTagText('');
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={320}>
      <Popover.Target>
        <Tooltip label="Add tag">
          <ActionIcon variant="light" color="cyan" onClick={() => setOpened(o => !o)} aria-label="Add tag">
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown style={{ background: '#25262b', border: '1px solid #373A40' }}>
        <ScrollArea.Autosize mah={400}>
          <Stack gap="sm">
            {TAG_PRESETS.map(preset => (
              <Box key={preset.category}>
                <Text size="xs" fw={600} mb={4}>{preset.emoji} {preset.title}</Text>
                <Group gap={6} wrap="wrap">
                  {preset.tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="light"
                      color={preset.color}
                      size="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => addTag(tag, preset.category, preset.color)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </Group>
              </Box>
            ))}
            <Box>
              <Text size="xs" fw={600} mb={4}>✏️ Custom</Text>
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  size="xs"
                  placeholder="Custom tag…"
                  value={customTagText}
                  onChange={e => setCustomTagText(e.currentTarget.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customTagText.trim()) addCustomTag();
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  disabled={!customTagText.trim()}
                  onClick={addCustomTag}
                >
                  Add
                </Button>
              </Group>
            </Box>
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
