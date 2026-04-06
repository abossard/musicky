import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "mantine-datatable/styles.layer.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect } from "react";
import theme from "./theme.js";
import { StatusProvider } from "../contexts/StatusContext";

export default function LayoutDefault({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Detect Tauri desktop environment and apply titlebar class
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      document.documentElement.classList.add('tauri-app');
    }
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <StatusProvider>
        {children}
      </StatusProvider>
    </MantineProvider>
  );
}
