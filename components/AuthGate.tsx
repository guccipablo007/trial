"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export default function AuthGate(){
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname || "/")) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session?.user) router.replace("/login");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (PUBLIC_PATHS.has(pathname || "/")) return;
      if (!session?.user) router.replace("/login");
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [pathname, router]);

  return null;
}
