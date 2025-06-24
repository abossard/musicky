import "@mantine/core/styles.css";
import { 
  AppShell, 
  Burger,
  Group, 
  Image, 
  MantineProvider, 
  Text, 
  ScrollArea, 
  Stack,
  Badge,
  Flex
} from "@mantine/core";
import { useState, useEffect } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import theme from "./theme.js";

import logoUrl from "../assets/logo.svg";
import { Link } from "../components/Link";
import { StatusProvider, useStatus } from "../contexts/StatusContext";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [opened, { toggle, close }] = useDisclosure();
  const { status, statusColor, setIsMenuOpen } = useStatus();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Initialize time and update every second, but only on client side
  useEffect(() => {
    // Set initial time
    setCurrentTime(new Date());
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sync menu state with context
  useEffect(() => {
    setIsMenuOpen(opened);
  }, [opened, setIsMenuOpen]);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Handler to close menu on mobile when navigation link is clicked
  const handleNavLinkClick = () => {
    if (isMobile && opened) {
      close();
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ 
        width: 280, 
        breakpoint: "sm", 
        collapsed: { mobile: !opened, desktop: false } 
      }}
      footer={{ height: 40 }}
      padding="md"
    >
      {/* Top Title Bar with Date and Time */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger 
              opened={opened} 
              onClick={toggle} 
              hiddenFrom="sm" 
              size="sm" 
              aria-label="Toggle navigation"
            />
            <a href="/" aria-label="Go to home page">
              <Image h={40} fit="contain" src={logoUrl} />
            </a>
            <Text size="lg" fw={600}>Musicky</Text>
          </Group>
          <Text size="sm" c="dimmed">
            {currentTime ? formatDateTime(currentTime) : 'Loading...'}
          </Text>
        </Group>
      </AppShell.Header>

      {/* Responsive Left Sidebar */}
      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Text size="sm" fw={600} c="dimmed" mb="xs">
            Navigation
          </Text>
          <Link href="/" label="Welcome" onClick={handleNavLinkClick} />
          <Link href="/todo" label="Todo" onClick={handleNavLinkClick} />
          <Link href="/star-wars" label="Data Fetching" onClick={handleNavLinkClick} />
          <Link href="/file-browser" label="File Browser" onClick={handleNavLinkClick} />
          <Link href="/mp3-demo" label="MP3 Tags Demo" onClick={handleNavLinkClick} />
          <Link href="/mp3-library" label="MP3 Library" onClick={handleNavLinkClick} />
          <Link href="/review-changes" label="Review changes" onClick={handleNavLinkClick} />
        </Stack>
      </AppShell.Navbar>

      {/* Scrollable Main Content */}
      <AppShell.Main>
        <ScrollArea h="calc(100vh - 140px)" type="auto">
          {children}
        </ScrollArea>
      </AppShell.Main>

      {/* Bottom Status Bar */}
      <AppShell.Footer>
        <Flex h="100%" px="md" align="center" justify="space-between">
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
      <StatusProvider>
        <LayoutContent>{children}</LayoutContent>
      </StatusProvider>
    </MantineProvider>
  );
}
