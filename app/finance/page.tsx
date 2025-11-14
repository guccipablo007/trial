"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/components/useProfile";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/lib/format";

type Loan = { id: string; member_id: string; principal: number; interest_rate: number; issued_at: string; due_date: string|null; reason: string|null; status: string };
type Fine = { id: string; member_id: string; amount: number; issued_at: string; due_date: string|null; reason: string|null; status: string };
type LoanPayment = { loan_id: string; amount: number; paid_at?: string };
type FinePayment = { fine_id: string; amount: number; paid_at?: string };
type Disb = { amount: number; date: string; reason?: string; project_id?: string };

export default function FinancePage(){
  const [loans, setLoans] = useState<Loan[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [loanPays, setLoanPays] = useState<LoanPayment[]>([]);
  const [finePays, setFinePays] = useState<FinePayment[]>([]);
  const [disb, setDisb] = useState<Disb[]>([]);
  const [contrib, setContrib] = useState<{ amount: number }[]>([]);
  const [contribForm, setContribForm] = useState({ amount: "", date: "", reason: "members_registration" });
  const { profile } = useProfile();
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);

  const [loan, setLoan] = useState({ member_id: "", principal: "", due_date: "", reason: "", interest_rate: 0.5 });
  const [fine, setFine] = useState({ member_id: "", amount: "", due_date: "", reason: "" });
  const [loanMsg, setLoanMsg] = useState<string | null>(null);
  const [fineMsg, setFineMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterRange, setFilterRange] = useState<string>("Last 30 Days");
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showFineForm, setShowFineForm] = useState(false);
  const [showContribForm, setShowContribForm] = useState(false);
  const [contribMsg, setContribMsg] = useState<string|null>(null);

  const canWrite = profile?.role === "system_admin" || profile?.role === "secretary";
  const isAdmin  = profile?.role === "system_admin";

  const load = async () => {
    const [lq, fq, mq, lpq, fpq, pdq, pcq, gcq] = await Promise.all([
      supabase.from("loans").select("id,member_id,principal,interest_rate,issued_at,due_date,reason,status").order("issued_at", { ascending: false}),
      supabase.from("fines").select("id,member_id,amount,issued_at,due_date,reason,status").order("issued_at", { ascending: false}),
      supabase.from("profiles").select("id,full_name").order("full_name", { ascending: true}),
      supabase.from("loan_payments").select("loan_id,amount,paid_at"),
      supabase.from("fine_payments").select("fine_id,amount,paid_at"),
      supabase.from("project_disbursements").select("amount,date,reason,project_id"),
      supabase.from("project_contributions").select("amount"),
      supabase.from("contributions").select("amount,date,reason")
    ]);
    setLoans(lq.data || []);
    setFines(fq.data || []);
    setMembers((mq.data || []).filter((m:any)=>true));
    setLoanPays(lpq.data || []);
    setFinePays(fpq.data || []);
    setDisb(pdq.data || []);
    const totalPC = (pcq.data || []).map((x:any)=>({amount:Number(x.amount||0)}));
    const totalGC = (gcq.data || []).map((x:any)=>({amount:Number(x.amount||0)}));
    setContrib([...totalPC, ...totalGC]);
  };
  useEffect(()=>{ load(); },[]);
  useEffect(() => {
    const channel = supabase
      .channel("finance-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loans" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loan_payments" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fines" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fine_payments" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_disbursements" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_contributions" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const grantLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanMsg(null);
    if (!loan.member_id) { setLoanMsg("Please select an applicant."); return; }
    if (loan.principal === "" || Number(loan.principal) <= 0) { setLoanMsg("Enter a valid principal amount."); return; }
    const { error } = await supabase.from("loans").insert({
      member_id: loan.member_id,
      principal: Number(loan.principal),
      interest_rate: loan.interest_rate,
      due_date: loan.due_date || null,
      reason: loan.reason || null
    });
    if (error) { setLoanMsg(error.message); return; }
    setLoan({ member_id: "", principal: "", due_date: "", reason: "", interest_rate: 0.5 });
    setLoanMsg("Loan created successfully.");
    await load();
  };

  const levyFine = async (e: React.FormEvent) => {
    e.preventDefault();
    setFineMsg(null);
    if (!fine.member_id) { setFineMsg("Please select a member."); return; }
    if (fine.amount === "" || Number(fine.amount) <= 0) { setFineMsg("Enter a valid fine amount."); return; }
    const { error } = await supabase.from("fines").insert({
      member_id: fine.member_id,
      amount: Number(fine.amount),
      due_date: fine.due_date || null,
      reason: fine.reason || null
    });
    if (error) { setFineMsg(error.message); return; }
    setFine({ member_id: "", amount: "", due_date: "", reason: "" });
    setFineMsg("Fine recorded successfully.");
    await load();
  };

  const totals = useMemo(() => {
    const paidByLoan = loanPays.reduce<Record<string, number>>((acc,p)=>{acc[p.loan_id]=(acc[p.loan_id]||0)+Number(p.amount||0);return acc;}, {});
    const outstandingLoans = loans.reduce((sum,l)=>{
      const total = Number(l.principal||0) * (1 + Number(l.interest_rate||0)/100);
      const paid = paidByLoan[l.id] || 0;
      return sum + Math.max(0,total - paid);
    },0);
    const paidByFine = finePays.reduce<Record<string, number>>((acc,p)=>{acc[p.fine_id]=(acc[p.fine_id]||0)+Number(p.amount||0);return acc;}, {});
    const unpaidFines = fines.reduce((sum,f)=> sum + Math.max(0, Number(f.amount||0) - (paidByFine[f.id]||0)),0);
    const totalContrib = contrib.reduce((s,x)=> s + Number(x.amount||0), 0);
    const totalLoanRepay = loanPays.reduce((s,x)=> s + Number(x.amount||0), 0);
    const totalFinePay  = finePays.reduce((s,x)=> s + Number(x.amount||0), 0);
    const totalLoanOut  = loans.reduce((s,l)=> s + Number(l.principal||0), 0);
    const totalProjDisb = disb.reduce((s,x)=> s + Number(x.amount||0), 0);
    const availableFunds = totalContrib + totalLoanRepay + totalFinePay - totalLoanOut - totalProjDisb;
    return { outstandingLoans, unpaidFines, availableFunds };
  },[loans,loanPays,fines,finePays,disb,contrib]);

  // Chart data
  const chart = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 29);
    const weekIndex = (d: Date) => Math.min(4, Math.floor((+d - +start) / (1000*60*60*24*7)));
    const labels = ["Week 1","Week 2","Week 3","Week 4","This Week"];
    const income = [0,0,0,0,0];
    const expenses = [0,0,0,0,0];
    loanPays.forEach(p=>{ const d = p.paid_at ? new Date(p.paid_at) : now; if (d >= start) income[weekIndex(d)] += Number(p.amount||0); });
    finePays.forEach(p=>{ const d = p.paid_at ? new Date(p.paid_at) : now; if (d >= start) income[weekIndex(d)] += Number(p.amount||0); });
    loans.forEach(l=>{ const d = l.issued_at ? new Date(l.issued_at) : now; if (d >= start) expenses[weekIndex(d)] += Number(l.principal||0); });
    disb.forEach(x=>{ const d = x.date ? new Date(x.date) : now; if (d >= start) expenses[weekIndex(d)] += Number(x.amount||0); });
    const maxY = Math.max(1, ...income, ...expenses);
    return { labels, income, expenses, maxY };
  }, [loanPays, finePays, loans, disb]);

  return (
    <div>
      <PageHeader title="Finance Overview" />

      <div className="grid-2" style={{marginTop:16}}>
        <div>
          {/* Recent Transactions first */}
          <div className="card">
            <div className="h4" style={{marginBottom:8}}>Recent Transactions</div>
            <Filters filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterRange={filterRange} setFilterRange={setFilterRange} />
            <FinanceTable
              loans={loans} fines={fines} members={members}
              loanPays={loanPays} finePays={finePays} disb={disb}
              filterStatus={filterStatus} filterRange={filterRange}
              canWrite={!!canWrite} isAdmin={!!isAdmin}
            />
          </div>

          <div className="card">
            <div className="h4">Financial Reporting</div>
            <div className="subtitle" style={{marginBottom:12}}>Report Type and Period</div>
            <div className="row">
              <div className="col">
                <label>Report Type</label>
                <select>
                  <option>Income vs. Expenses</option>
                  <option>Loans Summary</option>
                  <option>Fines Summary</option>
                </select>
              </div>
              <div className="col">
                <label>Time Period</label>
                <select>
                  <option>Last 30 Days</option>
                  <option>Last 90 Days</option>
                  <option>Year to Date</option>
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:10}}>
              <button className="btn secondary">Generate Report</button>
              <button className="btn primary">Export</button>
            </div>
          </div>

          <div className="card">
            <div className="h4">Income vs. Expenses (Last 30 Days)</div>
            <LineChart labels={chart.labels} income={chart.income} expenses={chart.expenses} maxY={chart.maxY} />
          </div>

          {canWrite && showLoanForm && (<form id="grant-loan" onSubmit={grantLoan} className="card">
            <h3>Grant loan (secretary/admin)</h3>
            <label>Applicant</label>
            <select value={loan.member_id} onChange={e=>setLoan(v=>({ ...v, member_id: e.target.value }))} required>
              <option value="">Select member</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.id}</option>
              ))}
            </select>
            <label>Principal</label>
            <input type="number" step="0.01" value={loan.principal} onChange={e=>setLoan(v=>({ ...v, principal: e.target.value }))} required />
            <label>Interest rate (%)</label>
            <input type="number" step="0.01" value={loan.interest_rate} onChange={e=>setLoan(v=>({ ...v, interest_rate: Number(e.target.value) }))} />
            <label>Due date</label>
            <input type="date" value={loan.due_date} onChange={e=>setLoan(v=>({ ...v, due_date: e.target.value }))} />
            <label>Reason</label>
            <select value={loan.reason} onChange={e=>setLoan(v=>({ ...v, reason: e.target.value }))}>
              <option value="">Select reason</option>
              <option>Emergency Financial Needs</option>
              <option>Business</option>
              <option>Education Expenses</option>
              <option>Major Life Events</option>
            </select>
            <button className="btn" type="submit">Grant loan</button>
            {loanMsg && <div style={{marginTop:8,color: loanMsg.includes("successfully") ? "var(--brand-green)" : "#b91c1c"}}>{loanMsg}</div>}
          </form>)}

          {canWrite && showFineForm && (<form id="levy-fine" onSubmit={levyFine} className="card">
            <h3>Levy fine (secretary/admin)</h3>
            <label>Member</label>
            <select value={fine.member_id} onChange={e=>setFine(v=>({ ...v, member_id: e.target.value }))} required>
              <option value="">Select member</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.id}</option>
              ))}
            </select>
            <label>Amount</label>
            <input type="number" step="0.01" value={fine.amount} onChange={e=>setFine(v=>({ ...v, amount: e.target.value }))} required />
            <label>Due date</label>
            <input type="date" value={fine.due_date} onChange={e=>setFine(v=>({ ...v, due_date: e.target.value }))} />
            <label>Reason</label>
            <select value={fine.reason} onChange={e=>setFine(v=>({ ...v, reason: e.target.value }))}>
              <option value="">Select reason</option>
              <option>insubordination</option>
              <option>lateness</option>
              <option>non-payment of dues</option>
            </select>
            <button className="btn" type="submit">Levy fine</button>
            {fineMsg && <div style={{marginTop:8,color: fineMsg.includes("successfully") ? "var(--brand-green)" : "#b91c1c"}}>{fineMsg}</div>}
          </form>)}
        </div>

        <div>
          <div className="metric">
            <div className="muted">Outstanding Loans</div>
            <div style={{fontSize:24,fontWeight:700}}>{formatCurrency(totals.outstandingLoans)}</div>
          </div>
          <div className="metric" style={{marginTop:12}}>
            <div className="muted">Unpaid Fines</div>
            <div style={{fontSize:24,fontWeight:700}}>{formatCurrency(totals.unpaidFines)}</div>
          </div>
          <div className="actions" style={{marginTop:12}}>
            <button className="btn primary" onClick={()=>{ setShowLoanForm(v=>!v); if (!showLoanForm) setTimeout(()=>document.getElementById("grant-loan")?.scrollIntoView({behavior:"smooth"}),0); }}>Add New Loan</button>
            <button className="btn accent" onClick={()=>{ setShowFineForm(v=>!v); if (!showFineForm) setTimeout(()=>document.getElementById("levy-fine")?.scrollIntoView({behavior:"smooth"}),0); }}>Levy New Fine</button>
            <button className="btn" onClick={()=>{ setShowContribForm(v=>!v); if (!showContribForm) setTimeout(()=>document.getElementById("add-contrib")?.scrollIntoView({behavior:"smooth"}),0); }}>Add Contribution</button>
          </div>
          <div className="metric" style={{marginTop:12}}>
            <div className="muted">Total Available Funds</div>
            <div style={{fontSize:24,fontWeight:700}}>{formatCurrency(totals.availableFunds)}</div>
          </div>
        </div>
      </div>
      {canWrite && showContribForm && (
        <form id="add-contrib" onSubmit={(e)=>{e.preventDefault(); (async()=>{ const { amount, date, reason } = contribForm; if(!amount||Number(amount)<=0||!date){ setContribMsg('Enter amount and date'); return;} const { error } = await supabase.from('contributions').insert({ amount: Number(amount), date, reason }); if(error){ setContribMsg(error.message);} else { setContribMsg('Contribution recorded'); setContribForm({ amount: "", date: "", reason: "members_registration" }); load(); }})(); }} className="card" style={{marginTop:16}}>
          <h3>Add Contribution</h3>
          <label>Reason</label>
          <select value={contribForm.reason} onChange={e=>setContribForm(v=>({ ...v, reason: e.target.value }))}>
            <option value="members_registration">Members Registration</option>
            <option value="end_of_year_party">End of Year Party</option>
          </select>
          <label>Amount</label>
          <input type="number" step="0.01" value={contribForm.amount} onChange={e=>setContribForm(v=>({ ...v, amount: e.target.value }))} />
          <label>Date</label>
          <input type="date" value={contribForm.date} onChange={e=>setContribForm(v=>({ ...v, date: e.target.value }))} />
          <button className="btn" type="submit">Save</button>
          {contribMsg && <div style={{marginTop:8,color: contribMsg.includes('recorded')? 'var(--brand-green)' : '#b91c1c'}}>{contribMsg}</div>}
        </form>
      )}
    </div>
  );
}

function FinanceTable({ loans, fines, members, loanPays, finePays, disb, filterStatus, filterRange, canWrite, isAdmin }:
  { loans: Loan[]; fines: Fine[]; members: {id:string; full_name: string|null}[]; loanPays: LoanPayment[]; finePays: FinePayment[]; disb: Disb[]; filterStatus: string; filterRange: string; canWrite: boolean; isAdmin: boolean }){
  const nameOf = (id: string) => members.find(m=>m.id===id)?.full_name || id;
  const paidByLoan = loanPays.reduce<Record<string, number>>((acc,p)=>{acc[p.loan_id]=(acc[p.loan_id]||0)+Number(p.amount||0);return acc;}, {});
  const paidByFine = finePays.reduce<Record<string, number>>((acc,p)=>{acc[p.fine_id]=(acc[p.fine_id]||0)+Number(p.amount||0);return acc;}, {});
  let rows = [
    ...loans.map(l => {
      const total = Number(l.principal||0) * (1 + Number(l.interest_rate||0)/100);
      const paid = paidByLoan[l.id] || 0;
      const isPaid = paid >= total - 0.0001;
      const isOverdue = !isPaid && l.due_date && new Date(l.due_date) < new Date();
      return {
        member: nameOf(l.member_id), id: l.id, type: "Loan", amount: l.principal,
        date: l.issued_at?.slice(0,10), status: isPaid ? "Paid" : (isOverdue ? "Overdue" : "Outstanding"), reason: l.reason || ""
      };
    }),
    ...fines.map(f => {
      const paid = paidByFine[f.id] || 0;
      const isPaid = paid >= Number(f.amount||0) - 0.0001;
      const isOverdue = !isPaid && f.due_date && new Date(f.due_date) < new Date();
      return {
        member: nameOf(f.member_id), id: f.id, type: "Fine", amount: f.amount,
        date: f.issued_at?.slice(0,10), status: isPaid ? "Paid" : (isOverdue ? "Overdue" : "Unpaid"), reason: f.reason || ""
      };
    }),
    ...disb.map(x => ({ member: "—", id: (x.project_id||"")+(x.date||""), type: "Disbursement", amount: x.amount, date: x.date, status: "Expense", reason: x.reason || "" }))
  ];

  // Apply filters
  const now = new Date();
  let cutoff: Date | null = null;
  if (filterRange === "Last 30 Days") { cutoff = new Date(now); cutoff.setDate(now.getDate()-30); }
  else if (filterRange === "Last 90 Days") { cutoff = new Date(now); cutoff.setDate(now.getDate()-90); }
  else if (filterRange === "Year to Date") { cutoff = new Date(now.getFullYear(),0,1); }
  if (cutoff) {
    rows = rows.filter(r => {
      if (!r.date) return true;
      const d = new Date(r.date);
      return d >= cutoff!;
    });
  }
  if (filterStatus === "Outstanding/Unpaid") rows = rows.filter(r => r.type==="Disbursement" ? false : (r.status === "Outstanding" || r.status === "Unpaid"));
  else if (filterStatus === "Paid")          rows = rows.filter(r => r.type==="Disbursement" ? false : (r.status === "Paid"));
  else if (filterStatus === "Overdue")       rows = rows.filter(r => r.type==="Disbursement" ? false : (r.status === "Overdue"));

  const markLoanRepaid = async (loanId: string) => {
    const l = loans.find(x=>x.id===loanId); if (!l) return;
    const total = Number(l.principal||0) * (1 + Number(l.interest_rate||0)/100);
    const paid = paidByLoan[l.id] || 0;
    const remaining = Math.max(0, total - paid);
    if (remaining > 0) await supabase.from("loan_payments").insert({ loan_id: loanId, amount: remaining });
    await supabase.from("loans").update({ status: "repaid" }).eq("id", loanId);
  };
  const markFinePaid = async (fineId: string) => {
    const f = fines.find(x=>x.id===fineId); if (!f) return;
    const paid = paidByFine[f.id] || 0;
    const remaining = Math.max(0, Number(f.amount||0) - paid);
    if (remaining > 0) await supabase.from("fine_payments").insert({ fine_id: f.id, amount: remaining });
    await supabase.from("fines").update({ status: "paid" }).eq("id", fineId);
  };
  const deleteLoan = async (loanId: string) => { if (!isAdmin) return; if (!confirm("Delete this loan record?")) return; await supabase.from("loans").delete().eq("id", loanId); };
  const deleteFine = async (fineId: string) => { if (!isAdmin) return; if (!confirm("Delete this fine record?")) return; await supabase.from("fines").delete().eq("id", fineId); };

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Member Name</th>
          <th>Transaction ID</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Date Issued</th>
          <th>Status</th>
          <th>Reason</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.type + r.id}>
            <td>{r.member}</td>
            <td style={{color: "var(--brand-sky)"}}>{r.id.slice(0,8).toUpperCase()}</td>
            <td>{r.type}</td>
            <td>{formatCurrency(r.amount)}</td>
            <td>{r.date}</td>
            <td>{
              r.status === "Paid" ? (
                <span className="badge paid">Paid</span>
              ) : r.status === "Overdue" ? (
                <span className="badge overdue">Overdue</span>
              ) : (
                <span className="badge outstanding">{r.type==="Loan" ? "Outstanding" : r.type==="Fine" ? "Unpaid" : "Expense"}</span>
              )
            }</td>
            <td>{r.reason}</td>
            <td>
              {canWrite && r.type==="Loan" && r.status!=="Paid" && (
                <button className="btn" onClick={()=>markLoanRepaid(r.id)}>Mark Repaid</button>
              )}
              {canWrite && r.type==="Fine" && (
                <select defaultValue={r.status==="Paid"?"paid":"unpaid"} onChange={(e)=>{ if(e.target.value==="paid") markFinePaid(r.id); else supabase.from("fines").update({ status: "unpaid" }).eq("id", r.id); }}>
                  <option value="unpaid">unpaid</option>
                  <option value="paid">paid</option>
                </select>
              )}
              {isAdmin && r.type==="Loan" && (
                <button className="btn secondary" onClick={()=>deleteLoan(r.id)} style={{marginLeft:6}}>Delete</button>
              )}
              {isAdmin && r.type==="Fine" && (
                <button className="btn secondary" onClick={()=>deleteFine(r.id)} style={{marginLeft:6}}>Delete</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Filters({ filterStatus, setFilterStatus, filterRange, setFilterRange }: { filterStatus: string; setFilterStatus: (v:string)=>void; filterRange: string; setFilterRange: (v:string)=>void }){
  return (
    <div className="row" style={{marginBottom:8}}>
      <div className="col">
        <label>Status</label>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option>All</option>
          <option>Outstanding/Unpaid</option>
          <option>Paid</option>
          <option>Overdue</option>
        </select>
      </div>
      <div className="col">
        <label>Date range</label>
        <select value={filterRange} onChange={e=>setFilterRange(e.target.value)}>
          <option>Last 30 Days</option>
          <option>Last 90 Days</option>
          <option>Year to Date</option>
        </select>
      </div>
    </div>
  );
}

function LineChart({ labels, income, expenses, maxY }: { labels: string[]; income: number[]; expenses: number[]; maxY: number }){
  const width = 700, height = 240, pad = 30;
  const xStep = (width - pad*2) / (labels.length - 1);
  const scaleY = (v: number) => height - pad - (v / maxY) * (height - pad*2);
  const points = (arr: number[]) => arr.map((v,i)=>`${pad + i*xStep},${scaleY(v)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0} y={0} width={width} height={height} fill="white" />
      {[0,0.25,0.5,0.75,1].map((t,i)=>{
        const y = pad + (height - pad*2)*i/4;
        return <line key={i} x1={pad} y1={y} x2={width-pad} y2={y} stroke="#eee" />
      })}
      <polyline fill="rgba(91,91,214,0.15)" stroke="none" points={`${pad},${height-pad} ${points(income)} ${width-pad},${height-pad}`} />
      <polyline fill="none" stroke="#5b5bd6" strokeWidth={2} points={points(income)} />
      <polyline fill="none" stroke="#111" strokeWidth={2} points={points(expenses)} />
      {labels.map((l,i)=> (
        <text key={i} x={pad + i*xStep} y={height-8} fontSize="10" textAnchor="middle" fill="#6b7280">{l}</text>
      ))}
    </svg>
  );
}
