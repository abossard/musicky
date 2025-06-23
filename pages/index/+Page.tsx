import { Counter } from "./Counter.js";

export default function Page() {
  return (
    <>
      <h1 css={{ fontWeight: "700", fontSize: "1.875rem", paddingBottom: "1rem" }}>My Vike app</h1>
      This page is:
      <ul>
        <li>Rendered to HTML.</li>
        <li>
          Interactive. <Counter />
        </li>
      </ul>
    </>
  );
}
