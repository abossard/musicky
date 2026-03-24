import { useState, useEffect } from 'react';
import { onGetKeepPlayHead, onSetKeepPlayHead } from './Settings.telefunc';
import './Settings.css';

export function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [keepPlayHead, setKeepPlayHead] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const keepPlayHeadSetting = await onGetKeepPlayHead();
      setKeepPlayHead(keepPlayHeadSetting);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
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
    </div>
  );
}
