"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
// Role-based gating removed here; RLS will protect operations

type Announcement = { id: string; title: string; content: string; created_at: string };

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string|null>(null);

  const load = async () => {
    const { data } = await supabase.from("announcements").select("id,title,content,created_at").order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const channel = supabase
      .channel('announcements-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.from("announcements").insert({ title, content });
    if (error) setMessage(error.message); else { setTitle(""); setContent(""); load(); }
  };

  return (
    <div>
      <h1>Announcements</h1>
      <form onSubmit={add} className="card">
        <h3>Post announcement</h3>
        <label>Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} />
        <label>Content</label>
        <textarea value={content} onChange={e=>setContent(e.target.value)} rows={4}/>
        <button className="btn" type="submit">Publish</button>
        {message && <p>{message}</p>}
      </form>
      {items.length === 0 && (
        <div className="card">No announcements yet.</div>
      )}
      {items.map(a => (
        <div key={a.id} className="card">
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <strong>{a.title}</strong>
            <span>{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <div>{a.content}</div>
        </div>
      ))}
    </div>
  );
}
