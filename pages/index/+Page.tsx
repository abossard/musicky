import { Counter } from "./Counter.js";
import { useStatus } from "../../contexts/StatusContext";
import { Button, Group, Stack, Text } from "@mantine/core";
import { ResponsiveIndicator } from "../../components/ResponsiveIndicator";

export default function Page() {
  const { setStatus, isMenuOpen } = useStatus();

  const handleStatusChange = (status: string, color: string) => {
    setStatus(status, color);
  };

  return (
    <Stack gap="md">
      <Text size="xl" fw={700}>Welcome to Musicky</Text>
      
      <ResponsiveIndicator isMenuOpen={isMenuOpen} />
      
      <Text>
        This page demonstrates the new layout features:
      </Text>
      
      <ul>
        <li>Dark theme is enabled</li>
        <li>Current date and time in the top bar (updates every second)</li>
        <li>Responsive navigation sidebar (collapses on mobile, always visible on desktop)</li>
        <li>Hamburger menu button on mobile devices</li>
        <li>Scrollable content area</li>
        <li>Status bar at the bottom</li>
      </ul>

      <Stack gap="sm">
        <Text fw={600}>Responsive Testing:</Text>
        <Text size="sm" c="dimmed">
          Resize your browser window to test the mobile navigation behavior:
        </Text>
        <Stack gap="xs" ml="md">
          <Text size="sm" c="dimmed">
            <strong>Desktop (≥768px):</strong> Navigation always visible
          </Text>
          <Text size="sm" c="dimmed">
            <strong>Mobile (&lt;768px):</strong> Navigation collapsed, hamburger menu appears
          </Text>
          <Text size="sm" c="dimmed">
            <strong>Auto-close:</strong> On mobile, menu automatically closes when you click a navigation link
          </Text>
        </Stack>
      </Stack>

      <Stack gap="sm">
        <Text fw={600}>Status Bar Demo:</Text>
        <Group>
          <Button 
            size="xs" 
            color="green" 
            onClick={() => handleStatusChange("Ready", "green")}
          >
            Set Ready
          </Button>
          <Button 
            size="xs" 
            color="blue" 
            onClick={() => handleStatusChange("Processing", "blue")}
          >
            Set Processing
          </Button>
          <Button 
            size="xs" 
            color="orange" 
            onClick={() => handleStatusChange("Warning", "orange")}
          >
            Set Warning
          </Button>
          <Button 
            size="xs" 
            color="red" 
            onClick={() => handleStatusChange("Error", "red")}
          >
            Set Error
          </Button>
        </Group>
      </Stack>

      <div>
        <Text fw={600} mb="sm">Interactive Counter:</Text>
        <Counter />
      </div>

      {/* Add some content to demonstrate scrolling */}
      <Stack gap="md" mt="xl">
        <Text fw={600}>Scrolling Demo Content:</Text>
        {Array.from({ length: 20 }, (_, i) => (
          <Text key={i}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis 
            nostrud exercitation ullamco laboris. Line {i + 1}
          </Text>
        ))}
      </Stack>
    </Stack>
  );
}
