"use client";

import { useEffect } from "react";
import { readAuthProfile, writeAuthProfile, type AuthProfile } from "@/lib/auth";
import { useAuthProfile } from "@/hooks/useAuthProfile";

/** 登录后 Cookie 存在但 localStorage 被清空时，从服务端同步展示信息 */
export function AuthHydrator() {
  const { refresh } = useAuthProfile();

  useEffect(() => {
    if (readAuthProfile()) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: AuthProfile } | null) => {
        if (data?.profile) {
          writeAuthProfile(data.profile);
          refresh();
        }
      })
      .catch(() => {});
  }, [refresh]);

  return null;
}
