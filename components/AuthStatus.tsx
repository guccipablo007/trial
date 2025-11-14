"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthStatus(){
  const [status, setStatus] = useState<null | { role: string; status: string }>(null);

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role,status').eq('id', user.id).maybeSingle();
      if (data) setStatus({ role: data.role as string, status: data.status as string });
    };
    run();
  }, []);

  if (!status) return null;
  if (status.status === 'active') return null;
  const color = status.status === 'pending' ? 'var(--brand-orange)' : 'var(--brand-sky)';
  return (
    <div style={{background: color, color:'#fff', padding:'8px 0'}}>
      <div className="container">
        Account status: {status.status}. Admin review required before full access.
      </div>
    </div>
  );
}

