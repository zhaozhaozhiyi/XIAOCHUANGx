"use client";

import { useCallback, useEffect, useState } from "react";
import { readAuthProfile, type AuthProfile } from "@/lib/auth";

export function useAuthProfile() {
  const [profile, setProfile] = useState<AuthProfile | null>(() =>
    typeof window === "undefined" ? null : readAuthProfile(),
  );

  const refresh = useCallback(() => {
    setProfile(readAuthProfile());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "jlc_auth_profile") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return { profile, refresh };
}
