import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button
      type="button"
      css={{
        display: "inline-block",
        border: "1px solid black",
        borderRadius: "0.25rem",
        backgroundColor: "#e5e7eb",
        padding: "4px 8px 4px 8px",
        fontSize: "0.75rem",
        fontWeight: "500",
        textTransform: "uppercase",
        lineHeight: "1.5",
      }}
      onClick={() => setCount((count) => count + 1)}
    >
      Counter {count}
    </button>
  );
}
