"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import RichTextEditor from "@/components/RichTextEditor";
import { useProfile } from "@/components/useProfile";

type Meeting = { id: string; title: string; scheduled_at: string; location: string|null };
type Minute = { id: string; meeting_id: string; content: string; recorded_by: string|null; created_at: string };

export default function MeetingsPage(){
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const { profile } = useProfile();

  const load = async () => {
    const { data } = await supabase.from("meetings").select("id,title,scheduled_at,location").order("scheduled_at", { ascending: false});
    setMeetings(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const addMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("meetings").insert({ title, scheduled_at: scheduledAt, location });
    setTitle(""); setScheduledAt(""); setLocation(""); load();
  };

  const canWrite = profile?.role === 'system_admin' || profile?.role === 'secretary';
  return (
    <div>
      <h1>Meetings & Minutes</h1>
      {canWrite && (
        <form onSubmit={addMeeting} className="card">
          <h3>Schedule meeting (secretary/admin)</h3>
          <label>Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} />
          <label>Scheduled at</label>
          <input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)} />
          <label>Location</label>
          <input value={location} onChange={e=>setLocation(e.target.value)} />
          <button className="btn" type="submit">Schedule</button>
        </form>
      )}

      {meetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }){
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [content, setContent] = useState("");
  const { profile } = useProfile();
  const canWrite = profile?.role === 'system_admin' || profile?.role === 'secretary';

  const loadMinutes = async () => {
    const { data } = await supabase.from("minutes").select("id,meeting_id,content,recorded_by,created_at").eq("meeting_id", meeting.id).order("created_at", { ascending: false});
    setMinutes(data || []);
  };
  useEffect(()=>{ loadMinutes(); },[meeting.id]);

  const addMinute = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("minutes").insert({ meeting_id: meeting.id, content });
    setContent(""); loadMinutes();
  };

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between'}}>
        <strong>{meeting.title}</strong>
        <span>{new Date(meeting.scheduled_at).toLocaleString()} {meeting.location? `· ${meeting.location}`: ''}</span>
      </div>
      {canWrite && (
        <form onSubmit={addMinute} style={{marginTop:8}}>
          <h4>Add minutes (rich text) (secretary/admin)</h4>
          <RichTextEditor value={content} onChange={setContent} />
          <button className="btn" type="submit">Save minutes</button>
        </form>
      )}
      <div style={{marginTop:8}}>
        <strong>Previous minutes</strong>
        {minutes.map(mi => (
          <div key={mi.id} style={{borderTop:'1px solid #eee',padding:'6px 0'}}>
            <div style={{fontSize:12,color:'#555'}}>{new Date(mi.created_at).toLocaleString()}</div>
            <div dangerouslySetInnerHTML={{ __html: mi.content }} />
          </div>
        ))}
      </div>
    </div>
  );
}
