import React, { useEffect } from 'react';
import type { PendingEdit } from '../lib/mp3-metadata';
import { usePendingEditsState } from '../hooks/use-pending-edits-state';
import { useAsyncState, withErrorHandling, withRefresh } from '../hooks/use-async-state';
import {
  fetchPendingEdits,
  fetchLastError,
  applyEdits,
  deleteEdit,
  updateEdit,
  clearLastError,
  runCommentTest,
  runWorkflowTest,
  formatApplyErrors,
} from '../lib/pending-edits-utils';
import {
  renderLoadingState,
  renderErrorState,
  renderEmptyState,
  renderLastError,
  renderTestPanel,
  renderHeader,
  renderEditItem
} from './pending-edits-ui';

interface PendingEditsManagerProps {
  onRefresh?: () => void;
  testFilePath?: string;
}

export function PendingEditsManager({ onRefresh, testFilePath }: PendingEditsManagerProps) {
  const { state, actions, computed } = usePendingEditsState();
  const { error, execute: executeAsync } = useAsyncState<any>();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    actions.setLoading(true);
    try {
      const [edits, lastErr] = await Promise.all([
        fetchPendingEdits(),
        fetchLastError()
      ]);
      actions.setPendingEdits(edits);
      actions.setLastError(lastErr);
    } catch (err) {
      // Error handled by useAsyncState
    } finally {
      actions.setLoading(false);
    }
  };


  const handleApplyEdits = withRefresh(
    withErrorHandling(async () => {
      actions.setApplying(true);
      const selectedIds = computed.someSelected ? state.selectedEdits : undefined;
      const result = await applyEdits(selectedIds);
      
      if (result.failed.length > 0) {
        throw new Error(formatApplyErrors(result.failed));
      }
      
      actions.selectNoEdits();
      actions.setApplying(false);
      return result;
    }, (errorMsg) => executeAsync(() => Promise.reject(new Error(errorMsg)))),
    () => {
      loadData();
      onRefresh?.();
    }
  );

  const handleDeleteEdit = withRefresh(
    withErrorHandling(async (id: number) => {
      await deleteEdit(id);
      actions.removeFromSelection(id);
    }, (errorMsg) => executeAsync(() => Promise.reject(new Error(errorMsg)))),
    () => {
      loadData();
      onRefresh?.();
    }
  );

  const handleEditComment = (edit: PendingEdit) => {
    actions.startEditing(edit.id, edit.newComment);
  };

  const handleSaveEdit = withRefresh(
    withErrorHandling(async () => {
      if (!state.editingId) return;
      await updateEdit(state.editingId, state.editingComment);
      actions.stopEditing();
    }, (errorMsg) => executeAsync(() => Promise.reject(new Error(errorMsg)))),
    () => {
      loadData();
      onRefresh?.();
    }
  );

  const handleCancelEdit = () => {
    actions.stopEditing();
  };

  const handleSelectEdit = (id: number) => {
    actions.toggleEditSelection(id);
  };

  const runTests = withErrorHandling(async (testType: 'comment' | 'workflow') => {
    if (!testFilePath) {
      throw new Error('No test file path provided');
    }

    actions.setTesting(true);
    actions.clearTestResults();
    
    try {
      const results = testType === 'comment' 
        ? await runCommentTest(testFilePath)
        : await runWorkflowTest(testFilePath);
      actions.setTestResults(results);
    } finally {
      actions.setTesting(false);
    }
  }, (errorMsg) => executeAsync(() => Promise.reject(new Error(errorMsg))));

  const handleSelectAll = (selected: boolean) => {
    selected ? actions.selectAllEdits() : actions.selectNoEdits();
  };

  if (state.flags.loading) {
    return renderLoadingState();
  }

  if (error) {
    return renderErrorState(error, loadData);
  }

  if (state.pendingEdits.length === 0) {
    return renderEmptyState();
  }

  const handleClearLastError = withErrorHandling(async () => {
    await clearLastError();
    actions.setLastError(null);
  }, (errorMsg) => executeAsync(() => Promise.reject(new Error(errorMsg))));

  return (
    <div className="space-y-4">
      {state.lastError && renderLastError(state.lastError, handleClearLastError)}

      {testFilePath && renderTestPanel({
        testFilePath,
        testing: state.flags.testing,
        testResults: state.testResults,
        onRunTest: runTests,
        onClearResults: actions.clearTestResults
      })}

      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        {renderHeader({
          totalCount: computed.totalCount,
          selectedCount: computed.selectedCount,
          allSelected: computed.allSelected,
          applying: state.flags.applying,
          onSelectAll: handleSelectAll,
          onApplyEdits: handleApplyEdits
        })}
        
        <div className="space-y-3">
          {state.pendingEdits.map((edit) => 
            <div key={edit.id}>
              {renderEditItem({
                edit,
                isSelected: state.selectedEdits.includes(edit.id),
                isEditing: state.editingId === edit.id,
                editingComment: state.editingComment,
                onToggleSelect: handleSelectEdit,
                onStartEdit: handleEditComment,
                onUpdateComment: actions.updateEditingComment,
                onSaveEdit: handleSaveEdit,
                onCancelEdit: handleCancelEdit,
                onDelete: handleDeleteEdit
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
