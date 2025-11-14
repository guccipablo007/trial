"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function NavAuth(){
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user?.id ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setReady(true);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); location.href = "/login"; };
  if (!ready) return null;
  if (!userId) return <Link href="/login">Login</Link>;
  return <button className="btn" onClick={signOut}>Sign out</button>;
}
