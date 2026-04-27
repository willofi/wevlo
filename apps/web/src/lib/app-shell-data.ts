import { getMe, listWorkspaces } from "@/lib/server-api";

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
  const [me, workspaces] = await Promise.all([
    getMe(),
    listWorkspaces()
  ]);

  return {
    viewer: {
      email: me.user.email,
      name: me.user.name
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
