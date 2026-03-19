import { useEffect } from "react";
import { Stack, Text, Anchor } from "@mantine/core";

export default function Page() {
  useEffect(() => {
    // Client-side redirect to moodboard
    window.location.href = "/moodboard";
  }, []);

  return (
    <Stack gap="md" align="center" justify="center" style={{ height: '100%' }}>
      <Text size="xl" fw={700}>Redirecting to Moodboard…</Text>
      <Anchor href="/moodboard" c="violet">
        Click here if not redirected automatically
      </Anchor>
    </Stack>
  );
}
