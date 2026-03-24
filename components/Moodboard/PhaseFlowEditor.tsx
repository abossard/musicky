import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Modal, Card, Group, Stack, Text, Badge, Button, ActionIcon, TextInput, Tooltip, Box,
} from '@mantine/core';
import {
  IconArrowRight, IconPlus, IconTrash, IconWand, IconCheck, IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  onAddPhaseEdge, onRemovePhaseEdge, onSuggestPhaseFlow,
} from './MoodboardPage.telefunc';
import { wouldCreateCycle, getPhaseOrder, type PhaseEdge } from '../../lib/phase-graph';
import type { SetPhase } from '../../lib/set-phase';

import './PhaseFlowEditor.css';

export interface PhaseFlowEditorProps {
  opened: boolean;
  onClose: () => void;
  phaseEdges: { id: number; fromPhase: string; toPhase: string; weight: number }[];
  phases: string[];
  phaseCounts?: Record<string, number>;
  phaseDetails?: SetPhase[];
  onSave: () => void;
}

interface NodeRect {
  phase: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function PhaseFlowEditor({
  opened,
  onClose,
  phaseEdges: initialEdges,
  phases: initialPhases,
  phaseCounts = {},
  phaseDetails = [],
  onSave,
}: PhaseFlowEditorProps) {
  // Build lookup for phase details by name
  const detailsMap = useMemo(() => {
    const m = new Map<string, SetPhase>();
    for (const d of phaseDetails) m.set(d.name, d);
    return m;
  }, [phaseDetails]);
  // Local working copies
  const [edges, setEdges] = useState(initialEdges);
  const [phases, setPhases] = useState(initialPhases);
  const [dirty, setDirty] = useState(false);

  // Edge creation state
  const [edgeSource, setEdgeSource] = useState<string | null>(null);

  // Edge deletion hover
  const [hoveredEdgeId, setHoveredEdgeId] = useState<number | null>(null);

  // Phase management
  const [newPhaseName, setNewPhaseName] = useState('');
  const [renamingPhase, setRenamingPhase] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Saving state
  const [saving, setSaving] = useState(false);

  // Node position tracking for SVG arrows
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodeRects, setNodeRects] = useState<NodeRect[]>([]);

  // Reset local state when modal opens
  useEffect(() => {
    if (opened) {
      setEdges(initialEdges);
      setPhases(initialPhases);
      setDirty(false);
      setEdgeSource(null);
      setHoveredEdgeId(null);
      setNewPhaseName('');
      setRenamingPhase(null);
    }
  }, [opened, initialEdges, initialPhases]);

  // Measure node positions for SVG arrows
  const measureNodes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const rects: NodeRect[] = [];
    nodeRefs.current.forEach((el, phase) => {
      const r = el.getBoundingClientRect();
      rects.push({
        phase,
        x: r.left - canvasRect.left + canvas.scrollLeft,
        y: r.top - canvasRect.top + canvas.scrollTop,
        width: r.width,
        height: r.height,
      });
    });
    setNodeRects(rects);
  }, []);

  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(measureNodes, 100);
    return () => clearTimeout(timer);
  }, [opened, phases, edges, measureNodes]);

  // Also remeasure on resize
  useEffect(() => {
    if (!opened) return;
    window.addEventListener('resize', measureNodes);
    return () => window.removeEventListener('resize', measureNodes);
  }, [opened, measureNodes]);

  // Compute topological order from current edges
  const currentOrder = useMemo(() => {
    const domainEdges: PhaseEdge[] = edges.map(e => ({
      fromPhase: e.fromPhase,
      toPhase: e.toPhase,
      weight: e.weight,
    }));
    const order = getPhaseOrder(domainEdges);
    // Include phases not in any edge
    const inOrder = new Set(order);
    const standalone = phases.filter(p => !inOrder.has(p));
    return [...order, ...standalone];
  }, [edges, phases]);

  // Handle phase click for edge creation
  const handlePhaseClick = useCallback((phase: string) => {
    if (edgeSource) {
      if (edgeSource === phase) {
        setEdgeSource(null);
        return;
      }
      // Check if edge already exists
      if (edges.some(e => e.fromPhase === edgeSource && e.toPhase === phase)) {
        notifications.show({
          title: 'Edge exists',
          message: `Edge from "${edgeSource}" to "${phase}" already exists`,
          color: 'yellow',
        });
        setEdgeSource(null);
        return;
      }
      // Client-side cycle check
      const domainEdges: PhaseEdge[] = edges.map(e => ({
        fromPhase: e.fromPhase,
        toPhase: e.toPhase,
        weight: e.weight,
      }));
      if (wouldCreateCycle(domainEdges, edgeSource, phase)) {
        notifications.show({
          title: 'Cycle detected',
          message: `Adding "${edgeSource}" → "${phase}" would create a cycle`,
          color: 'red',
        });
        setEdgeSource(null);
        return;
      }
      // Add edge locally with temp negative ID
      const tempId = -(Date.now());
      setEdges(prev => [...prev, { id: tempId, fromPhase: edgeSource, toPhase: phase, weight: 1.0 }]);
      setDirty(true);
      setEdgeSource(null);
    } else {
      setEdgeSource(phase);
    }
  }, [edgeSource, edges]);

  // Delete edge locally
  const handleDeleteEdge = useCallback((edgeId: number) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
    setDirty(true);
    setHoveredEdgeId(null);
  }, []);

  // Add new phase
  const handleAddPhase = useCallback(() => {
    const name = newPhaseName.trim();
    if (!name) return;
    if (phases.includes(name)) {
      notifications.show({ title: 'Duplicate', message: `Phase "${name}" already exists`, color: 'yellow' });
      return;
    }
    setPhases(prev => [...prev, name]);
    setDirty(true);
    setNewPhaseName('');
  }, [newPhaseName, phases]);

  // Delete phase
  const handleDeletePhase = useCallback((phase: string) => {
    const count = phaseCounts[phase] ?? 0;
    if (count > 0 && !window.confirm(`Phase "${phase}" has ${count} songs. Delete anyway?`)) return;
    setPhases(prev => prev.filter(p => p !== phase));
    setEdges(prev => prev.filter(e => e.fromPhase !== phase && e.toPhase !== phase));
    setDirty(true);
    if (edgeSource === phase) setEdgeSource(null);
  }, [phaseCounts, edgeSource]);

  // Rename phase
  const startRename = useCallback((phase: string) => {
    setRenamingPhase(phase);
    setRenameValue(phase);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingPhase) return;
    const newName = renameValue.trim();
    if (!newName || newName === renamingPhase) {
      setRenamingPhase(null);
      return;
    }
    if (phases.includes(newName)) {
      notifications.show({ title: 'Duplicate', message: `Phase "${newName}" already exists`, color: 'yellow' });
      return;
    }
    setPhases(prev => prev.map(p => p === renamingPhase ? newName : p));
    setEdges(prev => prev.map(e => ({
      ...e,
      fromPhase: e.fromPhase === renamingPhase ? newName : e.fromPhase,
      toPhase: e.toPhase === renamingPhase ? newName : e.toPhase,
    })));
    setDirty(true);
    setRenamingPhase(null);
  }, [renamingPhase, renameValue, phases]);

  // Auto-arrange
  const handleAutoArrange = useCallback(async () => {
    const suggested = await onSuggestPhaseFlow();
    if (suggested.length === 0) {
      notifications.show({ title: 'No suggestions', message: 'No phases to arrange', color: 'gray' });
      return;
    }
    setEdges(suggested);
    // Merge any phases from suggestions not in current list
    const suggestedPhases = new Set<string>();
    for (const e of suggested) {
      suggestedPhases.add(e.fromPhase);
      suggestedPhases.add(e.toPhase);
    }
    setPhases(prev => {
      const combined = new Set(prev);
      for (const p of suggestedPhases) combined.add(p);
      return Array.from(combined);
    });
    setDirty(true);
  }, []);

  // Save: persist changes to DB
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Remove all existing edges (positive IDs)
      const existingIds = initialEdges.map(e => e.id);
      await Promise.all(existingIds.map(id => onRemovePhaseEdge(id)));

      // Add all current edges
      for (const edge of edges) {
        const result = await onAddPhaseEdge(edge.fromPhase, edge.toPhase, edge.weight);
        if (!result.success) {
          notifications.show({ title: 'Error', message: result.error || 'Failed to add edge', color: 'red' });
        }
      }

      setDirty(false);
      onSave();
      onClose();
      notifications.show({ title: 'Saved', message: 'Phase flow updated', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save phase flow', color: 'red' });
    } finally {
      setSaving(false);
    }
  }, [edges, initialEdges, onSave, onClose]);

  // Cancel
  const handleCancel = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  }, [dirty, onClose]);

  // Get rect for a phase
  const getRect = useCallback((phase: string): NodeRect | undefined => {
    return nodeRects.find(r => r.phase === phase);
  }, [nodeRects]);

  // Register ref for a phase node
  const setNodeRef = useCallback((phase: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeRefs.current.set(phase, el);
    } else {
      nodeRefs.current.delete(phase);
    }
  }, []);

  // Compute SVG canvas size
  const svgSize = useMemo(() => {
    if (nodeRects.length === 0) return { width: '100%', height: '100%' };
    const maxX = Math.max(...nodeRects.map(r => r.x + r.width)) + 40;
    const maxY = Math.max(...nodeRects.map(r => r.y + r.height)) + 40;
    return { width: `${maxX}px`, height: `${maxY}px` };
  }, [nodeRects]);

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title="Phase Flow Editor"
      size="xl"
      fullScreen={typeof window !== 'undefined' && window.innerWidth < 768}
      centered
      closeOnClickOutside={!dirty}
    >
      <Stack gap="md" className="phase-flow-editor">
        {/* Toolbar */}
        <Group gap="sm" justify="space-between">
          <Group gap="xs">
            <Tooltip label="Auto-arrange phases based on common DJ flow" withArrow>
              <Button
                size="xs"
                variant="light"
                color="violet"
                leftSection={<IconWand size={14} />}
                onClick={handleAutoArrange}
                data-testid="pfe-auto-arrange"
              >
                Auto-arrange
              </Button>
            </Tooltip>
            <Text size="xs" c="dimmed">
              Click a phase to start connecting, then click another to create an edge.
            </Text>
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              onClick={handleCancel}
              data-testid="pfe-cancel"
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="filled"
              color="violet"
              leftSection={<IconCheck size={14} />}
              onClick={handleSave}
              loading={saving}
              disabled={!dirty}
              data-testid="pfe-save"
            >
              Save
            </Button>
          </Group>
        </Group>

        {/* Canvas area */}
        <Box className="pfe-canvas" ref={canvasRef}>
          {/* SVG overlay for arrows */}
          <svg
            className="pfe-svg-overlay"
            style={{ width: svgSize.width, height: svgSize.height }}
          >
            <defs>
              <marker
                id="pfe-arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
                className="pfe-arrow-marker"
              >
                <polygon points="0 0, 10 3.5, 0 7" />
              </marker>
            </defs>

            {/* Render edges as curved paths */}
            {edges.map(edge => {
              const fromRect = getRect(edge.fromPhase);
              const toRect = getRect(edge.toPhase);
              if (!fromRect || !toRect) return null;

              const x1 = fromRect.x + fromRect.width;
              const y1 = fromRect.y + fromRect.height / 2;
              const x2 = toRect.x;
              const y2 = toRect.y + toRect.height / 2;
              const mx = (x1 + x2) / 2;

              const isHovered = hoveredEdgeId === edge.id;

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    className="pfe-edge-line"
                    markerEnd="url(#pfe-arrowhead)"
                    style={isHovered ? { stroke: 'var(--mantine-color-red-5)', strokeWidth: 3 } : undefined}
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}
                    onClick={() => handleDeleteEdge(edge.id)}
                  />
                  {/* Delete button at midpoint */}
                  {isHovered && (
                    <g
                      className="pfe-edge-delete-btn"
                      transform={`translate(${mx}, ${(y1 + y2) / 2})`}
                      onClick={() => handleDeleteEdge(edge.id)}
                    >
                      <circle r="8" />
                      <text x="0" y="0">×</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Phase nodes */}
          <div className="pfe-canvas-inner">
            {currentOrder.map(phase => {
              const count = phaseCounts[phase] ?? 0;
              const isSource = edgeSource === phase;
              const isTarget = edgeSource !== null && edgeSource !== phase;
              const isRenaming = renamingPhase === phase;

              return (
                <Card
                  key={phase}
                  ref={(el: HTMLDivElement | null) => setNodeRef(phase, el)}
                  padding="sm"
                  radius="md"
                  withBorder
                  className={[
                    'pfe-node',
                    isSource ? 'pfe-node-source' : '',
                    isTarget ? 'pfe-node-target-hint' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    if (!isRenaming) handlePhaseClick(phase);
                  }}
                  data-testid={`pfe-node-${phase}`}
                >
                  {/* Delete button */}
                  <ActionIcon
                    size={18}
                    variant="filled"
                    color="red"
                    className="pfe-node-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhase(phase);
                    }}
                    data-testid={`pfe-delete-${phase}`}
                  >
                    <IconX size={12} />
                  </ActionIcon>

                  <Stack gap={4} align="center">
                    {isRenaming ? (
                      <TextInput
                        size="xs"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.currentTarget.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingPhase(null);
                        }}
                        className="pfe-rename-input"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`pfe-rename-input-${phase}`}
                      />
                    ) : (
                      <Text
                        fw={600}
                        size="sm"
                        tt="capitalize"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRename(phase);
                        }}
                        data-testid={`pfe-phase-name-${phase}`}
                      >
                        {phase}
                      </Text>
                    )}
                    {(() => {
                      const detail = detailsMap.get(phase);
                      return detail ? (
                        <>
                          {detail.description && (
                            <Text size="10px" c="dimmed" ta="center" lineClamp={2} maw={120}>
                              {detail.description}
                            </Text>
                          )}
                          {(detail.targetBpmRange || detail.targetEnergyRange) && (
                            <Text size="10px" c="dimmed" ta="center">
                              {detail.targetBpmRange && `${detail.targetBpmRange[0]}–${detail.targetBpmRange[1]} BPM`}
                              {detail.targetBpmRange && detail.targetEnergyRange && ' · '}
                              {detail.targetEnergyRange && `E${detail.targetEnergyRange[0]}–${detail.targetEnergyRange[1]}`}
                            </Text>
                          )}
                        </>
                      ) : null;
                    })()}
                    <Badge size="sm" variant="light" color="gray">
                      {count} {count === 1 ? 'song' : 'songs'}
                    </Badge>
                    {isSource && (
                      <Text size="10px" c="yellow" fw={500}>
                        Source ✦
                      </Text>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </div>

          {/* Connection hint */}
          {edgeSource && (
            <Badge
              color="yellow"
              variant="filled"
              size="sm"
              className="pfe-connection-hint"
            >
              Click a target phase to connect from &quot;{edgeSource}&quot; — or click it again to cancel
            </Badge>
          )}
        </Box>

        {/* Add phase */}
        <Group gap="xs">
          <TextInput
            size="xs"
            placeholder="New phase name…"
            value={newPhaseName}
            onChange={(e) => setNewPhaseName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPhase();
            }}
            style={{ flex: 1, maxWidth: 250 }}
            data-testid="pfe-new-phase-input"
          />
          <Button
            size="xs"
            variant="light"
            color="violet"
            leftSection={<IconPlus size={14} />}
            onClick={handleAddPhase}
            disabled={!newPhaseName.trim()}
            data-testid="pfe-add-phase"
          >
            Add Phase
          </Button>
        </Group>

        {/* Preview: topological order */}
        <Box className="pfe-preview">
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed" fw={600}>
              Flow order:
            </Text>
            {currentOrder.length > 0 ? (
              currentOrder.map((phase, i) => (
                <Group key={phase} gap={2} wrap="nowrap">
                  {i > 0 && <IconArrowRight size={12} color="var(--mantine-color-dimmed)" />}
                  <Badge size="sm" variant="light" color="violet" tt="capitalize">
                    {phase}
                  </Badge>
                </Group>
              ))
            ) : (
              <Text size="xs" c="dimmed">No phases defined</Text>
            )}
          </Group>
        </Box>
      </Stack>
    </Modal>
  );
}
