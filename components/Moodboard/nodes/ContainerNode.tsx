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
  isDropTarget?: boolean;
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
      boxShadow: d.isDropTarget
        ? `0 0 30px ${borderColor}, 0 0 60px ${borderColor}55`
        : `0 0 30px ${borderColor}55`,
      transform: d.isDropTarget ? 'scale(1.02)' : undefined,
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      {/* Header is the drag handle — pointer-events enabled */}
      <Group
        gap={8}
        px="md"
        py={10}
        className="container-drag-handle"
        style={{
          borderBottom: `3px solid ${borderColor}`,
          background: headerBg,
          cursor: 'grab',
          pointerEvents: 'auto',
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
