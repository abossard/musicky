import React, { useState, useEffect } from 'react';
import { 
  Select, 
  Group, 
  Button, 
  TextInput, 
  Modal, 
  Stack, 
  Textarea,
  ActionIcon,
  Text 
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { onGetDJSets, onCreateDJSet, onUpdateDJSet, onDeleteDJSet } from './DJSets.telefunc';
import type { DJSet } from '../database/sqlite/queries/dj-sets';

interface DJSetSelectorProps {
  selectedSetId: number | null;
  onSetSelect: (setId: number | null) => void;
  onSetChange?: () => void;
}

export function DJSetSelector({ selectedSetId, onSetSelect, onSetChange }: DJSetSelectorProps) {
  const [sets, setSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpened, createModalHandlers] = useDisclosure(false);
  const [editModalOpened, editModalHandlers] = useDisclosure(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [editingSet, setEditingSet] = useState<DJSet | null>(null);

  useEffect(() => {
    loadSets();
  }, []);

  const loadSets = async () => {
    try {
      setLoading(true);
      const djSets = await onGetDJSets();
      setSets(djSets);
    } catch (error) {
      console.error('Error loading DJ sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSet = async () => {
    if (!newSetName.trim()) return;
    
    try {
      const newSet = await onCreateDJSet(newSetName, newSetDescription);
      setSets(prev => [newSet, ...prev]);
      onSetSelect(newSet.id);
      setNewSetName('');
      setNewSetDescription('');
      createModalHandlers.close();
      onSetChange?.();
    } catch (error) {
      console.error('Error creating set:', error);
    }
  };

  const handleEditSet = async () => {
    if (!editingSet || !newSetName.trim()) return;
    
    try {
      await onUpdateDJSet(editingSet.id, newSetName, newSetDescription);
      setSets(prev => prev.map(set => 
        set.id === editingSet.id 
          ? { ...set, name: newSetName, description: newSetDescription }
          : set
      ));
      setEditingSet(null);
      setNewSetName('');
      setNewSetDescription('');
      editModalHandlers.close();
      onSetChange?.();
    } catch (error) {
      console.error('Error updating set:', error);
    }
  };

  const handleDeleteSet = async (setId: number) => {
    if (!confirm('Are you sure you want to delete this set? This action cannot be undone.')) {
      return;
    }
    
    try {
      await onDeleteDJSet(setId);
      setSets(prev => prev.filter(set => set.id !== setId));
      if (selectedSetId === setId) {
        onSetSelect(null);
      }
      onSetChange?.();
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const openEditModal = (set: DJSet) => {
    setEditingSet(set);
    setNewSetName(set.name);
    setNewSetDescription(set.description || '');
    editModalHandlers.open();
  };

  const selectedSet = sets.find(set => set.id === selectedSetId);

  return (
    <>
      <Group>
        <Select
          data-testid="set-selector"
          placeholder="Select a DJ set"
          value={selectedSetId?.toString() || null}
          onChange={(value) => onSetSelect(value ? parseInt(value) : null)}
          data={sets.map(set => ({ value: set.id.toString(), label: set.name }))}
          style={{ flex: 1 }}
          disabled={loading}
        />
        
        <ActionIcon 
          data-testid="create-set-button"
          variant="outline" 
          onClick={createModalHandlers.open}
          title="Create new set"
        >
          <IconPlus size={16} />
        </ActionIcon>
        
        {selectedSet && (
          <>
            <ActionIcon 
              data-testid="edit-set-button"
              variant="outline" 
              onClick={() => openEditModal(selectedSet)}
              title="Edit set"
            >
              <IconEdit size={16} />
            </ActionIcon>
            
            <ActionIcon 
              data-testid="delete-set-button"
              variant="outline" 
              color="red" 
              onClick={() => handleDeleteSet(selectedSet.id)}
              title="Delete set"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </>
        )}
      </Group>

      {selectedSet && (
        <Text size="sm" c="dimmed" mt="xs">
          {selectedSet.description || 'No description'}
        </Text>
      )}

      <Modal 
        opened={createModalOpened} 
        onClose={createModalHandlers.close}
        title="Create New DJ Set"
      >
        <Stack>
          <TextInput
            data-testid="set-name-input"
            label="Set Name"
            placeholder="Enter set name"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            required
          />
          
          <Textarea
            data-testid="set-description-input"
            label="Description"
            placeholder="Enter description (optional)"
            value={newSetDescription}
            onChange={(e) => setNewSetDescription(e.target.value)}
            rows={3}
          />
          
          <Group justify="flex-end">
            <Button variant="outline" onClick={createModalHandlers.close}>
              Cancel
            </Button>
            <Button data-testid="save-set-button" onClick={handleCreateSet} disabled={!newSetName.trim()}>
              Create Set
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal 
        opened={editModalOpened} 
        onClose={editModalHandlers.close}
        title="Edit DJ Set"
      >
        <Stack>
          <TextInput
            data-testid="edit-set-name-input"
            label="Set Name"
            placeholder="Enter set name"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            required
          />
          
          <Textarea
            data-testid="edit-set-description-input"
            label="Description"
            placeholder="Enter description (optional)"
            value={newSetDescription}
            onChange={(e) => setNewSetDescription(e.target.value)}
            rows={3}
          />
          
          <Group justify="flex-end">
            <Button variant="outline" onClick={editModalHandlers.close}>
              Cancel
            </Button>
            <Button data-testid="save-edit-button" onClick={handleEditSet} disabled={!newSetName.trim()}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}