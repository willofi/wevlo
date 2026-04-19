import { Text, View } from "react-native";

import { getStatusToneLabel } from "@wevlo/ui-core";

export const StatusPill = ({ status }: { status: Parameters<typeof getStatusToneLabel>[0] }) => (
  <View
    style={{
      backgroundColor: "#0f766e",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: "flex-start"
    }}
  >
    <Text style={{ color: "#ffffff", fontWeight: "600" }}>{getStatusToneLabel(status)}</Text>
  </View>
);
