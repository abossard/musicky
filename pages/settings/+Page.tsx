import { useEffect, useState } from 'react';
import { TextInput, Button, Stack, Group, Text } from '@mantine/core';
import { onGetPhases, onSetPhases } from '../../components/Settings.telefunc';

export default function SettingsPage() {
  const [phasesStr, setPhasesStr] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const phases = await onGetPhases();
      setPhasesStr(phases.join(', '));
    })();
  }, []);

  const handleSave = async () => {
    const phases = phasesStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    await onSetPhases(phases);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Settings</Text>
      <TextInput
        label="Phases (comma separated)"
        value={phasesStr}
        onChange={e => setPhasesStr(e.currentTarget.value)}
      />
      <Group>
        <Button size="xs" onClick={handleSave}>Save</Button>
        {saved && <Text c="green">Saved!</Text>}
      </Group>
    </Stack>
  );
}
