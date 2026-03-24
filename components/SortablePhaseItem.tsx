import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Stack, TextInput, Textarea, NumberInput, Group, Collapse, ActionIcon, Text, ColorSwatch,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconGripVertical, IconTrash } from '@tabler/icons-react';
import type { SetPhase } from '../lib/set-phase';

const PRESET_COLORS = [
  '#845ef7', '#5c7cfa', '#22b8cf', '#51cf66',
  '#fcc419', '#ff922b', '#ff6b6b', '#e64980',
];

interface SortablePhaseItemProps {
  id: string;
  phase: SetPhase;
  onRemove: (id: string) => void;
  onUpdate: (updated: SetPhase) => void;
  disabled?: boolean;
}

export function SortablePhaseItem({ id, phase, onRemove, onUpdate, disabled }: SortablePhaseItemProps) {
  const [expanded, setExpanded] = useState(false);
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
      <Group gap="xs" wrap="nowrap" align="center" style={{ width: '100%' }}>
        <div
          className="drag-handle"
          {...listeners}
          aria-label={`Drag to reorder ${phase.name}`}
          title="Drag to reorder"
        >
          <IconGripVertical size={16} />
        </div>
        {phase.color && <ColorSwatch color={phase.color} size={14} />}
        <Text size="sm" fw={500} style={{ flex: 1 }}>{phase.name}</Text>
        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </ActionIcon>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="red"
          onClick={() => onRemove(phase.id)}
          disabled={disabled}
          title={`Remove ${phase.name}`}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>

      <Collapse in={expanded}>
        <Stack gap="xs" mt="xs" pl={28}>
          <TextInput
            size="xs"
            label="Name"
            value={phase.name}
            onChange={(e) => onUpdate({ ...phase, name: e.currentTarget.value })}
            disabled={disabled}
          />
          <Textarea
            size="xs"
            label="Description"
            placeholder="DJ notes about this phase…"
            value={phase.description}
            onChange={(e) => onUpdate({ ...phase, description: e.currentTarget.value })}
            autosize
            minRows={1}
            maxRows={3}
            disabled={disabled}
          />
          <Group gap="xs">
            <NumberInput
              size="xs"
              label="BPM min"
              value={phase.targetBpmRange?.[0] ?? ''}
              onChange={(val) => {
                const min = typeof val === 'number' ? val : undefined;
                const max = phase.targetBpmRange?.[1];
                onUpdate({
                  ...phase,
                  targetBpmRange: min != null || max != null ? [min ?? 0, max ?? 999] : undefined,
                });
              }}
              min={0}
              max={999}
              style={{ flex: 1 }}
              disabled={disabled}
            />
            <NumberInput
              size="xs"
              label="BPM max"
              value={phase.targetBpmRange?.[1] ?? ''}
              onChange={(val) => {
                const max = typeof val === 'number' ? val : undefined;
                const min = phase.targetBpmRange?.[0];
                onUpdate({
                  ...phase,
                  targetBpmRange: min != null || max != null ? [min ?? 0, max ?? 999] : undefined,
                });
              }}
              min={0}
              max={999}
              style={{ flex: 1 }}
              disabled={disabled}
            />
          </Group>
          <Group gap="xs">
            <NumberInput
              size="xs"
              label="Energy min (1–10)"
              value={phase.targetEnergyRange?.[0] ?? ''}
              onChange={(val) => {
                const min = typeof val === 'number' ? val : undefined;
                const max = phase.targetEnergyRange?.[1];
                onUpdate({
                  ...phase,
                  targetEnergyRange: min != null || max != null ? [min ?? 1, max ?? 10] : undefined,
                });
              }}
              min={1}
              max={10}
              style={{ flex: 1 }}
              disabled={disabled}
            />
            <NumberInput
              size="xs"
              label="Energy max (1–10)"
              value={phase.targetEnergyRange?.[1] ?? ''}
              onChange={(val) => {
                const max = typeof val === 'number' ? val : undefined;
                const min = phase.targetEnergyRange?.[0];
                onUpdate({
                  ...phase,
                  targetEnergyRange: min != null || max != null ? [min ?? 1, max ?? 10] : undefined,
                });
              }}
              min={1}
              max={10}
              style={{ flex: 1 }}
              disabled={disabled}
            />
          </Group>
          <Group gap={6}>
            <Text size="xs" c="dimmed">Color:</Text>
            {PRESET_COLORS.map(c => (
              <ColorSwatch
                key={c}
                color={c}
                size={18}
                style={{ cursor: 'pointer', outline: phase.color === c ? '2px solid white' : undefined }}
                onClick={() => onUpdate({ ...phase, color: phase.color === c ? undefined : c })}
              />
            ))}
          </Group>
        </Stack>
      </Collapse>
    </li>
  );
}

