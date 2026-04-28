"use client";

import { AccountMenu } from "@/components/account-menu";

type UserMenuProps = {
  avatarUrl?: string | null | undefined;
  email?: string | null | undefined;
  name: string;
};

export function UserMenu({ avatarUrl, email, name }: UserMenuProps) {
  return <AccountMenu avatarUrl={avatarUrl} email={email} name={name} trigger="avatar" />;
}
