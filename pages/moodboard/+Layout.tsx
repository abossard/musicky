import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider, Box } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import theme from "../../layouts/theme.js";

export default function LayoutMoodboard({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </Box>
    </MantineProvider>
  );
}
