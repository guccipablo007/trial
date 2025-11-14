"use client";
import { ReactNode } from "react";

export default function PageHeader({ title, children, onSearch }:{ title: string; children?: ReactNode; onSearch?: (q:string)=>void }){
  return (
    <div className="card" style={{padding:16,display:'flex',alignItems:'center',gap:12,justifyContent:'space-between'}}>
      <div>
        <div style={{fontSize:24,fontWeight:800}}>{title}</div>
        <div className="subtitle">Manage and explore data</div>
      </div>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        {onSearch && <input className="search" placeholder="Search..." onChange={e=>onSearch(e.target.value)} />}
        {children}
      </div>
    </div>
  );
}

