import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { Text, Group, Badge } from '@mantine/core';
import { IconVinyl, IconWaveSine, IconHeart, IconTag } from '@tabler/icons-react';
import type { TagCategory } from './TagNode';

export interface ContainerNodeData {
  label: string;
  category: TagCategory;
  color: string;
  childCount: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  genre: <IconVinyl size={14} />,
  phase: <IconWaveSine size={14} />,
  mood: <IconHeart size={14} />,
  topic: <IconTag size={14} />,
};

function ContainerNode({ data }: NodeProps) {
  const d = data as unknown as ContainerNodeData;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      borderRadius: 20,
      border: `3px solid var(--mantine-color-${d.color}-5)`,
      background: `color-mix(in srgb, var(--mantine-color-${d.color}-9) 25%, rgba(26,27,30,0.95))`,
      boxShadow: `0 8px 32px color-mix(in srgb, var(--mantine-color-${d.color}-9) 40%, transparent), inset 0 1px 0 color-mix(in srgb, var(--mantine-color-${d.color}-7) 20%, transparent)`,
      padding: 0,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <Group
        gap={8}
        px="md"
        py={10}
        style={{
          borderBottom: `1px solid var(--mantine-color-${d.color}-7)`,
          borderRadius: '14px 14px 0 0',
          background: `color-mix(in srgb, var(--mantine-color-${d.color}-8) 40%, var(--mantine-color-dark-6))`,
          cursor: 'grab',
        }}
      >
        {categoryIcons[d.category]}
        <Text size="sm" fw={700} c={`var(--mantine-color-${d.color}-2)`} tt="uppercase" style={{ letterSpacing: 1.5 }}>
          {d.label}
        </Text>
        {d.childCount > 0 && (
          <Badge size="xs" variant="filled" color={d.color}>{d.childCount}</Badge>
        )}
      </Group>
    </div>
  );
}

export default React.memo(ContainerNode);
