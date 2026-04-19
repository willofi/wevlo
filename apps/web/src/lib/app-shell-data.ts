import { getCurrentAuthSession } from "@/lib/auth-server";
import { listWorkspaces } from "@/lib/server-api";

export type AppShellData = {
  viewer: {
    email?: string | null;
    name: string;
  };
  workspaces: Array<{
    name: string;
    slug: string;
  }>;
};

const defaultShellData: AppShellData = {
  viewer: {
    email: null,
    name: "Workspace member"
  },
  workspaces: []
};

export const getAppShellData = async (): Promise<AppShellData> => {
  const [session, workspaces] = await Promise.all([
    getCurrentAuthSession(),
    listWorkspaces()
  ]);

  return {
    viewer: {
      email: session?.userEmail ?? null,
      name: session?.userName ?? "Unknown user"
    },
    workspaces: workspaces.map((workspace) => ({
      name: workspace.name,
      slug: workspace.slug
    }))
  };
};

export const getOptionalAppShellData = async (): Promise<AppShellData> => {
  try {
    return await getAppShellData();
  } catch {
    return defaultShellData;
  }
};
