import React, { useState, useEffect } from 'react';
import { onGetPhases, onSetPhases, onGetKeepPlayHead, onSetKeepPlayHead } from './Settings.telefunc';
import './Settings.css';

export function Settings() {
  const [phases, setPhases] = useState<string[]>([]);
  const [newPhase, setNewPhase] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [keepPlayHead, setKeepPlayHead] = useState(false);

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

  const loadPhases = async () => {
    try {
      setIsLoading(true);
      const currentPhases = await onGetPhases();
      setPhases(currentPhases);
    } catch (error) {
      console.error('Failed to load phases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPhase = () => {
    if (newPhase.trim() && !phases.includes(newPhase.trim())) {
      const updatedPhases = [...phases, newPhase.trim()];
      setPhases(updatedPhases);
      setNewPhase('');
      savePhases(updatedPhases);
    }
  };

  const handleRemovePhase = (phaseToRemove: string) => {
    const updatedPhases = phases.filter(phase => phase !== phaseToRemove);
    setPhases(updatedPhases);
    savePhases(updatedPhases);
  };

  const savePhases = async (phasesToSave: string[]) => {
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
        <p>Manage the phases used to organize your MP3 library.</p>
        
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
            disabled={!newPhase.trim() || phases.includes(newPhase.trim()) || isSaving}
            className="add-phase-btn"
          >
            Add Phase
          </button>
        </div>

        <div className="phases-list">
          {phases.length === 0 ? (
            <p className="no-phases">No phases configured yet.</p>
          ) : (
            <ul className="phases">
              {phases.map((phase) => (
                <li key={phase} className="phase-item">
                  <span className="phase-name">{phase}</span>
                  <button
                    onClick={() => handleRemovePhase(phase)}
                    className="remove-phase-btn"
                    disabled={isSaving}
                    title={`Remove ${phase}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isSaving && <div className="saving-indicator">Saving...</div>}
      </div>
    </div>
  );
}
