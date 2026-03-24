import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "mantine-datatable/styles.layer.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import theme from "./theme.js";
import { StatusProvider } from "../contexts/StatusContext";

export default function LayoutDefault({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <StatusProvider>
        {children}
      </StatusProvider>
    </MantineProvider>
  );
}
