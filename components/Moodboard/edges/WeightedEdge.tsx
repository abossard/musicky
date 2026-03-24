import React from 'react';
import {
  BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath,
  useInternalNode, useNodes,
  type EdgeProps,
} from '@xyflow/react';
import { getSmartEdge, svgDrawSmoothLinePath, pathfindingAStarDiagonal } from '@tisoap/react-flow-smart-edge';
import { getFloatingEdgeParams } from './floating-edge-utils';
import { EDGE_COLORS } from '../moodboard-constants';
import type { BundleInfo } from '../../../lib/edge-bundling';
import { areKeysCompatible } from '../../../lib/camelot';

export type EdgeType = 'genre' | 'phase' | 'mood' | 'similarity' | 'topic' | 'custom';

/** Available edge drawing styles */
export type EdgeStyle = 'bezier' | 'straight' | 'step' | 'smoothstep' | 'smart';

export interface MoodboardEdgeData {
  edgeType: EdgeType;
  weight: number;
  label?: string;
  directed?: boolean;
  filterState?: 'normal' | 'primary' | 'secondary' | 'hidden';
  edgeStyle?: EdgeStyle;
  smartNodePadding?: number;
  smartGridRatio?: number;
  bundleInfo?: BundleInfo;
}

function WeightedEdge({
  id, source, target, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected, markerEnd,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const nodes = useNodes();

  // Floating edges: calculate nearest border intersection
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY;
  let sPos = sourcePosition, tPos = targetPosition;
  if (sourceNode?.measured?.width && targetNode?.measured?.width) {
    const p = getFloatingEdgeParams(sourceNode, targetNode);
    sx = p.sx; sy = p.sy; tx = p.tx; ty = p.ty;
    sPos = p.sourcePos; tPos = p.targetPos;
  }

  const edgeData = data as unknown as MoodboardEdgeData | undefined;
  const weight = edgeData?.weight ?? 1.0;
  const edgeType = edgeData?.edgeType ?? 'custom';
  const filterState = edgeData?.filterState ?? 'normal';
  const edgeStyle = edgeData?.edgeStyle ?? 'smart';
  const smartPadding = edgeData?.smartNodePadding ?? 15;
  const smartGrid = edgeData?.smartGridRatio ?? 10;
  const bundleInfo = edgeData?.bundleInfo;
  const strokeWidth = 1.5 + weight * 3.5;
  const baseColor = EDGE_COLORS[edgeType] || EDGE_COLORS.custom;

  // Override color for song-to-song edges based on harmonic compatibility
  let color = baseColor;
  if (sourceNode && targetNode) {
    const srcData = sourceNode.internals?.userNode?.data as Record<string, unknown> | undefined;
    const tgtData = targetNode.internals?.userNode?.data as Record<string, unknown> | undefined;
    const srcType = srcData?.type as string | undefined;
    const tgtType = tgtData?.type as string | undefined;
    if (srcType === 'song' && tgtType === 'song') {
      const srcKey = srcData?.camelotKey as string | undefined;
      const tgtKey = tgtData?.camelotKey as string | undefined;
      if (srcKey && tgtKey) {
        color = areKeysCompatible(srcKey, tgtKey) ? '#40c057' : '#e8590c';
      }
    }
  }

  // Compute edge path based on selected style
  let edgePath: string;

  if (bundleInfo) {
    // Hub-and-spoke bundled path: stub → spine → tag entry
    const perpX = -(bundleInfo.tagY - bundleInfo.spineY);
    const perpY = bundleInfo.tagX - bundleInfo.spineX;
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
    const nPerpX = perpX / perpLen;
    const nPerpY = perpY / perpLen;

    // Offset spine point for this edge's position in the fan
    const offSpineX = bundleInfo.spineX + nPerpX * bundleInfo.stubOffset;
    const offSpineY = bundleInfo.spineY + nPerpY * bundleInfo.stubOffset;

    // Midpoint for the quadratic curve into the tag
    const midX = (offSpineX + bundleInfo.tagX) / 2;
    const midY = (offSpineY + bundleInfo.tagY) / 2;

    edgePath = `M ${sx},${sy} L ${offSpineX},${offSpineY} Q ${midX},${midY} ${bundleInfo.tagX},${bundleInfo.tagY}`;
  } else if (edgeStyle === 'smart' && sourceNode && targetNode) {
    // Smart edge routing — A* pathfinding that avoids nodes
    const smartResult = getSmartEdge({
      sourcePosition: sPos,
      targetPosition: tPos,
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
      nodes,
      options: {
        nodePadding: smartPadding,
        gridRatio: smartGrid,
        drawEdge: svgDrawSmoothLinePath,
      },
    });
    // getSmartEdge returns GetSmartEdgeReturn | Error
    if (smartResult && !(smartResult instanceof Error)) {
      edgePath = smartResult.svgPathString;
    } else {
      [edgePath] = getBezierPath({
        sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
        sourcePosition: sPos, targetPosition: tPos,
      });
    }
  } else if (edgeStyle === 'straight') {
    [edgePath] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });
  } else if (edgeStyle === 'step') {
    [edgePath] = getSmoothStepPath({
      sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
      sourcePosition: sPos, targetPosition: tPos,
      borderRadius: 0,
    });
  } else if (edgeStyle === 'smoothstep') {
    [edgePath] = getSmoothStepPath({
      sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
      sourcePosition: sPos, targetPosition: tPos,
      borderRadius: 8,
    });
  } else {
    // Default: bezier
    [edgePath] = getBezierPath({
      sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
      sourcePosition: sPos, targetPosition: tPos,
    });
  }

  // Filter state affects opacity
  const baseOpacity = filterState === 'hidden' ? 0.05
    : filterState === 'secondary' ? 0.2
    : selected ? 1
    : 0.3 + weight * 0.7;

  // Bundled edges: thinner stubs, slightly more transparent
  const finalStrokeWidth = bundleInfo
    ? (selected ? strokeWidth : Math.max(1.5, strokeWidth * 0.6))
    : (selected ? strokeWidth + 2 : strokeWidth);
  const finalOpacity = bundleInfo
    ? Math.max(0.15, baseOpacity * 0.7)
    : baseOpacity;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: filterState === 'secondary' ? '#555' : color,
        strokeWidth: finalStrokeWidth,
        opacity: finalOpacity,
        filter: selected ? `drop-shadow(0 0 4px ${color})` : undefined,
      }}
    />
  );
}

export default React.memo(WeightedEdge);
