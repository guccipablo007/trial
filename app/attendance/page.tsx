"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/components/useProfile";
import PageHeader from "@/components/PageHeader";

type Member = { id: string; full_name: string|null };
type AttRow = { member_id: string; day: string; status: 'present'|'absent'|'on_leave'; meeting_id?: string|null };
type Meeting = { id: string; title: string; scheduled_at: string };

export default function AttendancePage(){
  const { profile } = useProfile();
  const canWrite = profile?.role === 'system_admin' || profile?.role === 'secretary';

  const [members, setMembers] = useState<Member[]>([]);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [search, setSearch] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingId, setMeetingId] = useState<string>("");
  const [rows, setRows] = useState<Record<string,'present'|'absent'|'on_leave'>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [historyRows, setHistoryRows] = useState<{ day: string; status: 'present'|'absent'|'on_leave' }[]>([]);

  const load = async () => {
    setMsg(null);
    const filters = meetingId ? { meeting_id: meetingId } : { day: date } as any;
    const [{ data: m }, { data: a }, { data: mtg }] = await Promise.all([
      supabase.from('profiles').select('id,full_name').order('full_name'),
      supabase.from('attendance').select('member_id, day, status, meeting_id').match(filters),
      supabase.from('meetings').select('id,title,scheduled_at').order('scheduled_at', { ascending: false })
    ]);
    setMembers(m || []);
    setMeetings(mtg || []);
    const preset: Record<string,'present'|'absent'|'on_leave'> = {};
    (a || []).forEach((r: any) => { preset[r.member_id] = r.status; });
    setRows(preset);
  };
  useEffect(()=>{ load(); },[date, meetingId]);

  const filtered = useMemo(()=> members.filter(m => (m.full_name||'').toLowerCase().includes(search.toLowerCase())), [members, search]);

  const setStatus = (id: string, status: 'present'|'absent'|'on_leave') => {
    setRows(prev => ({ ...prev, [id]: status }));
  };

  const counts = useMemo(()=>{
    let p=0,a=0,l=0; filtered.forEach(m=>{ const s = rows[m.id]; if (s==='present') p++; else if (s==='absent') a++; else if (s==='on_leave') l++; });
    return { p,a,l };
  },[filtered, rows]);

  const save = async () => {
    if (!canWrite) return;
    setMsg(null);
    const payload: AttRow[] = Object.entries(rows).map(([member_id, status]) => ({ member_id, day: date, status, meeting_id: meetingId || null } as AttRow));
    if (payload.length === 0) { setMsg('Nothing to save.'); return; }
    const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'member_id,day' });
    setMsg(error ? error.message : 'Attendance saved.');
  };

  const openHistory = async (m: Member) => {
    setHistoryMember(m);
    setHistoryOpen(true);
    const { data, error } = await supabase
      .from('attendance')
      .select('day,status')
      .eq('member_id', m.id)
      .order('day', { ascending: false });
    setHistoryRows((data as any) || []);
    if (error) setMsg(error.message);
  };

  const exportHistory = () => {
    if (!historyMember) return;
    const head = 'Date,Status\n';
    const body = historyRows.map(r => `${r.day},${r.status}`).join('\n');
    const blob = new Blob([head+body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${historyMember.full_name||historyMember.id}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const head = 'Member,Status\n';
    const body = filtered.map(m => `${JSON.stringify(m.full_name||'')},${rows[m.id]||''}`).join('\n');
    const blob = new Blob([head+body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const mt = meetings.find(x=>x.id===meetingId)?.title;
    const filename = meetingId && mt ? `attendance_${mt.replace(/\s+/g,'_')}.csv` : `attendance_${date}.csv`;
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Member Attendance">
        {canWrite && <button className="btn primary" onClick={save}>Save Attendance</button>}
      </PageHeader>

      {msg && <div className="card" style={{color: msg.includes('saved') ? 'var(--brand-green)' : '#b91c1c'}}>{msg}</div>}

      <div className="card" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} title="Date (used when no meeting is selected)" />
        <select value={meetingId} onChange={e=>setMeetingId(e.target.value)} title="Select meeting to capture attendance by meeting">
          <option value="">No meeting (by date)</option>
          {meetings.map(m => (
            <option key={m.id} value={m.id}>{m.title} · {new Date(m.scheduled_at).toLocaleString()}</option>
          ))}
        </select>
        <input className="search" placeholder="Search member..." value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn" onClick={exportCsv}>Export</button>
      </div>

      <div className="grid-2" style={{marginTop:8}}>
        <div className="metric"><div className="muted">Total Present</div><div style={{fontSize:24,fontWeight:700}}>{counts.p}</div></div>
        <div className="metric"><div className="muted">Total Absent</div><div style={{fontSize:24,fontWeight:700}}>{counts.a}</div></div>
        <div className="metric"><div className="muted">On Leave</div><div style={{fontSize:24,fontWeight:700}}>{counts.l}</div></div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="row" style={{fontWeight:600,color:'#6b7280'}}>
          <div className="col">Member name</div>
          <div className="col">Status</div>
        </div>
        {filtered.map(m => (
          <div key={m.id} className="row" style={{alignItems:'center',borderTop:'1px solid var(--border)',padding:'10px 0'}}>
            <div className="col">
              <button type="button" onClick={()=>openHistory(m)} style={{fontWeight:600,background:'transparent',border:'none',cursor:'pointer',padding:0}} title="View history">
                {m.full_name || 'Unnamed'}
              </button>
            </div>
            <div className="col" style={{display:'flex',gap:8}}>
              <button type="button" className={`chip ${rows[m.id]==='present'?'active':''}`} onClick={()=>setStatus(m.id,'present')}>Present</button>
              <button type="button" className={`chip absent ${rows[m.id]==='absent'?'active':''}`} onClick={()=>setStatus(m.id,'absent')}>Absent</button>
              <button type="button" className={`chip leave ${rows[m.id]==='on_leave'?'active':''}`} onClick={()=>setStatus(m.id,'on_leave')}>On Leave</button>
            </div>
          </div>
        ))}
      </div>

      {historyOpen && historyMember && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.2)'}} onClick={()=>setHistoryOpen(false)}>
          <div className="card" style={{position:'absolute',right:20,top:20,width:420,maxHeight:'80vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
            <div className="align-between" style={{marginBottom:8}}>
              <div>
                <div className="h4">Attendance History</div>
                <div className="muted" style={{fontSize:12}}>{historyMember.full_name || historyMember.id}</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn secondary" onClick={exportHistory}>Export</button>
                <button className="btn" onClick={()=>setHistoryOpen(false)}>Close</button>
              </div>
            </div>
            {historyRows.length === 0 && <div className="muted">No records yet.</div>}
            {historyRows.map((r,i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',padding:'6px 0'}}>
                <span>{r.day}</span>
                <span style={{textTransform:'capitalize'}}>{r.status.replace('_',' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
