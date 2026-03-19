import { Modal, Table, Text, Group, Kbd, Stack } from '@mantine/core';

interface ShortcutHelpModalProps {
  opened: boolean;
  onClose: () => void;
}

const MOD = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl';

const shortcuts: { key: string; description: string }[] = [
  { key: 'Space', description: 'Play / pause current track' },
  { key: `${MOD} + G`, description: 'Generate playlist' },
  { key: `${MOD} + F  or  /`, description: 'Focus library search' },
  { key: `${MOD} + S`, description: 'Save canvas state' },
  { key: `${MOD} + L`, description: 'Toggle library panel' },
  { key: `${MOD} + P`, description: 'Toggle playlist panel' },
  { key: `${MOD} + ,`, description: 'Open settings' },
  { key: 'Escape', description: 'Close drawer / deselect' },
  { key: 'Tab / Shift+Tab', description: 'Cycle focus between panels' },
  { key: '?', description: 'Show this help' },
];

const zoneShortcuts: { zone: string; keys: string; description: string }[] = [
  { zone: 'Library', keys: '↑ / ↓', description: 'Navigate song list' },
  { zone: 'Library', keys: 'Enter', description: 'Open song detail' },
  { zone: 'Canvas', keys: 'Delete / Backspace', description: 'Delete selected node or edge' },
  { zone: 'Canvas', keys: 'Escape', description: 'Deselect all' },
  { zone: 'Phase Bar', keys: '← / →', description: 'Navigate phases' },
  { zone: 'Phase Bar', keys: 'Enter', description: 'Activate phase filter' },
];

export function ShortcutHelpModal({ opened, onClose }: ShortcutHelpModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg">Keyboard Shortcuts</Text>}
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" fw={600} c="dimmed">Global</Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Tbody>
            {shortcuts.map(s => (
              <Table.Tr key={s.key}>
                <Table.Td w={180}>
                  <Group gap={4}>
                    {s.key.split(/\s\+\s|(\s{2}or\s{2})/).filter(Boolean).map((part, i) =>
                      part.trim() === 'or' ? <Text key={i} size="xs" c="dimmed">or</Text>
                        : <Kbd key={i} size="xs">{part.trim()}</Kbd>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td><Text size="sm">{s.description}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Text size="sm" fw={600} c="dimmed">Zone-Specific</Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Tbody>
            {zoneShortcuts.map((s, i) => (
              <Table.Tr key={i}>
                <Table.Td w={90}><Text size="xs" c="dimmed">{s.zone}</Text></Table.Td>
                <Table.Td w={120}><Kbd size="xs">{s.keys}</Kbd></Table.Td>
                <Table.Td><Text size="sm">{s.description}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Modal>
  );
}
