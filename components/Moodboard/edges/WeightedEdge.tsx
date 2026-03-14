import React from 'react';
import { BaseEdge, getBezierPath, type EdgeProps, MarkerType } from '@xyflow/react';

export type EdgeType = 'genre' | 'phase' | 'mood' | 'similarity' | 'topic' | 'custom';

export interface MoodboardEdgeData {
  edgeType: EdgeType;
  weight: number;
  label?: string;
  directed?: boolean; // true for song→song (flow direction)
  filterState?: 'normal' | 'primary' | 'secondary' | 'hidden';
}

const edgeColors: Record<EdgeType, string> = {
  genre: '#22b8cf',
  phase: '#7048e8',
  mood: '#e64980',
  similarity: '#40c057',
  topic: '#fd7e14',
  custom: '#868e96',
};

function WeightedEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected, markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const edgeData = data as unknown as MoodboardEdgeData | undefined;
  const weight = edgeData?.weight ?? 1.0;
  const edgeType = edgeData?.edgeType ?? 'custom';
  const filterState = edgeData?.filterState ?? 'normal';
  const strokeWidth = 1.5 + weight * 3.5;
  const color = edgeColors[edgeType] || edgeColors.custom;

  // Filter state affects opacity
  const opacity = filterState === 'hidden' ? 0.05
    : filterState === 'secondary' ? 0.2
    : selected ? 1
    : 0.3 + weight * 0.7;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: filterState === 'secondary' ? '#555' : color,
        strokeWidth: selected ? strokeWidth + 2 : strokeWidth,
        opacity,
        filter: selected ? `drop-shadow(0 0 4px ${color})` : undefined,
      }}
    />
  );
}

export default React.memo(WeightedEdge);
