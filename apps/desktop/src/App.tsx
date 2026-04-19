import { AppShell, StatusChip } from "@wevlo/ui-web";

export const App = () => (
  <AppShell title="Desktop Command Center" subtitle="Tauri shell reusing the web presentation layer.">
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 16,
        padding: 24,
        background: "rgba(15, 23, 42, 0.8)"
      }}
    >
      <h2 style={{ marginTop: 0 }}>Desktop shell ready</h2>
      <p>Native notifications, deep links, and file access can layer on top of shared issue workflows here.</p>
      <StatusChip status="todo" />
    </div>
  </AppShell>
);
