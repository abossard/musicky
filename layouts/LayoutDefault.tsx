import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "mantine-datatable/styles.layer.css";
import { 
  AppShell, 
  Burger,
  Group, 
  Image, 
  MantineProvider, 
  Text, 
  Stack,
  Badge,
  Flex
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import theme from "./theme.js";

import logoUrl from "../assets/logo.svg";
import { Link } from "../components/Link";
import { StatusProvider, useStatus } from "../contexts/StatusContext";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { status, statusColor, setIsMenuOpen } = useStatus();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Sync menu state with context
  useEffect(() => {
    setIsMenuOpen(opened);
  }, [opened, setIsMenuOpen]);

  // Handler to close menu on mobile when navigation link is clicked
  const handleNavLinkClick = () => {
    if (isMobile && opened) {
      close();
    }
  };

  return (
    <AppShell
      header={{ height: 44 }}
      navbar={{ 
        width: 280, 
        breakpoint: "sm", 
        collapsed: { mobile: !opened, desktop: false } 
      }}
      footer={{ height: 32 }}
      padding="xs"
    >
      <AppShell.Header>
        <Group h="100%" px="sm" justify="space-between">
          <Group>
            <Burger 
              opened={opened} 
              onClick={toggle} 
              hiddenFrom="sm" 
              size="sm" 
              aria-label="Toggle navigation"
            />
            <a href="/" aria-label="Go to home page">
              <Image h={28} fit="contain" src={logoUrl} />
            </a>
            <Text size="sm" fw={600}>Musicky</Text>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Responsive Left Sidebar */}
      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Text size="sm" fw={600} c="dimmed" mb="xs">
            Navigation
          </Text>
          <Link href="/moodboard" label="Moodboard" onClick={handleNavLinkClick} />
          <Link href="/settings" label="Settings" onClick={handleNavLinkClick} />
        </Stack>
      </AppShell.Navbar>

      {/* Scrollable Main Content */}
      <AppShell.Main style={{ height: 'calc(100vh - 44px - 32px)', overflow: 'auto' }}>
        {children}
      </AppShell.Main>

      {/* Bottom Status Bar */}
      <AppShell.Footer>
        <Flex h="100%" px="sm" align="center" justify="space-between">
          <Group gap="sm">
            <Badge variant="dot" color={statusColor} size="sm">
              {status}
            </Badge>
            <Text size="xs" c="dimmed">
              Application running smoothly
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            v1.0.0
          </Text>
        </Flex>
      </AppShell.Footer>
    </AppShell>
  );
}

export default function LayoutDefault({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <StatusProvider>
        <LayoutContent>{children}</LayoutContent>
      </StatusProvider>
    </MantineProvider>
  );
}
