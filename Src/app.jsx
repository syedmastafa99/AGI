import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  Play, Send, Code, Layout, Sparkles, AlertCircle, 
  Loader2, Save, History, Rocket, LogOut, LogIn, 
  Eye, MessageSquare, Terminal, User, CheckCircle2,
  Trash2, Smartphone, Monitor, Share2, Github
} from 'lucide-react';

/**
 * SoloForge Pro - এক ফাইলে সম্পূর্ণ এআই অ্যাপ বিল্ডার প্রজেক্ট।
 * এটি সোলো ফাউন্ডারদের জন্য ডিজাইন করা হয়েছে যাতে দ্রুত প্রোটোটাইপ এবং ডেপ্লয় করা যায়।
 */

// --- ফায়ারবেস কনফিগারেশন (আপনার কনসোল থেকে এগুলো আপডেট করুন) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

// সার্ভিস ইনিশিয়ালাইজেশন
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'soloforge-pro-universal';

const App = () => {
  // --- স্টেটসমূহ ---
  const [user, setUser] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // chat, code, preview
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('একটি আধুনিক সিআরএম (CRM) ড্যাশবোর্ড তৈরি করো যেখানে লিড ম্যানেজমেন্ট ফিচার থাকবে।');
  const [code, setCode] = useState(`<!DOCTYPE html>
<html lang="bn">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Hind Siliguri', sans-serif; background: #020617; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        .glow { text-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
    </style>
</head>
<body>
    <div class="p-8">
        <h1 class="text-5xl font-black mb-4 glow uppercase tracking-tighter">SoloForge Pro</h1>
        <p class="text-slate-400 max-w-md mx-auto">এআই এজেন্ট আপনার নির্দেশনার অপেক্ষায় আছে। বাম পাশের চ্যাট বক্সে আপনার আইডিয়া লিখুন।</p>
    </div>
</body>
</html>`);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const iframeRef = useRef(null);
  
  // এআই এপিআই কি (রানটাইমে ইনজেক্ট হবে)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 

  // --- অথেনটিকেশন লজিক (Rule 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        }
      } catch (err) {
        console.error("Auth init failed:", err);
      } finally {
        setAppReady(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- ফায়ারস্টোর থেকে ডেটা লোড করা (Rule 1 & 2) ---
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProjects([]);
      return;
    }
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
    return onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore loading error:", err));
  }, [user]);

  // --- প্রিভিউ রান করা ---
  const runPreview = () => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(code);
      doc.close();
    }
  };

  useEffect(() => {
    if (activeTab === 'preview') {
      const timer = setTimeout(runPreview, 150);
      return () => clearTimeout(timer);
    }
  }, [code, activeTab]);

  // --- এআই জেনারেশন লজিক ---
  const generateApp = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const systemPrompt = "তুমি একজন অভিজ্ঞ ওয়েব ডেভেলপার। ইউজার যা চাইবে তার ভিত্তিতে একটি সম্পূর্ণ সিঙ্গেল-ফাইল HTML/CSS/JS অ্যাপ্লিকেশন তৈরি করো। শুধুমাত্র কোড রিটার্ন করবে, কোনো কথা বা মার্কডাউন ছাড়াই। Tailwind CSS ব্যবহার করবে।";

    const callGemini = async (retries = 5, backoff = 1000) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
          })
        });
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, backoff));
          return callGemini(retries - 1, backoff * 2);
        }
        throw err;
      }
    };

    try {
      const result = await callGemini();
      if (result) {
        const cleanedCode = result.replace(/```html|```/g, '').trim();
        setCode(cleanedCode);
        setActiveTab('preview');
        setSuccess("অ্যাপটি সফলভাবে জেনারেট হয়েছে!");
      }
    } catch (err) {
      setError("এআই এজেন্ট রেসপন্স করতে পারছে না। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // --- ক্লাউড সেভিং ---
  const saveToCloud = async () => {
    if (!user || user.isAnonymous) {
      setError("আপনার প্রোজেক্ট ক্লাউডে সেভ করতে দয়া করে গুগল লগইন করুন।");
      return;
    }
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        name: prompt.substring(0, 30) || "Untitled Project",
        code,
        createdAt: serverTimestamp()
      });
      setSuccess("ক্লাউড স্টোরেজে সফলভাবে সেভ করা হয়েছে!");
    } catch (err) {
      setError("সেভ করতে সমস্যা হয়েছে। আপনার ফায়ারবেস রুলস চেক করুন।");
    }
  };

  if (!appReady) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">SoloForge System Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-white font-sans overflow-hidden">
      {/* Navbar */}
      <header className="h-16 border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
            <Rocket size={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-black text-sm uppercase tracking-tighter">SoloForge <span className="text-indigo-500">Pro</span></h1>
            <p className="text-[9px] text-gray-600 font-black tracking-widest leading-none uppercase">Universal AI Builder</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex bg-white/5 p-1 rounded-full border border-white/10">
            <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'}`}>CHAT</button>
            <button onClick={() => setActiveTab('code')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${activeTab === 'code' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'}`}>CODE</button>
            <button onClick={() => setActiveTab('preview')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'}`}>LIVE</button>
          </div>

          <div className="flex items-center gap-3">
            {user && !user.isAnonymous ? (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <img src={user.photoURL} alt="u" className="w-8 h-8 rounded-full border border-indigo-500" />
                <button onClick={() => signOut(auth)} className="text-gray-500 hover:text-red-400 p-2 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="text-[10px] font-black bg-white text-black px-4 py-2 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2">
                <LogIn size={14} /> LOGIN
              </button>
            )}
            <button onClick={saveToCloud} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
              <Save size={14} /> SAVE
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden flex-col md:flex-row">
        {/* Sidebar Controls */}
        <aside className="w-full md:w-80 border-r border-white/5 bg-[#020617] flex flex-col p-6 overflow-y-auto shrink-0 z-10 shadow-xl">
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Terminal size={14} /> AI কমান্ড সেন্টার
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="আপনি কী বানাতে চান?"
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none mb-2 transition-all placeholder:text-gray-700"
              />
              <button 
                onClick={generateApp}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                {loading ? 'তৈরি হচ্ছে...' : 'জেনারেট করুন'}
              </button>
            </div>

            {/* Project History */}
            {!user?.isAnonymous && projects.length > 0 && (
              <div className="pt-6 border-t border-white/5">
                <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <History size={14} /> আমার ইকোসিস্টেম
                </h3>
                <div className="space-y-2">
                  {projects.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => { setCode(p.code); setActiveTab('preview'); }}
                      className="w-full text-left p-3.5 rounded-xl bg-white/5 border border-transparent hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex items-center justify-between group"
                    >
                      <span className="text-xs font-bold truncate pr-4 text-gray-400 group-hover:text-white">{p.name}</span>
                      <Share2 size={12} className="text-gray-700 group-hover:text-indigo-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Philosophy Section: Anondito Bortoman */}
            <div className="mt-auto pt-8">
              <div className="p-6 rounded-[2.5rem] bg-indigo-600/5 border border-indigo-500/10 shadow-inner">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-3 tracking-[0.2em]">আনন্দিত বর্তমান</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  "ভবিষ্যতের চিন্তায় বর্তমানকে হারিয়ে ফেলবেন না। আপনি এখন যে অ্যাপটি বানাচ্ছেন, প্রতিটি লাইনের কোড এবং প্রতিটি সৃজনশীল মুহূর্ত—সেটিই আপনার প্রকৃত আনন্দ। বর্তমান মুহূর্তটিই আমাদের একমাত্র সত্য।"
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Viewport: Multi-Mode Display */}
        <section className="flex-1 bg-black relative flex flex-col overflow-hidden">
          {/* Mobile Bottom Navigation */}
          <div className="md:hidden flex h-14 border-b border-white/5 bg-[#020617] items-center px-4 gap-2 shrink-0">
             <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 rounded-lg text-[10px] font-black ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>CHAT</button>
             <button onClick={() => setActiveTab('code')} className={`flex-1 py-2 rounded-lg text-[10px] font-black ${activeTab === 'code' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>CODE</button>
             <button onClick={() => setActiveTab('preview')} className={`flex-1 py-2 rounded-lg text-[10px] font-black ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>LIVE</button>
          </div>

          <div className="flex-1">
            {activeTab === 'preview' ? (
              <div className="w-full h-full bg-white">
                <iframe ref={iframeRef} title="Sandbox Preview" className="w-full h-full border-none shadow-inner" />
              </div>
            ) : activeTab === 'code' ? (
              <div className="h-full flex flex-col bg-[#020617]">
                <div className="h-10 bg-black/40 border-b border-white/5 flex items-center px-6 justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Code size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">index.html</span>
                  </div>
                  <button onClick={() => runPreview()} className="text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest">Run Code</button>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck="false"
                  className="flex-1 w-full bg-[#020617] text-indigo-300 p-8 font-mono text-sm outline-none resize-none leading-relaxed selection:bg-indigo-500/30"
                />
              </div>
            ) : (
              // Mobile specific layout for chat (handled by CSS/Conditional)
              <div className="md:hidden block h-full overflow-y-auto">
                 {/* This content is redundant as it's handled by Sidebar in Desktop, but kept for Mobile consistency */}
                 <div className="p-6 text-center text-gray-500 italic text-sm mt-20">
                    এআই প্যানেল থেকে আপনার অ্যাপটি ডিজাইন করুন।
                 </div>
              </div>
            )}
          </div>

          {/* Toast Notifications */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] w-max max-w-[90vw]">
            {error && (
              <div className="bg-red-500 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                <AlertCircle size={18} />
                <span className="text-sm font-bold">{error}</span>
                <button onClick={() => setError(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
              </div>
            )}
            {success && (
              <div className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <CheckCircle2 size={18} />
                <span className="text-sm font-bold">{success}</span>
                <button onClick={() => setSuccess(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer Info */}
      <footer className="h-10 border-t border-white/5 bg-[#020617] px-6 flex items-center justify-between shrink-0 text-[10px] font-bold text-gray-600 tracking-tighter uppercase">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> এআই ইঞ্জিন অনলাইন</span>
          <span className="hidden sm:block">SoloForge OS v6.0 • Stable Release</span>
        </div>
        <div className="flex items-center gap-4">
          <Github size={12} className="hover:text-white cursor-pointer" />
          <span className="text-indigo-400">আনন্দিত বর্তমান</span>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Hind+Siliguri:wght@400;700&family=JetBrains+Mono&display=swap');
        
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        
        body { font-family: 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-top { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default App;

