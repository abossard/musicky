import { Box, Group, Text, Slider, ActionIcon, CloseButton, SegmentedControl } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { Edge } from '@xyflow/react';
import { EDGE_MEANINGS, EDGE_COLORS, type EdgeType } from './moodboard-constants';

const EDGE_TYPE_OPTIONS: EdgeType[] = ['genre', 'phase', 'mood', 'similarity', 'topic', 'custom'];

interface EdgeWeightEditorProps {
  edge: Edge;
  position: { x: number; y: number };
  onWeightChange: (edgeId: string, weight: number) => void;
  onTypeChange?: (edgeId: string, newType: string) => void;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

function ColorDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: color,
      marginRight: 6,
      verticalAlign: 'middle',
    }} />
  );
}

export function EdgeWeightEditor({ edge, position, onWeightChange, onTypeChange, onDelete, onClose }: EdgeWeightEditorProps) {
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
      width: 280,
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
        <Text size="xs" fw={700} tt="capitalize">
          <ColorDot color={EDGE_COLORS[edgeType]} />
          {edgeType}
        </Text>
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

      {onTypeChange && (
        <>
          <Text size="xs" fw={600} mb={4}>Type</Text>
          <SegmentedControl
            size="xs"
            fullWidth
            value={edgeType}
            onChange={(val) => onTypeChange(edge.id, val)}
            data={EDGE_TYPE_OPTIONS.map(t => ({
              label: (
                <Group gap={4} wrap="nowrap" justify="center">
                  <ColorDot color={EDGE_COLORS[t]} />
                  <span style={{ fontSize: 10, textTransform: 'capitalize' }}>{t}</span>
                </Group>
              ),
              value: t,
            }))}
            mb={8}
            styles={{
              root: { backgroundColor: 'rgba(0,0,0,0.2)' },
            }}
          />
        </>
      )}

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
