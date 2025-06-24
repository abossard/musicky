// Test script to create a pending edit for testing the MP3 Library functionality
import { addPendingEdit } from './database/sqlite/queries/mp3-edits.js';

// Create a test pending edit
const testFilePath = '/Users/abossard/Desktop/projects/musicky/lifekiller.mp3';
const originalComment = null;
const newComment = 'Test comment for library demo';

console.log('Creating test pending edit...');
addPendingEdit(testFilePath, originalComment, newComment);
console.log('Test pending edit created successfully!');
console.log(`File: ${testFilePath}`);
console.log(`Original comment: ${originalComment}`);
console.log(`New comment: ${newComment}`);
