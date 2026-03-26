import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, Group, Text, Badge } from '@mantine/core';
import { CATEGORY_ICONS } from '../moodboard-constants';
import type { TagCategory } from '../../../lib/types';

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

const TAG_HANDLE_SIZE = 16;

const tagHandleStyle = (color: string, position: Position): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    width: TAG_HANDLE_SIZE,
    height: TAG_HANDLE_SIZE,
    borderRadius: 999,
    border: '3px solid rgba(255,255,255,0.9)',
    background: `var(--mantine-color-${color}-6)`,
    boxShadow: `0 0 0 5px color-mix(in srgb, var(--mantine-color-${color}-6) 25%, transparent)`,
    zIndex: 20,
  };

  if (position === Position.Right) {
    return { ...baseStyle, right: 1, transform: 'translate(50%, -50%)' };
  }
  if (position === Position.Left) {
    return { ...baseStyle, left: 1, transform: 'translate(-50%, -50%)' };
  }
  if (position === Position.Top) {
    return { ...baseStyle, top: 1, transform: 'translate(-50%, -50%)' };
  }
  return { ...baseStyle, bottom: 1, transform: 'translate(-50%, 50%)' };
};

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
    <div style={{ position: 'relative', overflow: 'visible' }}>
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
          overflow: 'visible',
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <CategoryIcon size={14} />
          <Text size="sm" fw={600}>{tagData.label}</Text>
          {tagData.songCount != null && tagData.songCount > 0 && (
            <Badge size="xs" variant="filled" color={tagData.color}>{tagData.songCount}</Badge>
          )}
        </Group>
      </Card>

      <Handle type="source" position={Position.Right} id="right" style={tagHandleStyle(tagData.color, Position.Right)} />
      <Handle type="target" position={Position.Left} id="left" style={tagHandleStyle(tagData.color, Position.Left)} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={tagHandleStyle(tagData.color, Position.Bottom)} />
      <Handle type="target" position={Position.Top} id="top" style={tagHandleStyle(tagData.color, Position.Top)} />
    </div>
  );
}

export default React.memo(TagNode);
