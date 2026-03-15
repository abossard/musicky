import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, Group, Text, Badge } from '@mantine/core';
import { CATEGORY_ICONS } from '../moodboard-constants';
import type { TagCategory } from '../moodboard-constants';

export type { TagCategory };

export interface TagNodeData {
  type: 'tag';
  label: string;
  category: TagCategory;
  color: string;
  songCount?: number;
  isFilterActive?: boolean;
  filterState?: 'normal' | 'primary' | 'secondary' | 'hidden';
  onFilterToggle?: (nodeId: string) => void;
}

function TagNode({ data, selected, id }: NodeProps) {
  const tagData = data as unknown as TagNodeData;
  const filterState = tagData.filterState ?? 'normal';
  const isActive = tagData.isFilterActive;
  const isHidden = filterState === 'hidden';

  const CategoryIcon = CATEGORY_ICONS[tagData.category] || CATEGORY_ICONS.custom;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    tagData.onFilterToggle?.(id);
  };

  return (
    <Card
      shadow={selected ? 'lg' : isActive ? 'lg' : 'sm'}
      radius="xl"
      px="md"
      py="xs"
      onDoubleClick={handleDoubleClick}
      style={{
        border: isActive
          ? `3px solid var(--mantine-color-${tagData.color}-5)`
          : selected
            ? `2px solid var(--mantine-color-${tagData.color}-6)`
            : `1px solid var(--mantine-color-${tagData.color}-8)`,
        background: isActive
          ? `var(--mantine-color-${tagData.color}-filled)`
          : `var(--mantine-color-${tagData.color}-light)`,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        opacity: isHidden ? 0.15 : 1,
        boxShadow: isActive ? `0 0 16px var(--mantine-color-${tagData.color}-5)` : undefined,
      }}
    >
      <Group gap="xs" wrap="nowrap">
        <CategoryIcon size={14} />
        <Text size="sm" fw={600}>{tagData.label}</Text>
        {tagData.songCount != null && tagData.songCount > 0 && (
          <Badge size="xs" variant="filled" color={tagData.color}>{tagData.songCount}</Badge>
        )}
      </Group>

      <Handle type="source" position={Position.Right} id="right" style={{ background: `var(--mantine-color-${tagData.color}-6)`, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: `var(--mantine-color-${tagData.color}-6)`, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: `var(--mantine-color-${tagData.color}-6)`, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ background: `var(--mantine-color-${tagData.color}-6)`, width: 8, height: 8 }} />
    </Card>
  );
}

export default React.memo(TagNode);
