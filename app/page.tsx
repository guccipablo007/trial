"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";

type Announcement = { id: string; title: string; created_at: string };
type Loan = { id: string; principal: number; interest_rate: number };
type LoanPayment = { loan_id: string; amount: number };
type Fine = { id: string; amount: number };
type FinePayment = { fine_id: string; amount: number };

export default function DashboardPage() {
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [tx, setTx] = useState<{ label: string; amount: number; time: string; kind: 'inc'|'exp' }[]>([]);
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const load = async () => {
    const [{ data: l }, { data: lp }, { data: f }, { data: fp }, { data: pd }, { data: pc }] = await Promise.all([
      supabase.from('loans').select('id,principal,issued_at').order('issued_at', { ascending: false }),
      supabase.from('loan_payments').select('amount,paid_at').order('paid_at', { ascending: false }),
      supabase.from('fines').select('amount,issued_at').order('issued_at', { ascending: false }),
      supabase.from('fine_payments').select('amount,paid_at').order('paid_at', { ascending: false }),
      supabase.from('project_disbursements').select('amount,date').order('date', { ascending: false }),
      supabase.from('project_contributions').select('amount,date').order('date', { ascending: false }),
    ]);
    const totalIncome = (lp||[]).reduce((s:any,x:any)=>s+Number(x.amount||0),0) + (fp||[]).reduce((s:any,x:any)=>s+Number(x.amount||0),0) + (pc||[]).reduce((s:any,x:any)=>s+Number(x.amount||0),0);
    const totalExpense = (l||[]).reduce((s:any,x:any)=>s+Number(x.principal||0),0) + (pd||[]).reduce((s:any,x:any)=>s+Number(x.amount||0),0);
    setIncome(totalIncome); setExpense(totalExpense);
    const last: any[] = [];
    (lp||[]).slice(0,3).forEach((x:any)=> last.push({ label: 'Loan Payment', amount: Number(x.amount||0), time: x.paid_at, kind:'inc'}));
    (fp||[]).slice(0,3).forEach((x:any)=> last.push({ label: 'Fine Payment', amount: Number(x.amount||0), time: x.paid_at, kind:'inc'}));
    (pc||[]).slice(0,3).forEach((x:any)=> last.push({ label: 'Project Contribution', amount: Number(x.amount||0), time: x.date, kind:'inc'}));
    (l||[]).slice(0,3).forEach((x:any)=> last.push({ label: 'Loan Issued', amount: -Number(x.principal||0), time: x.issued_at, kind:'exp'}));
    (pd||[]).slice(0,3).forEach((x:any)=> last.push({ label: 'Project Disbursement', amount: -Number(x.amount||0), time: x.date, kind:'exp'}));
    setTx(last.sort((a,b)=> (new Date(b.time).getTime() - new Date(a.time).getTime())).slice(0,6));
  };

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{
    (async ()=>{
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name,role,avatar_url').eq('id', user.id).maybeSingle();
        setFullName((data?.full_name as string) || user.email || 'Member');
        setRole((data?.role as string) || 'member');
        if (data?.avatar_url) setAvatarUrl(data.avatar_url as string);
      }
    })();
  },[]);
  useEffect(() => {
    const ch = supabase
      .channel('overview-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loans' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loan_payments' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fines' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fine_payments' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_disbursements' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_contributions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const incValues = useMemo(()=> tx.filter(t=>t.kind==='inc').slice(-6).map(t=>Math.abs(t.amount)), [tx]);
  const expValues = useMemo(()=> tx.filter(t=>t.kind==='exp').slice(-6).map(t=>Math.abs(t.amount)), [tx]);

  return (
    <div className="card" style={{padding:24}}>
      <div className="align-between" style={{marginBottom:16}}>
        <div>
          <div className="h4" style={{fontSize:28}}>Overview</div>
          <div style={{fontSize:28,fontWeight:800}}>{fullName ? `Dear ${fullName.split(' ')[0]}, welcome to camsu-connect.` : 'Welcome to camsu-connect.'}</div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input className="search" placeholder="Search something..." />
          <ProfileMini name={fullName} role={role} avatarUrl={avatarUrl} onUploaded={(url)=>setAvatarUrl(url)} />
        </div>
      </div>
      <div className="row" style={{gap:16}}>
        <div className="col">
          <div className="card"><div className="muted">Expense</div><div style={{fontSize:28,fontWeight:800}}>{formatCurrency(expense)}</div>
            <Sparkline values={expValues} color="#2563eb" />
          </div>
        </div>
        <div className="col">
          <div className="card"><div className="muted">Income</div><div style={{fontSize:28,fontWeight:800}}>{formatCurrency(income)}</div>
            <Sparkline values={incValues} color="#EC4899" />
          </div>
        </div>
        <div className="col">
          <div className="card"><div className="muted">Statistics by category</div>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <div style={{width:120,height:120,borderRadius:'50%',border:'12px solid #2563eb',borderTopColor:'#F59E0B'}}></div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,background:'#2563eb',borderRadius:99}}></span><span className="muted">Other expenses - 50%</span></div>
                <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,background:'#EC4899',borderRadius:99}}></span><span className="muted">Entertainment - 35%</span></div>
                <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,background:'#F59E0B',borderRadius:99}}></span><span className="muted">Investments - 15%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="align-between" style={{margin:'8px 0'}}>
          <div style={{fontWeight:700}}>Latest transactions</div>
          <a className="btn link" href="#">See all</a>
        </div>
        <div className="card">
          {tx.length===0 ? <div className="muted">No transactions yet.</div> : tx.map((t,i)=> (
            <div key={i} style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',padding:'8px 0'}}>
              <span>{t.label}</span>
              <span style={{color: t.amount<0? '#dc2626':'#16a34a'}}>{t.amount<0? '-' : '+'}{formatCurrency(Math.abs(t.amount))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }){
  const w = 260, h = 80, pad = 10;
  const vals = (values && values.length ? values : [4,6,3,5,8,4]).map(v=>Number(v));
  const max = Math.max(1, ...vals);
  const pts = vals.map((v,i)=> {
    const x = pad + (i*(w-2*pad)/(vals.length-1));
    const y = h-pad - (v/max)*(h-2*pad);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{marginTop:8}}>
      <polyline fill="none" stroke={color} strokeWidth={3} points={pts} />
    </svg>
  );
}

function ProfileMini({ name, role, avatarUrl, onUploaded }: { name: string; role: string; avatarUrl?: string; onUploaded: (url:string)=>void }){
  const initial = (name||'M').charAt(0).toUpperCase();
  const fileRef = useRef<HTMLInputElement|null>(null);

  const onPick = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const path = `${user.id}/${Date.now()}_${f.name}`;
    const up = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
    if (up.error) return alert(up.error.message);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl;
    const { error } = await supabase.rpc('user_set_avatar', { new_url: url });
    if (error) return alert(error.message);
    onUploaded(url);
  };

  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <button onClick={onPick} title="Upload profile picture" style={{border:'none',background:'transparent',cursor:'pointer'}}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" style={{width:42,height:42,borderRadius:'50%',objectFit:'cover',border:'2px solid #fde68a'}}/>
        ) : (
          <div style={{width:42,height:42,borderRadius:'50%',background:'#fde68a',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800}}>{initial}</div>
        )}
      </button>
      <input type="file" accept="image/*" ref={fileRef} onChange={onFile} style={{display:'none'}} />
      <div>
        <div style={{fontWeight:700}}>{name || 'Member'}</div>
        <div className="muted" style={{fontSize:12,textTransform:'capitalize'}}>{role || 'member'}</div>
        <button className="btn link" onClick={async ()=>{ await supabase.auth.signOut(); location.href = '/login'; }} style={{padding:0}}>Log out</button>
      </div>
    </div>
  );
}
