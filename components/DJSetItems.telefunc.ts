import { 
  addSongToSet, 
  getSetItems, 
  removeSongFromSet, 
  reorderSetItems 
} from '../database/sqlite/queries/dj-sets';
import type { DJSetItem } from '../database/sqlite/queries/dj-sets';

export async function onGetSetItems(setId: number): Promise<DJSetItem[]> {
  if (!setId || setId <= 0) {
    throw new Error('Invalid set ID');
  }
  
  return getSetItems(setId);
}

export async function onAddSongToSet(setId: number, filePath: string, position: number): Promise<void> {
  if (!setId || setId <= 0) {
    throw new Error('Invalid set ID');
  }
  
  if (!filePath || filePath.trim().length === 0) {
    throw new Error('File path is required');
  }
  
  if (position < 0) {
    throw new Error('Position must be non-negative');
  }
  
  const currentItems = getSetItems(setId);
  
  const itemsToUpdate = currentItems
    .filter(item => item.position >= position)
    .map(item => ({ id: item.id, position: item.position + 1 }));
  
  if (itemsToUpdate.length > 0) {
    reorderSetItems(itemsToUpdate);
  }
  
  addSongToSet(setId, filePath.trim(), position);
}

export async function onRemoveSongFromSet(setId: number, itemId: number): Promise<void> {
  if (!setId || setId <= 0) {
    throw new Error('Invalid set ID');
  }
  
  if (!itemId || itemId <= 0) {
    throw new Error('Invalid item ID');
  }
  
  const currentItems = getSetItems(setId);
  const removedItem = currentItems.find(item => item.id === itemId);
  
  if (!removedItem) {
    throw new Error('Item not found');
  }
  
  removeSongFromSet(itemId);
  
  const itemsToUpdate = currentItems
    .filter(item => item.position > removedItem.position)
    .map(item => ({ id: item.id, position: item.position - 1 }));
  
  if (itemsToUpdate.length > 0) {
    reorderSetItems(itemsToUpdate);
  }
}

export async function onReorderSetItems(setId: number, itemIds: number[]): Promise<void> {
  if (!setId || setId <= 0) {
    throw new Error('Invalid set ID');
  }
  
  if (!itemIds || itemIds.length === 0) {
    throw new Error('Item IDs are required');
  }
  
  const itemsToUpdate = itemIds.map((id, index) => ({
    id,
    position: index
  }));
  
  reorderSetItems(itemsToUpdate);
}
