"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Notif = { id: string; type: string; payload: any; created_at: string; read_at: string | null };

export default function NotificationsPage(){
  const [items, setItems] = useState<Notif[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,payload,created_at,read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) setMessage(error.message); else setItems(data || []);
  };

  useEffect(()=>{ load(); },[]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const channel = supabase
        .channel(`notif-live-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    })();
  }, []);

  const markRead = async (id: string) => {
    setMessage(null);
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) setMessage(error.message); else load();
  };

  return (
    <div>
      <h1>Notifications</h1>
      {message && <p>{message}</p>}
      {items.length === 0 && <div className="card">No notifications.</div>}
      {items.map(n => (
        <div key={n.id} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div><strong>{n.type}</strong> · {new Date(n.created_at).toLocaleString()}</div>
            <div style={{fontSize:12,color:'#555'}}>{JSON.stringify(n.payload)}</div>
          </div>
          <div>
            {n.read_at ? <span style={{color:'#10b981'}}>Read</span> : <button className="btn" onClick={()=>markRead(n.id)}>Mark read</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
