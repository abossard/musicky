import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Group, Badge, Text, Box, ActionIcon, Tooltip, TextInput, Popover, ScrollArea, Stack,
} from '@mantine/core';
import {
  IconArrowRight, IconPlus, IconPencil, IconWand, IconX, IconMaximize,
} from '@tabler/icons-react';
import {
  onAddPhaseEdge, onRemovePhaseEdge, onSuggestPhaseFlow,
} from './MoodboardPage.telefunc';
import type { SetPhase } from '../../lib/set-phase';

import './PhaseFlowBar.css';

export interface PhaseFlowBarProps {
  phaseEdges: { id: number; fromPhase: string; toPhase: string; weight: number }[];
  phaseOrder: string[];
  phaseCounts?: Record<string, number>;
  activePhaseFilter?: string | null;
  phaseDetails?: SetPhase[];
  onPhaseClick?: (phase: string) => void;
  onPhaseEdgesChanged?: () => void;
  onOpenEditor?: () => void;
}

export function PhaseFlowBar({
  phaseEdges,
  phaseOrder,
  phaseCounts,
  activePhaseFilter,
  phaseDetails = [],
  onPhaseClick,
  onPhaseEdgesChanged,
  onOpenEditor,
}: PhaseFlowBarProps) {
  const [editMode, setEditMode] = useState(false);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  // Build lookup for phase details by name
  const detailsMap = useMemo(() => {
    const m = new Map<string, SetPhase>();
    for (const d of phaseDetails) m.set(d.name, d);
    return m;
  }, [phaseDetails]);

  // Build a set of connected pairs for arrow rendering
  const connectedPairs = new Map<string, { id: number; weight: number }>();
  for (const edge of phaseEdges) {
    connectedPairs.set(`${edge.fromPhase}→${edge.toPhase}`, { id: edge.id, weight: edge.weight });
  }

  // Find edges between consecutive phases in the order
  function getEdgeBetween(from: string, to: string) {
    return connectedPairs.get(`${from}→${to}`);
  }

  const handlePhaseClick = useCallback((phase: string) => {
    if (editMode && edgeSource) {
      // Complete edge creation
      if (edgeSource !== phase) {
        onAddPhaseEdge(edgeSource, phase, 1.0).then((result) => {
          if (result.success) {
            onPhaseEdgesChanged?.();
          }
        });
      }
      setEdgeSource(null);
    } else if (editMode) {
      // Start edge creation
      setEdgeSource(phase);
    } else {
      onPhaseClick?.(phase);
    }
  }, [editMode, edgeSource, onPhaseClick, onPhaseEdgesChanged]);

  const handleRemoveEdge = useCallback((edgeId: number) => {
    onRemovePhaseEdge(edgeId).then(() => onPhaseEdgesChanged?.());
  }, [onPhaseEdgesChanged]);

  const handleSuggestFlow = useCallback(() => {
    onSuggestPhaseFlow().then((suggested) => {
      if (suggested.length === 0) return;
      // Apply all suggested edges sequentially
      const applyEdges = async () => {
        for (const edge of suggested) {
          await onAddPhaseEdge(edge.fromPhase, edge.toPhase, edge.weight);
        }
        onPhaseEdgesChanged?.();
      };
      applyEdges();
    });
  }, [onPhaseEdgesChanged]);

  const handleAddPhase = useCallback(() => {
    const name = newPhaseName.trim();
    if (!name) return;
    // Add a phase by creating an edge from the last phase to the new one
    const lastPhase = phaseOrder[phaseOrder.length - 1];
    if (lastPhase) {
      onAddPhaseEdge(lastPhase, name, 1.0).then((result) => {
        if (result.success) onPhaseEdgesChanged?.();
      });
    } else {
      // No phases yet, create a self-referencing placeholder — or just create edge from new to itself won't work.
      // Instead create it as a standalone; the next added phase will connect to it.
      // We need at least 2 phases to create an edge. For the very first, just notify parent.
      onPhaseEdgesChanged?.();
    }
    setNewPhaseName('');
    setAddPhaseOpen(false);
  }, [newPhaseName, phaseOrder, onPhaseEdgesChanged]);

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, phaseOrder.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < phaseOrder.length) {
        handlePhaseClick(phaseOrder[focusIndex]);
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [focusIndex, phaseOrder, handlePhaseClick]);

  if (phaseOrder.length === 0 && !editMode) return null;

  return (
    <Box className="phase-flow-bar" ref={containerRef} tabIndex={0}>
      <ScrollArea scrollbarSize={4} type="auto" offsetScrollbars>
        <Group gap="xs" wrap="nowrap" className="phase-flow-inner">
          {/* Label */}
          <Text size="xs" c="dimmed" fw={600} className="phase-flow-label">
            Phases:
          </Text>

          {/* Phase nodes with arrows */}
          {phaseOrder.map((phase, i) => {
            const count = phaseCounts?.[phase] ?? 0;
            const isActive = activePhaseFilter === phase;
            const isFocused = focusIndex === i;
            const isEdgeSource = edgeSource === phase;
            const nextPhase = i < phaseOrder.length - 1 ? phaseOrder[i + 1] : null;
            const edgeBetween = nextPhase ? getEdgeBetween(phase, nextPhase) : null;

            return (
              <Group key={phase} gap={4} wrap="nowrap" className="phase-flow-node-group">
                {/* Phase pill */}
                <Tooltip
                  label={
                    editMode && edgeSource
                      ? `Connect ${edgeSource} → ${phase}`
                      : (() => {
                          const detail = detailsMap.get(phase);
                          if (!detail || (!detail.description && !detail.targetBpmRange && !detail.targetEnergyRange)) {
                            return phase;
                          }
                          return (
                            <Stack gap={2}>
                              <Text size="xs" fw={600} tt="capitalize">{phase}</Text>
                              {detail.description && <Text size="xs">{detail.description}</Text>}
                              {detail.targetBpmRange && (
                                <Text size="xs" c="dimmed">BPM: {detail.targetBpmRange[0]}–{detail.targetBpmRange[1]}</Text>
                              )}
                              {detail.targetEnergyRange && (
                                <Text size="xs" c="dimmed">Energy: {detail.targetEnergyRange[0]}–{detail.targetEnergyRange[1]}</Text>
                              )}
                            </Stack>
                          );
                        })()
                  }
                  position="bottom"
                  withArrow
                  multiline
                  maw={250}
                >
                  <Box className="phase-flow-pill-wrapper">
                    <Badge
                      size="lg"
                      variant={isActive ? 'filled' : 'light'}
                      color="violet"
                      className={[
                        'phase-flow-pill',
                        isActive ? 'phase-flow-pill-active' : '',
                        isFocused ? 'phase-flow-pill-focused' : '',
                        isEdgeSource ? 'phase-flow-pill-edge-source' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handlePhaseClick(phase)}
                      data-testid={`phase-pill-${phase}`}
                    >
                      {phase}
                    </Badge>
                    {count > 0 && (
                      <Text size="10px" c="dimmed" ta="center" className="phase-flow-count">
                        {count}
                      </Text>
                    )}
                    {editMode && (
                      <ActionIcon
                        size={14}
                        variant="filled"
                        color="red"
                        className="phase-flow-delete-pill"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove all edges involving this phase
                          const toRemove = phaseEdges.filter(
                            (edge) => edge.fromPhase === phase || edge.toPhase === phase,
                          );
                          Promise.all(toRemove.map((edge) => onRemovePhaseEdge(edge.id))).then(
                            () => onPhaseEdgesChanged?.(),
                          );
                        }}
                      >
                        <IconX size={10} />
                      </ActionIcon>
                    )}
                  </Box>
                </Tooltip>

                {/* Arrow to next phase */}
                {nextPhase && (
                  <Box className="phase-flow-arrow-wrapper">
                    <IconArrowRight
                      size={16}
                      className="phase-flow-arrow"
                      style={{
                        opacity: edgeBetween ? Math.max(0.3, Math.min(1, edgeBetween.weight)) : 0.25,
                      }}
                    />
                    {editMode && edgeBetween && (
                      <ActionIcon
                        size={12}
                        variant="filled"
                        color="red"
                        className="phase-flow-delete-arrow"
                        onClick={() => handleRemoveEdge(edgeBetween.id)}
                      >
                        <IconX size={8} />
                      </ActionIcon>
                    )}
                  </Box>
                )}
              </Group>
            );
          })}

          {/* Spacer */}
          <Box style={{ flex: 1 }} />

          {/* Quick actions */}
          <Group gap={4} wrap="nowrap" className="phase-flow-actions">
            <Tooltip label="Auto-arrange phases" position="bottom" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="violet"
                onClick={handleSuggestFlow}
                data-testid="phase-auto-arrange"
              >
                <IconWand size={14} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Open phase flow editor" position="bottom" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="violet"
                onClick={() => onOpenEditor?.()}
                data-testid="phase-open-editor"
              >
                <IconMaximize size={14} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={editMode ? 'Done editing' : 'Edit flow'} position="bottom" withArrow>
              <ActionIcon
                size="sm"
                variant={editMode ? 'filled' : 'subtle'}
                color="violet"
                onClick={() => {
                  setEditMode((v) => !v);
                  setEdgeSource(null);
                }}
                data-testid="phase-edit-toggle"
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>

            {editMode && (
              <Popover
                opened={addPhaseOpen}
                onChange={setAddPhaseOpen}
                position="bottom"
                withArrow
                trapFocus
              >
                <Popover.Target>
                  <Tooltip label="Add phase" position="bottom" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="violet"
                      onClick={() => setAddPhaseOpen((v) => !v)}
                      data-testid="phase-add-btn"
                    >
                      <IconPlus size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Popover.Target>
                <Popover.Dropdown>
                  <TextInput
                    size="xs"
                    placeholder="Phase name"
                    value={newPhaseName}
                    onChange={(e) => setNewPhaseName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPhase();
                      if (e.key === 'Escape') setAddPhaseOpen(false);
                    }}
                    rightSection={
                      <ActionIcon size="xs" variant="filled" color="violet" onClick={handleAddPhase}>
                        <IconPlus size={12} />
                      </ActionIcon>
                    }
                    data-testid="phase-name-input"
                    autoFocus
                  />
                </Popover.Dropdown>
              </Popover>
            )}
          </Group>

          {/* Edge source indicator */}
          {editMode && edgeSource && (
            <Text size="xs" c="yellow" fw={500} className="phase-flow-edge-hint">
              Click a target phase for edge from "{edgeSource}"
            </Text>
          )}
        </Group>
      </ScrollArea>
    </Box>
  );
}
