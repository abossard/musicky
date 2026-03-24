import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { onGetPhases, onSetPhases, onGetKeepPlayHead, onSetKeepPlayHead } from './Settings.telefunc';
import { SortablePhaseItem } from './SortablePhaseItem';
import type { SetPhase } from '../lib/set-phase';
import { stringToSetPhase } from '../lib/set-phase';
import './Settings.css';

export function Settings() {
  const [phases, setPhases] = useState<SetPhase[]>([]);
  const [newPhase, setNewPhase] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [keepPlayHead, setKeepPlayHead] = useState(false);

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum distance to start dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [currentPhases, keepPlayHeadSetting] = await Promise.all([
        onGetPhases(),
        onGetKeepPlayHead()
      ]);
      setPhases(currentPhases);
      setKeepPlayHead(keepPlayHeadSetting);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPhase = () => {
    const name = newPhase.trim();
    if (name && !phases.some(p => p.name === name)) {
      const updatedPhases = [...phases, stringToSetPhase(name)];
      setPhases(updatedPhases);
      setNewPhase('');
      persistPhases(updatedPhases);
    }
  };

  const handleRemovePhase = (phaseId: string) => {
    const updatedPhases = phases.filter(p => p.id !== phaseId);
    setPhases(updatedPhases);
    persistPhases(updatedPhases);
  };

  const handleUpdatePhase = (updated: SetPhase) => {
    const updatedPhases = phases.map(p => p.id === updated.id ? updated : p);
    setPhases(updatedPhases);
    persistPhases(updatedPhases);
  };

  const persistPhases = async (phasesToSave: SetPhase[]) => {
    try {
      setIsSaving(true);
      await onSetPhases(phasesToSave);
    } catch (error) {
      console.error('Failed to save phases:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeepPlayHeadChange = async (enabled: boolean) => {
    try {
      setIsSaving(true);
      await onSetKeepPlayHead(enabled);
      setKeepPlayHead(enabled);
    } catch (error) {
      console.error('Failed to save keep play head setting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPhase();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Only proceed if we have a valid drop target and it's different from the source
    if (active.id !== over?.id && over?.id) {
      const oldIndex = phases.findIndex(p => p.id === active.id);
      const newIndex = phases.findIndex(p => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedPhases = arrayMove(phases, oldIndex, newIndex);
        setPhases(reorderedPhases);
        persistPhases(reorderedPhases);
      }
    }
  };

  if (isLoading) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      
      <div className="playback-section">
        <h3>Playback Settings</h3>
        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={keepPlayHead}
              onChange={(e) => handleKeepPlayHeadChange(e.target.checked)}
              disabled={isSaving}
              className="setting-checkbox"
            />
            Keep play head position when switching tracks
          </label>
          <p className="setting-description">
            When enabled, the playback position is preserved when switching between tracks. 
            For example, if you pause at 1:30 in a track and switch to another track, 
            the new track will start at 1:30.
          </p>
        </div>
      </div>
      
      <div className="phases-section">
        <h3>Library Phases</h3>
        <p>Manage the phases used to organize your MP3 library. Drag the handle to reorder phases. Click the arrow to expand and edit details.</p>
        
        <div className="add-phase">
          <input
            type="text"
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter new phase name..."
            className="phase-input"
            disabled={isSaving}
          />
          <button 
            onClick={handleAddPhase}
            disabled={!newPhase.trim() || phases.some(p => p.name === newPhase.trim()) || isSaving}
            className="add-phase-btn"
          >
            Add Phase
          </button>
        </div>

        <div className="phases-list">
          {phases.length === 0 ? (
            <p className="no-phases">No phases configured yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={phases.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <ul className="phases">
                  {phases.map((phase) => (
                    <SortablePhaseItem
                      key={phase.id}
                      id={phase.id}
                      phase={phase}
                      onRemove={handleRemovePhase}
                      onUpdate={handleUpdatePhase}
                      disabled={isSaving}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {isSaving && <div className="saving-indicator">Saving...</div>}
      </div>
    </div>
  );
}
