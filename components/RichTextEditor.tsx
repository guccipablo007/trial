"use client";
import { useRef, useEffect } from "react";

export default function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string)=>void }){
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(()=>{ if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value; }, [value]);
  return (
    <div className="card" style={{padding:0}}>
      <div
        ref={ref}
        contentEditable
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        style={{minHeight:120,padding:10,borderRadius:6,border:'1px solid #ddd'}}
      />
      <div style={{fontSize:12,color:'#555',padding:'6px 10px'}}>Basic rich text. Replace with Quill/Tiptap later if needed.</div>
    </div>
  );
}

