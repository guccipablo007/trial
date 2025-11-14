"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type ProfileInfo = { role: 'system_admin'|'secretary'|'member'; status: 'pending'|'active'|'disabled' };

export function useProfile(){
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) { if (!cancelled) { setProfile(null); setLoading(false); } return; }
      const { data: p } = await supabase.from('profiles').select('role,status').eq('id', user.id).maybeSingle();
      if (!cancelled) { setProfile(p as ProfileInfo); setLoading(false); }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { profile, loading } as const;
}
