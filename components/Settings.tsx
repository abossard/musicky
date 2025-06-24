import React, { useState, useEffect } from 'react';
import { onGetPhases, onSetPhases } from './Settings.telefunc';
import './Settings.css';

export function Settings() {
  const [phases, setPhases] = useState<string[]>([]);
  const [newPhase, setNewPhase] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPhases();
  }, []);

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
