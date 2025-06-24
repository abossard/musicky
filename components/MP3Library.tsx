import React, { useState, useEffect } from 'react';
import { Checkbox } from '@mantine/core';
import type { MP3Metadata, PendingEdit } from '../lib/mp3-metadata';
import { onGetAllMP3Files, onUpdateFilePhases, onGetPendingEdits, onApplyPendingEdit, onRejectPendingEdit } from './MP3Library.telefunc';
import { onGetPhases } from './Settings.telefunc';
import './MP3Library.css';

interface MP3LibraryProps {}

export function MP3Library({}: MP3LibraryProps) {
  const [mp3Files, setMp3Files] = useState<MP3Metadata[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFiles, setUpdatingFiles] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [scanResult, availablePhases, edits] = await Promise.all([
        onGetAllMP3Files(),
        onGetPhases(),
        onGetPendingEdits()
      ]);
      
      setMp3Files(scanResult.files);
      setPhases(availablePhases);
      setPendingEdits(edits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MP3 library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getFilePhases = (comment: string): string[] => {
    const hashtags = comment.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.slice(1)).filter(tag => phases.includes(tag));
  };

  const getFilePendingEdit = (filePath: string): PendingEdit | undefined => {
    return pendingEdits.find(edit => edit.filePath === filePath && edit.status === 'pending');
  };

  const getEffectiveComment = (filePath: string, originalComment: string): string => {
    const pendingEdit = getFilePendingEdit(filePath);
    return pendingEdit ? pendingEdit.newComment : originalComment;
  };

  const handlePhaseToggle = async (filePath: string, phase: string, checked: boolean) => {
    setUpdatingFiles(prev => new Set([...prev, filePath]));
    
    try {
      const file = mp3Files.find(f => f.filePath === filePath);
      if (!file) return;
      
      const effectiveComment = getEffectiveComment(filePath, file.comment || '');
      const currentPhases = getFilePhases(effectiveComment);
      const newPhases = checked 
        ? [...currentPhases, phase]
        : currentPhases.filter(p => p !== phase);
      
      const result = await onUpdateFilePhases(filePath, newPhases);
      
      if (result.success) {
        // Reload data to get the updated state
        await loadData();
      } else {
        setError(result.error || 'Failed to update phases');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update phases');
    } finally {
      setUpdatingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  const handleApplyEdit = async (editId: number) => {
    try {
      const result = await onApplyPendingEdit(editId);
      if (result.success) {
        await loadData(); // Reload to get updated state
      } else {
        setError(result.error || 'Failed to apply edit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edit');
    }
  };

  const handleRejectEdit = async (editId: number) => {
    try {
      const result = await onRejectPendingEdit(editId);
      if (result.success) {
        await loadData(); // Reload to get updated state
      } else {
        setError(result.error || 'Failed to reject edit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject edit');
    }
  };

  const dismissError = () => {
    setError(null);
  };

  if (loading) {
    return (
      <div className="mp3-library">
        <p>Loading MP3 library...</p>
      </div>
    );
  }

  return (
    <div className="mp3-library">
      <h3>MP3 Library</h3>
      
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={dismissError} className="error-dismiss">×</button>
        </div>
      )}
      
      <button onClick={loadData} className="refresh-button">
        Refresh
      </button>

      {mp3Files.length === 0 ? (
        <div className="no-files-message">
          No MP3 files found. Make sure the base folder is set and contains MP3 files.
        </div>
      ) : (
        <>
          <div className="file-count">
            Found {mp3Files.length} MP3 file{mp3Files.length !== 1 ? 's' : ''}
          </div>
          
          <div className="mp3-table-container">
            <table className="mp3-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Phases</th>
                  <th>Comment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mp3Files.map((file) => {
                  const pendingEdit = getFilePendingEdit(file.filePath);
                  const effectiveComment = getEffectiveComment(file.filePath, file.comment || '');
                  const currentPhases = getFilePhases(effectiveComment);
                  const isUpdating = updatingFiles.has(file.filePath);
                  const hasPending = !!pendingEdit;

                  return (
                    <tr 
                      key={file.filePath} 
                      className={`${isUpdating ? 'updating' : ''} ${hasPending ? 'has-pending' : ''}`}
                    >
                      <td className="file-name-cell">
                        <div className="file-name" title={file.filePath}>
                          {file.filePath.split('/').pop() || file.filePath}
                        </div>
                      </td>
                      
                      <td className="phases-cell">
                        <div className="phases-checkboxes">
                          {phases.map((phase) => (
                            <Checkbox
                              key={phase}
                              label={phase}
                              checked={currentPhases.includes(phase)}
                              onChange={(event) => 
                                handlePhaseToggle(file.filePath, phase, event.currentTarget.checked)
                              }
                              disabled={isUpdating}
                            />
                          ))}
                        </div>
                      </td>
                      
                      <td className="comment-cell">
                        <div className={`comment-content ${hasPending ? 'comment-pending' : ''}`}>
                          {effectiveComment || '(no comment)'}
                        </div>
                      </td>
                      
                      <td className="actions-cell">
                        <div className="action-buttons">
                          {pendingEdit && (
                            <>
                              <button
                                className="action-button apply-button"
                                onClick={() => handleApplyEdit(pendingEdit.id)}
                                disabled={isUpdating}
                              >
                                Apply
                              </button>
                              <button
                                className="action-button reject-button"
                                onClick={() => handleRejectEdit(pendingEdit.id)}
                                disabled={isUpdating}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default MP3Library;
