import React, { useState } from 'react';
import { MP3MetadataViewer } from '../../components/MP3MetadataViewer';
import { PendingEditsManager } from '../../components/PendingEditsManager';

export function Page() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Path to the demo MP3 file (relative to project root)
  const demoFilePath = './lifekiller.mp3';

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            MP3 Metadata & Tag Management Demo
          </h1>
          <p className="text-gray-600">
            Demonstrating MP3 tag reading and comment editing with lifekiller.mp3
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* MP3 Metadata Viewer */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              MP3 Metadata
            </h2>
            <MP3MetadataViewer 
              key={`metadata-${refreshKey}`}
              filePath={demoFilePath}
              onPendingEditAdded={handleRefresh}
            />
          </div>

          {/* Pending Edits Manager */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Pending Comment Edits
            </h2>
            <PendingEditsManager 
              key={`edits-${refreshKey}`}
              onRefresh={handleRefresh}
              testFilePath={demoFilePath}
            />
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            How it works:
          </h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>• View all MP3 metadata tags (title, artist, album, etc.) in read-only mode</li>
            <li>• Edit only the comment field - changes are saved as "pending edits"</li>
            <li>• Review all pending edits in the right panel</li>
            <li>• Apply edits individually or in batches to write changes to the actual MP3 files</li>
            <li>• Edit or delete pending changes before applying them</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
