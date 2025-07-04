import React, { useState, useEffect } from 'react';
import { onReadMP3Metadata, onSavePendingEdit } from './MP3MetadataViewer.telefunc';
import type { MP3Metadata } from '../lib/mp3-metadata';

interface MP3MetadataViewerProps {
  filePath: string;
  phases?: string[];
  onPendingEditAdded?: () => void;
}

export function MP3MetadataViewer({ filePath, phases = [], onPendingEditAdded }: MP3MetadataViewerProps) {
  const [metadata, setMetadata] = useState<MP3Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);

  const extractTags = (comment: string): string[] => {
    const regex = /#(\w+)/g;
    const tags: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(comment))) {
      tags.push(match[1]);
    }
    return tags;
  };

  const togglePhase = (tag: string) => {
    const tags = new Set(extractTags(newComment));
    if (tags.has(tag)) {
      tags.delete(tag);
    } else {
      tags.add(tag);
    }
    const baseText = newComment.replace(/#\w+/g, '').trim();
    const tagString = Array.from(tags).map(t => `#${t}`).join(' ');
    const combined = `${baseText} ${tagString}`.trim();
    setNewComment(combined);
  };

  useEffect(() => {
    loadMetadata();
  }, [filePath]);

  const loadMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onReadMP3Metadata(filePath);
      setMetadata(data);
      setNewComment(data.comment || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComment = async () => {
    if (!metadata) return;
    
    setSaving(true);
    try {
      await onSavePendingEdit(filePath, metadata.comment || null, newComment);
      setEditingComment(false);
      onPendingEditAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingComment(false);
    setNewComment(metadata?.comment || '');
  };

  if (loading) {
    return <div className="p-4 text-center">Loading metadata...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Error: {error}</p>
        <button 
          onClick={loadMetadata}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metadata) {
    return <div className="p-4 text-center">No metadata found</div>;
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">MP3 Metadata</h3>
      
      <div className="space-y-3">
        <MetadataField label="Title" value={metadata.title} />
        <MetadataField label="Artist" value={metadata.artist} />
        <MetadataField label="Album" value={metadata.album} />
        <MetadataField label="Year" value={metadata.year?.toString()} />
        <MetadataField label="Genre" value={Array.isArray(metadata.genre) ? metadata.genre.join(', ') : metadata.genre} />
        <MetadataField label="Track" value={metadata.track ? `${metadata.track.no}${metadata.track.of ? ` of ${metadata.track.of}` : ''}` : undefined} />
        <MetadataField label="Duration" value={metadata.duration ? `${Math.round(metadata.duration)}s` : undefined} />
        
        {/* Editable Comment Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Comment (Editable)
          </label>
          
          {editingComment ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter comment..."
                />
                {phases.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {phases.map(tag => (
                      <label key={tag} className="flex items-center space-x-1 text-xs">
                        <input
                          type="checkbox"
                          checked={extractTags(newComment).includes(tag)}
                        onChange={() => togglePhase(tag)}
                        />
                        <span>#{tag}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveComment}
                  disabled={saving || newComment === (metadata.comment || '')}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save as Pending'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-2">
              <div className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-md min-h-[2.5rem]">
                {metadata.comment || <span className="text-gray-400">No comment</span>}
                {extractTags(metadata.comment || '').length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {extractTags(metadata.comment || '').map(t => (
                      <span key={t} className="text-xs bg-blue-100 text-blue-800 px-1 rounded">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setEditingComment(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetadataFieldProps {
  label: string;
  value?: string;
}

function MetadataField({ label, value }: MetadataFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="p-2 bg-gray-50 border border-gray-200 rounded-md">
        {value || <span className="text-gray-400">Not available</span>}
      </div>
    </div>
  );
}
