import type { PendingEdit } from '../lib/mp3-metadata';
import { getStatusClasses, getButtonClasses, formatTestResults } from '../lib/pending-edits-utils';

// Pure render functions for UI components

export const renderLoadingState = () => (
  <div className="p-4 text-center">Loading pending edits...</div>
);

export const renderErrorState = (error: string, onRetry: () => void) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-700 whitespace-pre-line">Error: {error}</p>
    <button 
      type="button"
      onClick={onRetry}
      className={getButtonClasses('danger')}
    >
      Retry
    </button>
  </div>
);

export const renderEmptyState = () => (
  <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
    <h3 className="text-lg font-semibold mb-2 text-gray-900">Pending Edits</h3>
    <p className="text-gray-500">No pending edits found.</p>
  </div>
);

export const renderLastError = (
  lastError: { timestamp: Date; error: string; filePath?: string },
  onClear: () => void
) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-red-800 mb-1">
          Last Apply Error
        </h4>
        <p className="text-sm text-red-700 mb-1">
          <strong>File:</strong> {lastError.filePath}
        </p>
        <p className="text-sm text-red-700 mb-1">
          <strong>Error:</strong> {lastError.error}
        </p>
        <p className="text-xs text-red-600">
          {lastError.timestamp.toLocaleString()}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="ml-3 text-red-400 hover:text-red-600"
        aria-label="Clear error"
      >
        ✕
      </button>
    </div>
  </div>
);

interface TestPanelProps {
  testing: boolean;
  testResults: Array<{ name: string; success: boolean; error?: string; details?: any }>;
  onRunTest: (type: 'comment' | 'workflow') => void;
  onClearResults: () => void;
}

export const renderTestPanel = ({
  testing,
  testResults,
  onRunTest,
  onClearResults
}: TestPanelProps) => (
  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h4 className="text-sm font-medium text-blue-800 mb-3">
      MP3 Comment Testing
    </h4>
    <div className="flex flex-wrap gap-2 mb-3">
      <button
        type="button"
        onClick={() => onRunTest('comment')}
        disabled={testing}
        className={getButtonClasses('primary', testing)}
      >
        {testing ? 'Testing...' : 'Test Comment Writing'}
      </button>
      <button
        type="button"
        onClick={() => onRunTest('workflow')}
        disabled={testing}
        className={getButtonClasses('primary', testing)}
      >
        {testing ? 'Testing...' : 'Test Full Workflow'}
      </button>
      {testResults.length > 0 && (
        <button
          type="button"
          onClick={onClearResults}
          className={getButtonClasses('secondary')}
        >
          Clear Results
        </button>
      )}
    </div>
    
    {testResults.length > 0 && renderTestResults(testResults)}
  </div>
);

const renderTestResults = (testResults: Array<{ name: string; success: boolean; error?: string; details?: any }>) => {
  const formattedResults = formatTestResults(testResults);
  
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-blue-800">Test Results:</h5>
      {formattedResults.map((result, index) => (
        <div 
          key={index}
          className={`p-2 rounded text-sm ${result.classes} border`}
        >
          <div className="flex items-center gap-2">
            <span>{result.icon}</span>
            <strong>{result.name}</strong>
          </div>
          {result.error && (
            <div className="mt-1 text-xs opacity-75">
              Error: {result.error}
            </div>
          )}
          {result.details && (
            <div className="mt-1 text-xs opacity-75">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

interface EditingFormProps {
  comment: string;
  onChange: (comment: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const renderEditingForm = ({ comment, onChange, onSave, onCancel }: EditingFormProps) => (
  <div className="space-y-2">
    <textarea
      value={comment}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      rows={2}
      placeholder="Enter new comment..."
      aria-label="Edit comment"
    />
    <div className="flex space-x-1">
      <button
        type="button"
        onClick={onSave}
        className={getButtonClasses('primary')}
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={getButtonClasses('secondary')}
      >
        Cancel
      </button>
    </div>
  </div>
);

interface EditItemProps {
  edit: PendingEdit;
  isSelected: boolean;
  isEditing: boolean;
  editingComment: string;
  onToggleSelect: (id: number) => void;
  onStartEdit: (edit: PendingEdit) => void;
  onUpdateComment: (comment: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: number) => void;
}

export const renderEditItem = ({
  edit,
  isSelected,
  isEditing,
  editingComment,
  onToggleSelect,
  onStartEdit,
  onUpdateComment,
  onSaveEdit,
  onCancelEdit,
  onDelete
}: EditItemProps) => (
  <div key={edit.id} className="p-4 border border-gray-200 rounded-lg">
    <div className="flex items-start space-x-3">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(edit.id)}
        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        aria-label={`Select edit for ${edit.filePath}`}
      />
      
      <div className="flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium text-gray-900">{edit.filePath}</p>
          <p className="text-xs text-gray-500">
            Created: {new Date(edit.createdAt).toLocaleString()} | 
            Status: <span className={getStatusClasses(edit.status)}>{edit.status}</span>
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
            {isEditing ? (
              renderEditingForm({
                comment: editingComment,
                onChange: onUpdateComment,
                onSave: onSaveEdit,
                onCancel: onCancelEdit
              })
            ) : (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                {edit.newComment}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col space-y-1">
        {!isEditing && (
          <button
            type="button"
            onClick={() => onStartEdit(edit)}
            className={getButtonClasses('primary')}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(edit.id)}
          className={getButtonClasses('danger')}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

interface HeaderProps {
  totalCount: number;
  selectedCount: number;
  allSelected: boolean;
  applying: boolean;
  onSelectAll: (selected: boolean) => void;
  onApplyEdits: () => void;
}

export const renderHeader = ({
  totalCount,
  selectedCount,
  allSelected,
  applying,
  onSelectAll,
  onApplyEdits
}: HeaderProps) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-gray-900">
      Pending Edits ({totalCount})
    </h3>
    
    <div className="flex items-center space-x-2">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Select All</span>
      </label>
      
      <button
        type="button"
        onClick={onApplyEdits}
        disabled={applying}
        className={getButtonClasses('success', applying)}
      >
        {applying ? 'Applying...' : `Apply ${selectedCount > 0 ? `${selectedCount} ` : 'All '}Edits`}
      </button>
    </div>
  </div>
);