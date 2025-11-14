"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
      }
    } catch {}

    setMessage("Success! Redirecting...");
    router.push("/");
  };

  const onReset = async () => {
    setMessage(null);
    if (!email) {
      setMessage("Enter your email first, then click Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });
    setMessage(error ? error.message : "Password reset link sent (check your email).");
  };

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden'}}>
      {/* Left panel */}
      <div style={{background:'#f1f5f9',padding:'48px 32px',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{maxWidth:420,textAlign:'center'}}>
          <h1 style={{fontSize:36,lineHeight:1.2,margin:'0 0 12px'}}>Connecting Your Community.</h1>
          <p className="muted" style={{fontSize:16}}>Sign in to access your dashboard and manage your financial data with security and ease.</p>
        </div>
      </div>

      {/* Right panel: form */}
      <div style={{padding:'48px 32px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <span style={{fontSize:18}}>👥</span>
          <div style={{fontWeight:700,fontSize:20}}>camsu-connect</div>
        </div>

        <h2 style={{margin:'0 0 6px'}}>Welcome Back</h2>
        <div className="muted" style={{marginBottom:16}}>Sign in to your account to continue.</div>

        <form onSubmit={onLogin}>
          <label>Username or Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Enter your username or email" required />

          <label>Password</label>
          <div style={{position:'relative'}}>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPwd? 'text':'password'} placeholder="Enter your password" required />
            <button type="button" onClick={()=>setShowPwd(v=>!v)} aria-label="Toggle password" style={{position:'absolute',right:8,top:8,border:'none',background:'transparent',cursor:'pointer'}}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>

          <div style={{textAlign:'right',marginTop:6,marginBottom:12}}>
            <button className="btn secondary" type="button" onClick={onReset} disabled={loading}>
              Forgot Password?
            </button>
          </div>

          <button className="btn primary" type="submit" disabled={loading} style={{width:'100%',marginTop:6}}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div style={{display:'flex',alignItems:'center',gap:12,margin:'14px 0'}}>
            <div style={{flex:1,height:1,background:'#e5e7eb'}}/>
            <span className="muted">OR</span>
            <div style={{flex:1,height:1,background:'#e5e7eb'}}/>
          </div>

          <Link href="/signup" className="btn accent" style={{display:'inline-block',width:'100%',textAlign:'center'}}>Sign Up</Link>
        </form>

        {message && <p style={{ marginTop: 12 }}>{message}</p>}

        <div className="muted" style={{marginTop:16,fontSize:12}}>By signing in, you agree to our Terms of Service and Privacy Policy.</div>
      </div>
    </div>
  );
}

