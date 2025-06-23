import { createTodosTable } from './todos.js';
import { createMp3EditsTable } from './mp3-edits.js';

export const initializeSchema = [
  createTodosTable,
  createMp3EditsTable
];
