import React, { useState, useEffect } from 'react';
import type { PendingEdit } from '../lib/mp3-metadata';
import { onGetPendingEdits, onApplyPendingEdit, onRejectPendingEdit } from './MP3Library.telefunc';
import './MP3Library.css';

interface MP3LibraryProps {
  // Props for the MP3Library component
}

interface PendingEditWithFileName extends PendingEdit {
  fileName: string;
}

export function MP3Library({ }: MP3LibraryProps) {
  const [pendingEdits, setPendingEdits] = useState<PendingEditWithFileName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingEdits, setProcessingEdits] = useState<Set<number>>(new Set());

  const loadPendingEdits = async () => {
    try {
      setLoading(true);
      setError(null);
      const edits = await onGetPendingEdits();
      
      // Add fileName for display
      const editsWithFileName = edits
        .filter(edit => edit.status === 'pending')
        .map(edit => ({
          ...edit,
          fileName: edit.filePath.split('/').pop() || edit.filePath
        }));
      
      setPendingEdits(editsWithFileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending edits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingEdits();
  }, []);

  const handleApplyEdit = async (editId: number) => {
    setProcessingEdits(prev => new Set([...prev, editId]));
    
    try {
      const result = await onApplyPendingEdit(editId);
      
      if (result.success) {
        // Remove the edit from the list since it's now applied
        setPendingEdits(prev => prev.filter(edit => edit.id !== editId));
      } else {
        setError(`Failed to apply edit: ${result.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edit');
    } finally {
      setProcessingEdits(prev => {
        const newSet = new Set(prev);
        newSet.delete(editId);
        return newSet;
      });
    }
  };

  const handleRejectEdit = async (editId: number) => {
    setProcessingEdits(prev => new Set([...prev, editId]));
    
    try {
      const result = await onRejectPendingEdit(editId);
      
      if (result.success) {
        // Remove the edit from the list since it's now rejected
        setPendingEdits(prev => prev.filter(edit => edit.id !== editId));
      } else {
        setError(`Failed to reject edit: ${result.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject edit');
    } finally {
      setProcessingEdits(prev => {
        const newSet = new Set(prev);
        newSet.delete(editId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="mp3-library">
        <h3>MP3 Library - Pending Changes</h3>
        <p>Loading pending changes...</p>
      </div>
    );
  }

  return (
    <div className="mp3-library">
      <h3>MP3 Library - Pending Changes</h3>
      
      {error && (
        <div className="error-message">
          <span><strong>Error:</strong> {error}</span>
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <button 
        className="refresh-button"
        onClick={loadPendingEdits}
      >
        Refresh
      </button>

      {pendingEdits.length === 0 ? (
        <p className="no-pending-message">
          No pending changes found. All edits have been applied or there are no pending edits.
        </p>
      ) : (
        <div>
          <p className="pending-count">
            <strong>{pendingEdits.length}</strong> file{pendingEdits.length !== 1 ? 's' : ''} with pending changes:
          </p>
          
          <div className="pending-edits-container">
            {pendingEdits.map(edit => {
              const isProcessing = processingEdits.has(edit.id);
              
              return (
                <div key={edit.id} className="pending-edit-card">
                  <div className="file-info">
                    <div className="file-name">{edit.fileName}</div>
                    <div className="file-path">{edit.filePath}</div>
                    <div className="created-date">
                      Created: {new Date(edit.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="comment-change-section">
                    <div className="comment-change-label">Comment Change:</div>
                    <div className="comment-change-container">
                      <div className="comment-change-row">
                        <span className="comment-label">From:</span>{' '}
                        <span className={`comment-from ${!edit.originalComment ? 'no-comment' : ''}`}>
                          {edit.originalComment || '(no comment)'}
                        </span>
                      </div>
                      <div className="comment-change-row">
                        <span className="comment-label">To:</span>{' '}
                        <span className="comment-to">
                          {edit.newComment}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="action-buttons">
                    <button
                      className="apply-button"
                      onClick={() => handleApplyEdit(edit.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Applying...' : 'Apply Change'}
                    </button>
                    
                    <button
                      className="reject-button"
                      onClick={() => handleRejectEdit(edit.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Rejecting...' : 'Reject Change'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
