import React from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useNodes,
  type ConnectionLineComponentProps,
} from '@xyflow/react';
import { getSmartEdge, svgDrawSmoothLinePath } from '@tisoap/react-flow-smart-edge';
import { EDGE_COLORS, type EdgeType } from '../moodboard-constants';
import type { EdgeStyle } from './WeightedEdge';

interface MoodboardConnectionLineProps extends ConnectionLineComponentProps {
  edgeStyle: EdgeStyle;
  smartNodePadding: number;
  smartGridRatio: number;
}

function inferPreviewEdgeType(props: ConnectionLineComponentProps): EdgeType {
  if (props.toNode?.type === 'tag') {
    const category = (props.toNode.data as any)?.category as EdgeType | undefined;
    if (category === 'genre' || category === 'phase' || category === 'mood' || category === 'topic') {
      return category;
    }
  }

  if (props.fromNode?.type === 'song' && props.toNode?.type === 'song') {
    return 'similarity';
  }

  return 'custom';
}

export function MoodboardConnectionLine({
  edgeStyle,
  smartNodePadding,
  smartGridRatio,
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  toNode,
  ...props
}: MoodboardConnectionLineProps) {
  const nodes = useNodes();
  const edgeType = inferPreviewEdgeType({
    ...props,
    fromX,
    fromY,
    toX,
    toY,
    fromPosition,
    toPosition,
    toNode,
  } as ConnectionLineComponentProps);
  const color = EDGE_COLORS[edgeType];

  let edgePath = '';

  if (edgeStyle === 'smart' && toNode) {
    const smartResult = getSmartEdge({
      sourcePosition: fromPosition,
      targetPosition: toPosition,
      sourceX: fromX,
      sourceY: fromY,
      targetX: toX,
      targetY: toY,
      nodes,
      options: {
        nodePadding: smartNodePadding,
        gridRatio: smartGridRatio,
        drawEdge: svgDrawSmoothLinePath,
      },
    });

    if (smartResult && !(smartResult instanceof Error)) {
      edgePath = smartResult.svgPathString;
    }
  }

  if (!edgePath && edgeStyle === 'straight') {
    [edgePath] = getStraightPath({ sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY });
  } else if (!edgePath && edgeStyle === 'step') {
    [edgePath] = getSmoothStepPath({
      sourceX: fromX,
      sourceY: fromY,
      targetX: toX,
      targetY: toY,
      sourcePosition: fromPosition,
      targetPosition: toPosition,
      borderRadius: 0,
    });
  } else if (!edgePath && edgeStyle === 'smoothstep') {
    [edgePath] = getSmoothStepPath({
      sourceX: fromX,
      sourceY: fromY,
      targetX: toX,
      targetY: toY,
      sourcePosition: fromPosition,
      targetPosition: toPosition,
      borderRadius: 8,
    });
  } else if (!edgePath) {
    [edgePath] = getBezierPath({
      sourceX: fromX,
      sourceY: fromY,
      targetX: toX,
      targetY: toY,
      sourcePosition: fromPosition,
      targetPosition: toPosition,
    });
  }

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: 3,
        opacity: 0.9,
        strokeDasharray: edgeStyle === 'straight' ? '0' : '6 4',
        filter: `drop-shadow(0 0 4px ${color})`,
      }}
    />
  );
}