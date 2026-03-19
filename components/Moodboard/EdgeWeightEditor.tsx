import { Box, Group, Text, Slider, ActionIcon, CloseButton } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { Edge } from '@xyflow/react';
import { EDGE_MEANINGS, type EdgeType } from './moodboard-constants';

interface EdgeWeightEditorProps {
  edge: Edge;
  position: { x: number; y: number };
  onWeightChange: (edgeId: string, weight: number) => void;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

export function EdgeWeightEditor({ edge, position, onWeightChange, onDelete, onClose }: EdgeWeightEditorProps) {
  const edgeType = ((edge.data as any)?.edgeType || 'custom') as EdgeType;

  return (
    <Box style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      transform: 'translate(-50%, calc(-100% - 12px))',
      background: 'rgba(37,38,43,0.96)',
      border: '1px solid #373A40',
      borderRadius: 8,
      padding: '10px 12px',
      zIndex: 100,
      width: 240,
      backdropFilter: 'blur(10px)',
      boxShadow: '0 10px 32px rgba(0, 0, 0, 0.35)',
    }}>
      <Box style={{
        position: 'absolute',
        left: '50%',
        bottom: -7,
        width: 14,
        height: 14,
        transform: 'translateX(-50%) rotate(45deg)',
        background: 'rgba(37,38,43,0.96)',
        borderRight: '1px solid #373A40',
        borderBottom: '1px solid #373A40',
      }} />
      <Group justify="space-between" mb={6}>
        <Text size="xs" fw={700} tt="capitalize">{edgeType}</Text>
        <Group gap={4}>
          <ActionIcon variant="subtle" color="red" size="xs" onClick={() => { onDelete(edge.id); onClose(); }}>
            <IconTrash size={12} />
          </ActionIcon>
          <CloseButton size="xs" onClick={onClose} />
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mb={8} style={{ lineHeight: 1.35 }}>
        {EDGE_MEANINGS[edgeType]}
      </Text>
      <Text size="xs" fw={600} mb={4}>
        Weight {Math.round(((edge.data as any)?.weight ?? 1) * 100)}%
      </Text>
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
