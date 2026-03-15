import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { Text, Group, Badge } from '@mantine/core';
import type { TagCategory } from './TagNode';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../moodboard-constants';

export interface ContainerNodeData {
  label: string;
  category: TagCategory;
  color: string;
  childCount: number;
  width: number;
  height: number;
}

function ContainerNode({ data }: NodeProps) {
  const d = data as unknown as ContainerNodeData;
  const borderColor = CATEGORY_COLORS[d.color]?.border || CATEGORY_COLORS.gray.border;
  const headerBg = CATEGORY_COLORS[d.color]?.header || CATEGORY_COLORS.gray.header;
  const CategoryIcon = CATEGORY_ICONS[d.category] || CATEGORY_ICONS.custom;

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
        <CategoryIcon size={16} />
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
