import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortablePhaseItemProps {
  id: string;
  phase: string;
  onRemove: (phase: string) => void;
  disabled?: boolean;
}

export function SortablePhaseItem({ id, phase, onRemove, disabled }: SortablePhaseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const transformStyle = transform ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : {};

  return (
    // eslint-disable-next-line react/forbid-dom-props
    <li
      ref={setNodeRef}
      style={transformStyle}
      className={`phase-item ${isDragging ? 'dragging' : ''}`}
      {...attributes}
    >
      <div
        className="drag-handle"
        {...listeners}
        aria-label={`Drag to reorder ${phase}`}
        title="Drag to reorder"
      >
        ⋮⋮
      </div>
      <span className="phase-name">{phase}</span>
      <button
        onClick={() => onRemove(phase)}
        className="remove-phase-btn"
        disabled={disabled}
        title={`Remove ${phase}`}
        type="button"
      >
        ×
      </button>
    </li>
  );
}
