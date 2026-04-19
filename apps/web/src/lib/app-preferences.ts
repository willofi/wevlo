import { cookies } from "next/headers";

export * from "@/lib/app-preferences-shared";

import { parseAppPreferences } from "@/lib/app-preferences-shared";

export const getServerAppPreferences = async () => {
  const cookieStore = await cookies();
  return parseAppPreferences(cookieStore.get("wevlo_preferences")?.value);
};
