import { 
  createDJSet, 
  getDJSets, 
  getDJSetById, 
  updateDJSet, 
  deleteDJSet 
} from '../database/sqlite/queries/dj-sets';
import type { DJSet } from '../database/sqlite/queries/dj-sets';

export async function onGetDJSets(): Promise<DJSet[]> {
  return getDJSets();
}

export async function onCreateDJSet(name: string, description?: string): Promise<DJSet> {
  if (!name || name.trim().length === 0) {
    throw new Error('Set name is required');
  }
  
  return createDJSet(name.trim(), description?.trim());
}

export async function onGetDJSet(id: number): Promise<DJSet | null> {
  if (!id || id <= 0) {
    throw new Error('Invalid set ID');
  }
  
  return getDJSetById(id);
}

export async function onUpdateDJSet(id: number, name: string, description?: string): Promise<void> {
  if (!id || id <= 0) {
    throw new Error('Invalid set ID');
  }
  
  if (!name || name.trim().length === 0) {
    throw new Error('Set name is required');
  }
  
  updateDJSet(id, name.trim(), description?.trim());
}

export async function onDeleteDJSet(id: number): Promise<void> {
  if (!id || id <= 0) {
    throw new Error('Invalid set ID');
  }
  
  deleteDJSet(id);
}