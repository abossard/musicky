import { MP3MetadataManager } from '../lib/mp3-metadata';
import { addPendingEdit, getAllPendingEdits, updatePendingEditStatus } from '../database/sqlite/queries/mp3-edits';

export interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Manual test for MP3 comment writing functionality
 */
export async function testMP3CommentWriting(testFilePath: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const manager = new MP3MetadataManager();

  // Test 1: Validate MP3 file
  try {
    const isValid = MP3MetadataManager.validateMP3File(testFilePath);
    results.push({
      name: 'MP3 File Validation',
      success: isValid,
      error: isValid ? undefined : 'File validation failed'
    });
  } catch (error) {
    results.push({
      name: 'MP3 File Validation',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: Read metadata
  try {
    const metadata = await manager.readMetadata(testFilePath);
    results.push({
      name: 'Read MP3 Metadata',
      success: true,
      details: {
        title: metadata.title,
        artist: metadata.artist,
        originalComment: metadata.comment
      }
    });
  } catch (error) {
    results.push({
      name: 'Read MP3 Metadata',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Write test comment
  const testComment = `Test comment written at ${new Date().toISOString()}`;
  try {
    await manager.writeComment(testFilePath, testComment);
    results.push({
      name: 'Write Test Comment',
      success: true,
      details: { testComment }
    });
  } catch (error) {
    results.push({
      name: 'Write Test Comment',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 4: Verify comment was written
  try {
    const updatedMetadata = await manager.readMetadata(testFilePath);
    const commentMatches = updatedMetadata.comment === testComment;
    results.push({
      name: 'Verify Comment Written',
      success: commentMatches,
      details: {
        expected: testComment,
        actual: updatedMetadata.comment,
        matches: commentMatches
      },
      error: commentMatches ? undefined : 'Comment does not match expected value'
    });
  } catch (error) {
    results.push({
      name: 'Verify Comment Written',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return results;
}

/**
 * Test the full pending edit workflow
 */
export async function testPendingEditWorkflow(testFilePath: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const manager = new MP3MetadataManager();

  // Test 1: Read original metadata
  let originalComment: string | undefined;
  try {
    const metadata = await manager.readMetadata(testFilePath);
    originalComment = metadata.comment;
    results.push({
      name: 'Read Original Metadata',
      success: true,
      details: { originalComment }
    });
  } catch (error) {
    results.push({
      name: 'Read Original Metadata',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return results; // Can't continue without original metadata
  }

  // Test 2: Add pending edit
  const newComment = `Workflow test comment ${Date.now()}`;
  try {
    addPendingEdit(testFilePath, originalComment || null, newComment);
    results.push({
      name: 'Add Pending Edit',
      success: true,
      details: { newComment }
    });
  } catch (error) {
    results.push({
      name: 'Add Pending Edit',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Get pending edits
  let pendingEditId: number | undefined;
  try {
    const pendingEdits = getAllPendingEdits();
    const testEdit = pendingEdits.find(edit => 
      edit.filePath === testFilePath && edit.newComment === newComment
    );
    pendingEditId = testEdit?.id;
    results.push({
      name: 'Get Pending Edits',
      success: !!testEdit,
      details: { 
        foundEdit: !!testEdit, 
        editId: pendingEditId,
        totalPending: pendingEdits.length 
      },
      error: testEdit ? undefined : 'Test edit not found in pending list'
    });
  } catch (error) {
    results.push({
      name: 'Get Pending Edits',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 4: Apply pending edit
  if (pendingEditId) {
    try {
      await manager.writeComment(testFilePath, newComment);
      updatePendingEditStatus(pendingEditId, 'applied');
      results.push({
        name: 'Apply Pending Edit',
        success: true,
        details: { editId: pendingEditId }
      });
    } catch (error) {
      updatePendingEditStatus(pendingEditId, 'failed');
      results.push({
        name: 'Apply Pending Edit',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Test 5: Verify final state
  try {
    const finalMetadata = await manager.readMetadata(testFilePath);
    const commentApplied = finalMetadata.comment === newComment;
    results.push({
      name: 'Verify Final State',
      success: commentApplied,
      details: {
        expected: newComment,
        actual: finalMetadata.comment,
        applied: commentApplied
      },
      error: commentApplied ? undefined : 'Final comment does not match expected value'
    });
  } catch (error) {
    results.push({
      name: 'Verify Final State',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return results;
}
