"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/components/useProfile";
import { formatCurrency } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

type Project = { id: string; title: string; description: string|null; status: string; budget: number|null; start_date: string|null };
type Disb = { id: string; amount: number; date: string; reason: string|null };

export default function ProjectsPage(){
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<'ongoing'|'completed'>("ongoing");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ongoing");
  const [budget, setBudget] = useState<number|''>('');
  const [startDate, setStartDate] = useState<string>("");
  const { profile } = useProfile();
  const [sumContrib, setSumContrib] = useState<Record<string, number>>({});
  const [sumDisb, setSumDisb] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setMessage(null);
    const [{ data: p, error: pe }, { data: c, error: ce }, { data: d, error: de }] = await Promise.all([
      supabase.from("projects").select("id,title,description,status,budget,start_date").order("title"),
      supabase.from("project_contributions").select("project_id,amount"),
      supabase.from("project_disbursements").select("project_id,amount")
    ]);
    if (pe || ce || de) setMessage((pe||ce||de)?.message || 'Failed to load projects');
    setProjects(p || []);
    const csum: Record<string, number> = {}; (c||[]).forEach((x:any)=>{ csum[x.project_id] = (csum[x.project_id]||0) + Number(x.amount||0); });
    const dsum: Record<string, number> = {}; (d||[]).forEach((x:any)=>{ dsum[x.project_id] = (dsum[x.project_id]||0) + Number(x.amount||0); });
    setSumContrib(csum); setSumDisb(dsum);
  };
  useEffect(()=>{ load(); },[]);
  useEffect(()=>{
    const ch = supabase.channel('projects-list-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'project_contributions'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'project_disbursements'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'projects'},load)
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[]);

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("projects").insert({ title, description, status, budget: budget===''? null : budget, start_date: startDate || null });
    if (error) { setMessage(error.message); return; }
    setTitle(""); setDescription(""); setStatus("ongoing"); setBudget(''); setStartDate("");
    setSearch(""); setTab('ongoing');
    setMessage("Project created successfully.");
    await load();
  };

  const canWrite = profile?.role === 'system_admin' || profile?.role === 'secretary';
  const filtered = useMemo(()=>{
    const byTab = projects.filter(p => tab==='completed' ? p.status==='completed' : p.status!=='completed');
    if (!search) return byTab;
    return byTab.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  },[projects,search,tab]);

  return (
    <div>
      <PageHeader title="Community Projects" onSearch={setSearch}>
        {canWrite && <button className="btn" onClick={(e)=>{ const el=document.getElementById('new-project'); if (el) el.scrollIntoView({behavior:'smooth'})}}>+ Add New Project</button>}
      </PageHeader>

      <div style={{marginTop:8}} />

      <div className="tabs">
        <div className={`tab ${tab==='ongoing'?'active':''}`} onClick={()=>setTab('ongoing')}>Ongoing Projects</div>
        <div className={`tab ${tab==='completed'?'active':''}`} onClick={()=>setTab('completed')}>Completed Projects</div>
      </div>

      {message && <div className="card" style={{color:'#b91c1c'}}>{message}</div>}
      <div className="card" style={{marginTop:16}}>
        <div className="row" style={{fontWeight:600,color:'#6b7280'}}>
          <div className="col">Project Name</div>
          <div className="col">Total Cost</div>
          <div className="col">Total Collected</div>
          <div className="col">Amount Disbursed</div>
          <div className="col">Status</div>
          <div className="col">Actions</div>
        </div>
        {filtered.length === 0 && (
          <div className="muted" style={{padding:'10px 0'}}>No projects to show.</div>
        )}
        {filtered.map(p => (
          <ProjectRow key={p.id} project={p} canWrite={canWrite}
            collected={sumContrib[p.id]||0} disbursed={sumDisb[p.id]||0} onChanged={load} />
        ))}
      </div>

      {canWrite && (
        <form id="new-project" onSubmit={addProject} className="card" style={{marginTop:16}}>
          <h3>New project (secretary/admin)</h3>
          <label>Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} />
          <label>Description</label>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} />
          <label>Status</label>
          <select value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="ongoing">Ongoing</option>
            <option value="suspended">Suspended</option>
            <option value="completed">Completed</option>
          </select>
          <label>Start date</label>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
          <label>Budget</label>
          <input type="number" step="0.01" value={budget} onChange={e=>setBudget(e.target.value===''? '' : Number(e.target.value))} />
          <button className="btn" type="submit">Create</button>
        </form>
      )}
    </div>
  );
}

function ProjectRow({ project, canWrite, collected, disbursed, onChanged }: { project: Project; canWrite: boolean; collected: number; disbursed: number; onChanged: ()=>void }){
  const [disb, setDisb] = useState<Disb[]>([]);
  const [amount, setAmount] = useState<number|''>('');
  const [date, setDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const formId = `disb-form-${project.id}`;

  const loadDisb = async () => {
    const { data } = await supabase.from("project_disbursements").select("id,amount,date,reason").eq("project_id", project.id).order("date", { ascending: false});
    setDisb(data || []);
  };
  useEffect(()=>{ loadDisb(); },[project.id]);
  useEffect(()=>{ const channel = supabase
      .channel(`project-live-${project.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_disbursements', filter: `project_id=eq.${project.id}` }, ()=>{loadDisb(); onChanged();})
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [project.id]);

  const addDisb = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("project_disbursements").insert({ project_id: project.id, amount: amount===''? null : amount, date, reason });
    setAmount(''); setDate(""); setReason(""); loadDisb(); onChanged();
  };

  const statusBadge = project.status==='completed' ? 'status completed' : project.status==='suspended' ? 'status suspended' : 'status inprogress';
  const progressPct = project.budget ? Math.min(100, Math.round(((collected||0)/Number(project.budget))*100)) : 0;

  return (
    <div style={{borderTop:'1px solid #eee',padding:'12px 0'}}>
      <div className="row" style={{alignItems:'center'}}>
        <div className="col"><div style={{fontWeight:600}}>{project.title}</div><div className="muted" style={{fontSize:12}}>{project.description||''}</div></div>
        <div className="col">{project.budget!=null ? formatCurrency(project.budget) : '—'}</div>
        <div className="col">
          <div className="progress"><span style={{width:`${progressPct}%`}}/></div>
          <div>{formatCurrency(collected||0)}</div>
        </div>
        <div className="col">{formatCurrency(disbursed||0)}</div>
        <div className="col"><span className={statusBadge}>{project.status==='ongoing'?'In Progress':project.status==='suspended'?'On Hold':'Completed'}</span></div>
        <div className="col" style={{display:'flex',gap:8}}>
          <button className="btn link" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide':'Details'}</button>
          {canWrite && <button className="btn secondary" onClick={()=>{ setExpanded(true); const el=document.getElementById(formId); if(el){ el.scrollIntoView({behavior:'smooth'});} }}>Add Disbursement</button>}
        </div>
      </div>

      {expanded && (
        <div className="card" style={{marginTop:8}}>
          <div style={{fontWeight:600,marginBottom:8}}>Disbursement Details</div>
          {disb.length===0 && <div className="muted">No disbursements yet.</div>}
          {disb.map(d => (
            <div key={d.id} style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #eee',padding:'6px 0'}}>
              <span>{d.date} – {d.reason}</span>
              <span>{formatCurrency(d.amount)}</span>
            </div>
          ))}

          {canWrite && (
            <form id={formId} onSubmit={addDisb} style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 2fr auto',gap:8,alignItems:'end'}}>
              <div>
                <label>Amount</label>
                <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value===''? '' : Number(e.target.value))} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
              </div>
              <div>
                <label>Reason</label>
                <input value={reason} onChange={e=>setReason(e.target.value)} />
              </div>
              <button className="btn" type="submit">Add</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
