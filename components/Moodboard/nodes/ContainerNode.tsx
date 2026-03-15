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
  width: number;
  height: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  genre: <IconVinyl size={16} />,
  phase: <IconWaveSine size={16} />,
  mood: <IconHeart size={16} />,
  topic: <IconTag size={16} />,
  custom: <IconTag size={16} />,
};

const borderColors: Record<string, string> = {
  violet: '#9775fa',
  cyan: '#3bc9db',
  pink: '#f06595',
  gray: '#868e96',
};

const headerColors: Record<string, string> = {
  violet: '#2b2042',
  cyan: '#1a3a42',
  pink: '#3a1a28',
  gray: '#2c2e33',
};

function ContainerNode({ data }: NodeProps) {
  const d = data as unknown as ContainerNodeData;
  const borderColor = borderColors[d.color] || borderColors.gray;
  const headerBg = headerColors[d.color] || headerColors.gray;

  return (
    <div style={{
      width: d.width || 600,
      height: d.height || 400,
      borderRadius: 16,
      border: `4px solid ${borderColor}`,
      backgroundColor: '#1e1f25',
      boxShadow: `0 0 30px ${borderColor}55`,
      overflow: 'hidden',
    }}>
      <Group
        gap={8}
        px="md"
        py={10}
        style={{
          borderBottom: `3px solid ${borderColor}`,
          background: headerBg,
        }}
      >
        {categoryIcons[d.category]}
        <Text size="md" fw={800} c={borderColor} tt="uppercase" style={{ letterSpacing: 2 }}>
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
