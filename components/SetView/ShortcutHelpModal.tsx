import { Modal, Table, Text, Badge, Group, Stack, Divider } from '@mantine/core';

interface ShortcutHelpProps {
  opened: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ opened, onClose }: ShortcutHelpProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Keyboard Shortcuts" size="md" data-testid="shortcut-help-modal">
      <Stack gap="md">
        <Text size="sm" fw={700} c="violet">Navigation</Text>
        <Table verticalSpacing="xs">
          <Table.Tbody>
            <Row keys="↑ ↓" desc="Move between songs" />
            <Row keys="← →" desc="Move between phase columns" />
            <Row keys="Shift + ↑↓" desc="Expand selection" />
            <Row keys="Escape" desc="Deselect all" />
          </Table.Tbody>
        </Table>

        <Divider />

        <Text size="sm" fw={700} c="indigo">Phase Movement</Text>
        <Table verticalSpacing="xs">
          <Table.Tbody>
            <Row keys="Enter" desc="Lock selection (grab songs)" />
            <Row keys="← → (locked)" desc="Move songs to adjacent phase" />
            <Row keys="Enter (locked)" desc="Release lock" />
          </Table.Tbody>
        </Table>

        <Divider />

        <Text size="sm" fw={700} c="cyan">Tagging</Text>
        <Table verticalSpacing="xs">
          <Table.Tbody>
            <Row keys="1-9" desc="Toggle genre (by number)" />
            <Row keys="Shift + 1-9" desc="Toggle mood (by number)" />
          </Table.Tbody>
        </Table>

        <Divider />

        <Text size="sm" fw={700} c="green">Playback</Text>
        <Table verticalSpacing="xs">
          <Table.Tbody>
            <Row keys="Space" desc="Play / pause" />
            <Row keys="Alt + ←→" desc="Seek ±5 seconds" />
            <Row keys="Alt + ↑↓" desc="Volume up / down" />
          </Table.Tbody>
        </Table>

        <Divider />

        <Text size="sm" fw={700} c="gray">Other</Text>
        <Table verticalSpacing="xs">
          <Table.Tbody>
            <Row keys="?" desc="Show this help" />
            <Row keys="L" desc="Toggle library panel" />
          </Table.Tbody>
        </Table>
      </Stack>
    </Modal>
  );
}

function Row({ keys, desc }: { keys: string; desc: string }) {
  return (
    <Table.Tr>
      <Table.Td w={140}>
        <Group gap={4}>
          {keys.split(' ').map((k, i) => (
            k === '+' || k === '/' || k === '(locked)'
              ? <Text key={i} size="xs" c="dimmed" span>{k}</Text>
              : <Badge key={i} size="xs" variant="light" color="dark" radius="sm" style={{ fontFamily: 'monospace' }}>{k}</Badge>
          ))}
        </Group>
      </Table.Td>
      <Table.Td><Text size="xs">{desc}</Text></Table.Td>
    </Table.Tr>
  );
}
