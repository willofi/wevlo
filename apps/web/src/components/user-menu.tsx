"use client";

import { AccountMenu } from "@/components/account-menu";

type UserMenuProps = {
  email?: string | null | undefined;
  name: string;
};

export function UserMenu({ email, name }: UserMenuProps) {
  return <AccountMenu email={email} name={name} trigger="avatar" />;
}
