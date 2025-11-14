"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/components/useProfile";

type Profile = { id: string; full_name: string|null; email?: string; phone: string|null; address: string|null; role: string; status: string };

export default function MembersPage(){
  const [members, setMembers] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string|null>(null);
  const { profile } = useProfile();

  const load = async () => {
    const { data } = await supabase.from("profiles").select("id,full_name,phone,address,role,status").order("full_name");
    setMembers(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const setStatus = async (id: string, status: 'active'|'disabled'|'pending') => {
    setMessage(null);
    const { error } = await supabase.rpc('admin_set_user_status', { target: id, new_status: status });
    setMessage(error ? error.message : `Status set to ${status}`);
    load();
  };

  const isAdmin = profile?.role === 'system_admin';
  return (
    <div>
      <h1>Members</h1>
      {isAdmin && <div className="card">Admin can activate/disable members here.</div>}
      {message && <p>{message}</p>}
      {members.map(m => (
        <div key={m.id} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <strong>{m.full_name || 'Unnamed'}</strong>
            <div style={{fontSize:12,color:'#555'}}>{m.role} · {m.status}</div>
            <div style={{fontSize:12,color:'#555'}}>{m.phone} · {m.address}</div>
          </div>
          {isAdmin && (
            <div style={{display:'flex',gap:6}}>
              <button className="btn" onClick={()=>setStatus(m.id,'active')}>Activate</button>
              <button className="btn secondary" onClick={()=>setStatus(m.id,'disabled')}>Disable</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
