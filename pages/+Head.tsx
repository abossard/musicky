// https://vike.dev/Head

import logoUrl from "../assets/logo.svg";

import { ColorSchemeScript } from "@mantine/core";

export default function HeadDefault() {
  return (
    <>
      <link rel="icon" href={logoUrl} />
      <ColorSchemeScript defaultColorScheme="dark" />
      <style>{`html, body { background-color: #1a1a1a; color: #c9c9c9; }`}</style>
    </>
  );
}
