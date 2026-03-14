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
  
  // Get current items to adjust positions
  const currentItems = getSetItems(setId);
  
  // Shift positions of items after insertion point
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
  
  // Get current items to find the removed item's position
  const currentItems = getSetItems(setId);
  const removedItem = currentItems.find(item => item.id === itemId);
  
  if (!removedItem) {
    throw new Error('Item not found');
  }
  
  // Remove the item
  removeSongFromSet(itemId);
  
  // Adjust positions of items after the removed item
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
  
  // Create position updates based on new order
  const itemsToUpdate = itemIds.map((id, index) => ({
    id,
    position: index
  }));
  
  reorderSetItems(itemsToUpdate);
}

export async function onBulkAddSongsToSet(setId: number, filePaths: string[], insertAfterPosition: number): Promise<void> {
  if (!setId || setId <= 0) {
    throw new Error('Invalid set ID');
  }
  
  if (!filePaths || filePaths.length === 0) {
    throw new Error('File paths are required');
  }
  
  if (insertAfterPosition < -1) {
    throw new Error('Invalid insertion position');
  }
  
  // Get current items to calculate positions
  const currentItems = getSetItems(setId);
  const startPosition = insertAfterPosition + 1;
  
  // Shift existing items to make room
  const itemsToUpdate = currentItems
    .filter(item => item.position >= startPosition)
    .map(item => ({ id: item.id, position: item.position + filePaths.length }));
  
  if (itemsToUpdate.length > 0) {
    reorderSetItems(itemsToUpdate);
  }
  
  // Add new items
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    if (filePath && filePath.trim().length > 0) {
      addSongToSet(setId, filePath.trim(), startPosition + i);
    }
  }
}