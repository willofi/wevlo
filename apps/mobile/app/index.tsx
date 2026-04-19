import { Text, View } from "react-native";

import { StatusPill } from "@wevlo/ui-native";

export default function IndexScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020617",
        padding: 24,
        justifyContent: "center",
        gap: 16
      }}
    >
      <Text style={{ color: "#f8fafc", fontSize: 28, fontWeight: "700" }}>My Issues</Text>
      <Text style={{ color: "#94a3b8", fontSize: 16 }}>
        Mobile starts with the high-frequency execution flow: assignments, status changes, and comments.
      </Text>
      <StatusPill status="in_progress" />
    </View>
  );
}
