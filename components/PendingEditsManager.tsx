import React, { useState, useEffect } from 'react';
import { onGetPendingEdits, onApplyPendingEdits, onDeletePendingEdit, onUpdatePendingEdit } from './MP3MetadataViewer.telefunc';
import type { PendingEdit } from '../lib/mp3-metadata';

interface PendingEditsManagerProps {
  onRefresh?: () => void;
}

export function PendingEditsManager({ onRefresh }: PendingEditsManagerProps) {
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [selectedEdits, setSelectedEdits] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState('');

  useEffect(() => {
    loadPendingEdits();
  }, []);

  const loadPendingEdits = async () => {
    setLoading(true);
    setError(null);
    try {
      const edits = await onGetPendingEdits();
      setPendingEdits(edits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending edits');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyEdits = async () => {
    setApplying(true);
    try {
      const result = await onApplyPendingEdits(selectedEdits.length > 0 ? selectedEdits : undefined);
      
      if (result.failed.length > 0) {
        const failedMessages = result.failed.map(f => `${f.filePath}: ${f.error}`).join('\n');
        setError(`Some edits failed:\n${failedMessages}`);
      } else {
        setError(null);
      }
      
      await loadPendingEdits();
      setSelectedEdits([]);
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edits');
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteEdit = async (id: number) => {
    try {
      await onDeletePendingEdit(id);
      await loadPendingEdits();
      setSelectedEdits(prev => prev.filter(editId => editId !== id));
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete edit');
    }
  };

  const handleEditComment = (edit: PendingEdit) => {
    setEditingId(edit.id);
    setEditingComment(edit.newComment);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      await onUpdatePendingEdit(editingId, editingComment);
      await loadPendingEdits();
      setEditingId(null);
      setEditingComment('');
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update edit');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingComment('');
  };

  const handleSelectEdit = (id: number, selected: boolean) => {
    setSelectedEdits(prev => 
      selected 
        ? [...prev, id]
        : prev.filter(editId => editId !== id)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedEdits(selected ? pendingEdits.map(edit => edit.id) : []);
  };

  if (loading) {
    return <div className="p-4 text-center">Loading pending edits...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 whitespace-pre-line">Error: {error}</p>
        <button 
          onClick={loadPendingEdits}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pendingEdits.length === 0) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Pending Edits</h3>
        <p className="text-gray-500">No pending edits found.</p>
      </div>
    );
  }

  const allSelected = selectedEdits.length === pendingEdits.length;
  const someSelected = selectedEdits.length > 0;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Pending Edits ({pendingEdits.length})
        </h3>
        
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Select All</span>
          </label>
          
          <button
            onClick={handleApplyEdits}
            disabled={applying}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {applying ? 'Applying...' : `Apply ${someSelected ? `${selectedEdits.length} ` : 'All '}Edits`}
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        {pendingEdits.map((edit) => (
          <div key={edit.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={selectedEdits.includes(edit.id)}
                onChange={(e) => handleSelectEdit(edit.id, e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                aria-label={`Select edit for ${edit.filePath}`}
              />
              
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{edit.filePath}</p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(edit.createdAt).toLocaleString()} | 
                    Status: <span className={`font-medium ${
                      edit.status === 'pending' ? 'text-yellow-600' :
                      edit.status === 'applied' ? 'text-green-600' :
                      'text-red-600'
                    }`}>{edit.status}</span>
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Original Comment
                    </label>
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                      {edit.originalComment || <span className="text-gray-400">No comment</span>}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      New Comment
                    </label>
                    {editingId === edit.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingComment}
                          onChange={(e) => setEditingComment(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Enter new comment..."
                          aria-label="Edit comment"
                        />
                        <div className="flex space-x-1">
                          <button
                            onClick={handleSaveEdit}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        {edit.newComment}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-1">
                {editingId !== edit.id && (
                  <button
                    onClick={() => handleEditComment(edit)}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDeleteEdit(edit.id)}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
