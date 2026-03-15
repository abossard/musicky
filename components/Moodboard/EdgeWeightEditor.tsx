import { Box, Group, Text, Slider, ActionIcon, CloseButton } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { Edge } from '@xyflow/react';

interface EdgeWeightEditorProps {
  edge: Edge;
  onWeightChange: (edgeId: string, weight: number) => void;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

export function EdgeWeightEditor({ edge, onWeightChange, onDelete, onClose }: EdgeWeightEditorProps) {
  return (
    <Box style={{
      position: 'absolute', bottom: 12, right: 12,
      background: 'rgba(37,38,43,0.9)', border: '1px solid #373A40', borderRadius: 6,
      padding: '8px 10px', zIndex: 100, width: 180, backdropFilter: 'blur(8px)',
    }}>
      <Group justify="space-between" mb={4}>
        <Text size="xs" fw={600}>{Math.round(((edge.data as any)?.weight ?? 1) * 100)}% <Text span size="xs" c="dimmed" tt="capitalize">{(edge.data as any)?.edgeType || ''}</Text></Text>
        <Group gap={4}>
          <ActionIcon variant="subtle" color="red" size="xs" onClick={() => { onDelete(edge.id); onClose(); }}>
            <IconTrash size={12} />
          </ActionIcon>
          <CloseButton size="xs" onClick={onClose} />
        </Group>
      </Group>
      <Slider
        min={0} max={1} step={0.05}
        value={(edge.data as any)?.weight ?? 1}
        onChange={(val) => onWeightChange(edge.id, val)}
        color="violet"
        size="xs"
      />
    </Box>
  );
}
