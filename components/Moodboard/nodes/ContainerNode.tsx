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

const colorMap: Record<string, { border: string; headerBg: string; text: string }> = {
  violet: { border: '#9775fa', headerBg: '#3b2f63', text: '#d0bfff' },
  cyan: { border: '#3bc9db', headerBg: '#1a3c42', text: '#99e9f2' },
  pink: { border: '#f06595', headerBg: '#4a2035', text: '#fcc2d7' },
  gray: { border: '#adb5bd', headerBg: '#2c2e33', text: '#dee2e6' },
};

function ContainerNode({ data }: NodeProps) {
  const d = data as unknown as ContainerNodeData;
  const colors = colorMap[d.color] || colorMap.gray;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      borderRadius: 20,
      padding: 0,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <Group
        gap={8}
        px="md"
        py={10}
        style={{
          borderBottom: `2px solid ${colors.border}`,
          borderRadius: '18px 18px 0 0',
          background: colors.headerBg,
          cursor: 'grab',
        }}
      >
        {categoryIcons[d.category]}
        <Text size="sm" fw={700} c={colors.text} tt="uppercase" style={{ letterSpacing: 1.5 }}>
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
