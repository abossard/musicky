import { type InternalNode, Position } from '@xyflow/react';

function getNodeCenter(node: InternalNode) {
  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
  };
}

export function getNodeIntersection(sourceNode: InternalNode, targetNode: InternalNode) {
  const s = getNodeCenter(sourceNode);
  const t = getNodeCenter(targetNode);
  const w = (targetNode.measured.width ?? 0) / 2;
  const h = (targetNode.measured.height ?? 0) / 2;
  const dx = t.x - s.x;
  const dy = t.y - s.y;

  if (dx === 0 && dy === 0) return t;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx * h > absDy * w) {
    const sign = dx > 0 ? -1 : 1;
    return { x: t.x + sign * w, y: t.y + sign * w * dy / dx };
  } else {
    const sign = dy > 0 ? -1 : 1;
    return { x: t.x + sign * h * dx / dy, y: t.y + sign * h };
  }
}

export function getEdgePosition(node: InternalNode, point: { x: number; y: number }): Position {
  const nx = point.x - node.internals.positionAbsolute.x;
  const ny = point.y - node.internals.positionAbsolute.y;
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;

  if (ny <= 1) return Position.Top;
  if (ny >= h - 1) return Position.Bottom;
  if (nx <= 1) return Position.Left;
  return Position.Right;
}

export function getFloatingEdgeParams(source: InternalNode, target: InternalNode) {
  const sourcePoint = getNodeIntersection(target, source);
  const targetPoint = getNodeIntersection(source, target);
  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    sourcePos: getEdgePosition(source, sourcePoint),
    targetPos: getEdgePosition(target, targetPoint),
  };
}
