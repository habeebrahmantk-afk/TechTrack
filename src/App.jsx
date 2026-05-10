import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import * as XLSX from "xlsx";

// ── Firebase helpers (replace window.storage) ─────────────────────────────────
const fbGet = async (key) => {
  try {
    const snap = await getDoc(doc(db, "appdata", key));
    return snap.exists() ? snap.data().value : null;
  } catch { return null; }
};
const fbSet = async (key, value) => {
  try { await setDoc(doc(db, "appdata", key), { value }); } catch(e) { console.error(e); }
};
const fbDel = async (key) => {
  try { await deleteDoc(doc(db, "appdata", key)); } catch {}
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const SKY = { 50:"#F0F9FF",100:"#E0F2FE",200:"#BAE6FD",300:"#7DD3FC",400:"#38BDF8",500:"#0EA5E9",600:"#0284C7",700:"#0369A1",800:"#075985",900:"#0C4A6E" };

const STATUS_MAP = {
  scheduled:  { label:"Scheduled",   dot:"#94A3B8", pill:"#F1F5F9", text:"#475569" },
  inprogress: { label:"In Progress", dot:"#F59E0B", pill:"#FFFBEB", text:"#92400E" },
  completed:  { label:"Completed",   dot:"#10B981", pill:"#ECFDF5", text:"#065F46" },
  issue:      { label:"Issue Found", dot:"#EF4444", pill:"#FEF2F2", text:"#991B1B" },
  escalated:  { label:"Escalated",   dot:"#8B5CF6", pill:"#F5F3FF", text:"#5B21B6" },
};
const PRIORITY_MAP = {
  urgent:{ label:"Urgent", pill:"#FEF2F2", text:"#991B1B" },
  high:  { label:"High",   pill:"#FFF7ED", text:"#9A3412" },
  normal:{ label:"Normal", pill:"#F0F9FF", text:"#0369A1" },
  low:   { label:"Low",    pill:"#F8FAFC", text:"#64748B" },
};
const EQUIPMENT = [
  { id:"cctv",      label:"CCTV",                icon:"📷" },
  { id:"access",    label:"Access Control",       icon:"🔐" },
  { id:"biometric", label:"Biometrics",           icon:"👁️" },
  { id:"gate",      label:"Gate Barriers",        icon:"🚧" },
  { id:"signage",   label:"Digital Signage",      icon:"🖥️" },
  { id:"directory", label:"Electronic Directory", icon:"📋" },
];
const CATEGORIES = [
  { id:"pm",        label:"Preventive Maintenance", icon:"🔧" },
  { id:"cm",        label:"Corrective Repair",      icon:"🛠️" },
  { id:"install",   label:"New Installation",       icon:"📦" },
  { id:"inspect",   label:"Routine Inspection",     icon:"🔍" },
  { id:"emergency", label:"Emergency Call-out",     icon:"🚨" },
  { id:"config",    label:"Config / Update",        icon:"⚙️" },
  { id:"handover",  label:"Client Handover",        icon:"🤝" },
];

const TASKS_KEY   = "tasks";
const USERS_KEY   = "users";
const SESSION_KEY = "ft_session"; // localStorage only

const DEF_SITES = [
  { id:"s1", client:"Client A", name:"Main Gate" },
  { id:"s2", client:"Client A", name:"Server Room" },
  { id:"s3", client:"Client B", name:"Tower A Lobby" },
  { id:"s4", client:"Client B", name:"Parking Level 1" },
  { id:"s5", client:"Client C", name:"Floor 3" },
  { id:"s6", client:"Client C", name:"Rooftop" },
];

const todayStr  = () => new Date().toISOString().slice(0,10);
const uid       = () => Math.random().toString(36).slice(2,10);
const avatarHue = n => { const p=["#0284C7","#0F6E56","#7C3AED","#DB2777","#D97706","#DC2626"]; let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))%p.length; return p[h]; };
const initials  = n => n.replace(/^(Eng\.|Tech\.)\s*/i,"").split(" ").map(w=>w[0]||"").join("").toUpperCase().slice(0,2);
const hashPw    = async pw => { try{ const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pw)); return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join(""); }catch{ return btoa(pw); } };

const startOf = p => { const d=new Date(); if(p==="today"){d.setHours(0,0,0,0);return d;} if(p==="week"){d.setDate(d.getDate()-d.getDay()+1);d.setHours(0,0,0,0);return d;} if(p==="month"){d.setDate(1);d.setHours(0,0,0,0);return d;} return new Date(0); };
const inPeriod = (task,period,from,to) => { const d=new Date(task.scheduledDate); if(period==="custom"){return(!from||d>=new Date(from))&&(!to||d<=new Date(to));} return d>=startOf(period); };

// ── ATOMS ─────────────────────────────────────────────────────────────────────
const inp = { width:"100%", boxSizing:"border-box", padding:"10px 12px", borderRadius:8, border:`1px solid ${SKY[200]}`, background:"#fff", color:"#1E293B", fontSize:13, outline:"none", fontFamily:"inherit" };

function Pill({label,status,priority,sm}){
  let pill="#F1F5F9",text="#475569";
  if(status){ const s=STATUS_MAP[status]||STATUS_MAP.scheduled; pill=s.pill; text=s.text; }
  if(priority){ const p=PRIORITY_MAP[priority]||PRIORITY_MAP.normal; pill=p.pill; text=p.text; }
  return <span style={{display:"inline-block",padding:sm?"1px 7px":"2px 10px",borderRadius:20,fontSize:sm?10:11,fontWeight:600,background:pill,color:text,whiteSpace:"nowrap"}}>{label}</span>;
}
function Dot({status}){ const s=STATUS_MAP[status]||STATUS_MAP.scheduled; return <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:s.dot,flexShrink:0,marginTop:2}}/>; }
function Avt({name,size=32}){ const c=avatarHue(name); return <div style={{width:size,height:size,borderRadius:"50%",background:c+"18",color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.35,fontWeight:700,flexShrink:0,border:`1.5px solid ${c}33`}}>{initials(name)}</div>; }
function StatCard({label,val,accent,sub}){ return <div style={{flex:1,minWidth:72,background:"#fff",borderRadius:10,border:`1px solid ${SKY[100]}`,padding:"12px 14px"}}><div style={{fontSize:11,color:"#64748B",marginBottom:3}}>{label}</div><div style={{fontSize:22,fontWeight:700,color:accent||SKY[700]}}>{val}</div>{sub&&<div style={{fontSize:10,color:"#94A3B8",marginTop:1}}>{sub}</div>}</div>; }
function Fld({label,required,children}){ return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:4,fontWeight:600,letterSpacing:"0.03em"}}>{label}{required&&" *"}</label>{children}</div>; }
function Sect({title,count,children,accent}){ return <div style={{marginBottom:22}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingBottom:6,borderBottom:`1.5px solid ${SKY[100]}`}}><span style={{fontSize:12,fontWeight:700,color:accent||SKY[600],textTransform:"uppercase",letterSpacing:"0.06em"}}>{title}</span>{count!=null&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:10,background:SKY[50],color:SKY[700],fontWeight:600}}>{count}</span>}</div>{children}</div>; }
function InfoRow({label,val}){ return <div style={{fontSize:13,color:"#334155",marginBottom:5}}><span style={{fontWeight:600,color:"#64748B"}}>{label}: </span>{val}</div>; }
function Empty({msg,icon}){ return <div style={{border:`1.5px dashed ${SKY[200]}`,borderRadius:12,padding:"40px 20px",textAlign:"center",color:"#94A3B8",fontSize:14}}>{icon&&<div style={{fontSize:32,marginBottom:8}}>{icon}</div>}{msg}</div>; }

function Btn({children,variant="primary",color,disabled,onClick,style={}}){
  const b={padding:"8px 16px",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontSize:13,fontWeight:600,border:"none",...style};
  if(variant==="primary") Object.assign(b,{background:disabled?"#CBD5E1":color||SKY[600],color:"#fff"});
  if(variant==="ghost")   Object.assign(b,{background:"#F8FAFC",border:`1px solid ${SKY[200]}`,color:"#475569"});
  if(variant==="danger")  Object.assign(b,{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626"});
  if(variant==="sky")     Object.assign(b,{background:SKY[50],border:`1px solid ${SKY[200]}`,color:SKY[700]});
  return <button onClick={disabled?undefined:onClick} style={b}>{children}</button>;
}
function PwInput({value,onChange,placeholder}){
  const [show,setShow]=useState(false);
  return <div style={{position:"relative"}}><input type={show?"text":"password"} value={value} onChange={onChange} placeholder={placeholder||"Password"} style={{...inp,paddingRight:38}} autoComplete="new-password"/><button type="button" onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:15}}>{show?"🙈":"👁️"}</button></div>;
}
function Overlay({title,onClose,children,wide}){
  return <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px 14px"}}>
    <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:wide?600:460,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${SKY[100]}`}}>
        <div style={{fontSize:15,fontWeight:700,color:SKY[900]}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:20,lineHeight:1,padding:4}}>✕</button>
      </div>
      <div style={{padding:"18px 20px"}}>{children}</div>
    </div>
  </div>;
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
function buildRows(tasks){
  return tasks.map(t=>({
    "Date": t.scheduledDate, "Client": t.client||"", "Site": t.location||"",
    "Equipment": EQUIPMENT.find(e=>e.id===t.equipment)?.label||t.equipment,
    "Category": CATEGORIES.find(c=>c.id===t.category)?.label||t.category,
    "Priority": PRIORITY_MAP[t.priority]?.label||t.priority,
    "Assigned By": t.assignedBy||"", "Assigned To": t.assignedTo||"",
    "Status": STATUS_MAP[t.status]?.label||t.status,
    "Findings": t.report?.findings||"", "Action Taken": t.report?.action||"",
    "Parts Used": t.report?.parts||"", "Next Visit": t.report?.nextVisit||"",
    "Report By": t.report?.by||"",
    "Report Date": t.report?.at?new Date(t.report.at).toLocaleDateString():"",
    "Comments": (t.comments||[]).map(c=>`${c.by}: ${c.text}`).join(" | "),
  }));
}
function exportExcel(rows,filename){
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[12,18,20,18,22,10,14,14,12,30,28,22,14,12,12,40].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Report"); XLSX.writeFile(wb,filename);
}
function exportWord(rows,title){
  const headers=Object.keys(rows[0]||{});
  const th=headers.map(h=>`<th style="background:#0284C7;color:#fff;padding:7px 9px;font-size:11px;text-align:left;border:1px solid #BAE6FD">${h}</th>`).join("");
  const body=rows.map(r=>`<tr>${headers.map(h=>`<td style="padding:6px 9px;font-size:10px;border:1px solid #E0F2FE;vertical-align:top">${r[h]||""}</td>`).join("")}</tr>`).join("");
  const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body><h1 style="font-family:Arial;color:#0284C7;font-size:18px">${title}</h1><p style="font-family:Arial;font-size:11px;color:#64748B">Generated: ${new Date().toLocaleString()} · ${rows.length} records</p><table style="border-collapse:collapse;width:100%;font-family:Arial"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob=new Blob([html],{type:"application/msword"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${title.replace(/\s+/g,"_")}.doc`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function FieldTracker(){
  const [tasks,   setTasks]   = useState([]);
  const [creds,   setCreds]   = useState([]);
  const [sites,   setSites]   = useState(DEF_SITES);
  const [session, setSession] = useState(null);
  const [view,    setView]    = useState("overview");
  const [modal,   setModal]   = useState(null);
  const [notice,  setNotice]  = useState({msg:"",type:"ok"});
  const [loading, setLoading] = useState(true);
  const [firstRun,setFirstRun]= useState(false);

  const flash=(msg,type="ok")=>{ setNotice({msg,type}); setTimeout(()=>setNotice({msg:"",type:"ok"}),2800); };

  // Save tasks to Firebase
  const saveTasks=async t=>{ setTasks(t); await fbSet(TASKS_KEY,JSON.stringify(t)); };

  // Save users+sites to Firebase
  const saveUsers=async(c,s)=>{
    const payload={credentials:c??creds,sites:s??sites};
    await fbSet(USERS_KEY,JSON.stringify(payload));
  };

  // Load all data on startup
  useEffect(()=>{
    (async()=>{
      const ud=await fbGet(USERS_KEY);
      if(ud){ const p=JSON.parse(ud); setCreds(p.credentials||[]); setSites(p.sites||DEF_SITES); if(!p.credentials?.length) setFirstRun(true); }
      else setFirstRun(true);
      const td=await fbGet(TASKS_KEY);
      if(td) setTasks(JSON.parse(td));
      // Session stored in localStorage (device only)
      const ss=localStorage.getItem(SESSION_KEY);
      if(ss) setSession(JSON.parse(ss));
      setLoading(false);
    })();
  },[]);

  const doLogin=async(username,password)=>{
    const hash=await hashPw(password);
    const user=creds.find(c=>c.username.toLowerCase()===username.toLowerCase()&&c.password===hash);
    if(!user) return false;
    const s={id:user.id,username:user.username,role:user.role,displayName:user.displayName};
    setSession(s); setView("overview"); localStorage.setItem(SESSION_KEY,JSON.stringify(s)); return true;
  };
  const doLogout=()=>{ setSession(null); setView("overview"); localStorage.removeItem(SESSION_KEY); };

  const createUser=async data=>{ const hash=await hashPw(data.password); const u={id:uid(),username:data.username,password:hash,role:data.role,displayName:data.displayName}; const updated=[...creds,u]; setCreds(updated); await saveUsers(updated,undefined); return u; };
  const updateUser=async(id,changes)=>{ const updated=await Promise.all(creds.map(async c=>{ if(c.id!==id) return c; const b={...c,...changes}; if(changes.password) b.password=await hashPw(changes.password); return b; })); setCreds(updated); await saveUsers(updated,undefined); };
  const deleteUser=async id=>{ const u=creds.filter(c=>c.id!==id); setCreds(u); await saveUsers(u,undefined); };
  const saveSiteList=async s=>{ setSites(s); await saveUsers(undefined,s); };

  const addTask=async f=>{ const t={id:uid(),...f,status:"scheduled",createdAt:new Date().toISOString(),assignedBy:me,comments:[],report:null}; await saveTasks([t,...tasks]); setModal(null); flash("Task assigned ✓"); };
  const startTask=async id=>{ await saveTasks(tasks.map(t=>t.id===id?{...t,status:"inprogress",startedAt:new Date().toISOString()}:t)); flash("Task started ▶"); };
  const doReport=async(id,rep)=>{ await saveTasks(tasks.map(t=>t.id===id?{...t,status:rep.status,report:{...rep,by:me,at:new Date().toISOString()}}:t)); setModal(null); flash("Report submitted ✓"); };
  const delTask=async id=>{ await saveTasks(tasks.filter(t=>t.id!==id)); setModal(null); flash("Deleted"); };
  const doUpdate=async(id,commentText,newTech)=>{
    await saveTasks(tasks.map(t=>{ if(t.id!==id) return t; const comments=[...(t.comments||[])]; if(commentText.trim()) comments.push({text:commentText,by:me,role:myRole,at:new Date().toISOString()}); const reassigned=newTech&&newTech!==t.assignedTo; return {...t,comments,assignedTo:newTech||t.assignedTo,status:reassigned?"scheduled":t.status,reassignedBy:reassigned?me:t.reassignedBy}; }));
    setModal(null); flash("Updated ✓");
  };

  if(loading) return <Splash/>;
  if(firstRun) return <SetupScreen onDone={async f=>{ await createUser({...f,role:"manager",displayName:"Manager"}); setFirstRun(false); flash("Manager account created — please sign in."); }}/>;
  if(!session) return <LoginScreen onLogin={doLogin} notice={notice}/>;

  const me=session.displayName, myRole=session.role;
  const engineers=creds.filter(c=>c.role==="engineer");
  const technicians=creds.filter(c=>c.role==="technician");
  const clients=[...new Set(sites.map(s=>s.client))].sort();

  const navItems=myRole==="manager"
    ? [["overview","Overview"],["alltasks","All Tasks"],["assign","Assign"],["reports","Reports"],["sites","Sites"],["accounts","Accounts"]]
    : myRole==="engineer"
    ? [["overview","Overview"],["alltasks","All Tasks"],["assign","Assign"],["reports","Reports"],["sites","Sites"]]
    : [["mytasks","My Tasks"],["history","History"]];

  function Shell({children}){
    return <div style={{background:SKY[50],minHeight:"100vh"}}>
      <div style={{background:"#fff",borderBottom:`1px solid ${SKY[100]}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}>
          <div style={{width:30,height:30,borderRadius:8,background:SKY[600],display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🛠️</div>
          <span style={{fontWeight:700,fontSize:14,color:SKY[900]}}>Field Tracker</span>
          <span style={{fontSize:11,padding:"2px 9px",borderRadius:20,background:SKY[50],color:SKY[700],fontWeight:700,border:`1px solid ${SKY[200]}`}}>{myRole==="manager"?"Manager":me}</span>
        </div>
        <div style={{display:"flex",gap:2,flexWrap:"wrap",padding:"5px 0",alignItems:"center"}}>
          {navItems.map(([id,lbl])=>(
            <button key={id} onClick={()=>setView(id)} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:view===id?700:500,background:view===id?SKY[600]:"transparent",color:view===id?"#fff":"#64748B"}}>
              {lbl}
            </button>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:6,paddingLeft:8,borderLeft:`1px solid ${SKY[100]}`}}>
            <Avt name={me} size={24}/>
            <button onClick={doLogout} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${SKY[200]}`,cursor:"pointer",fontSize:11,background:"#fff",color:"#94A3B8"}}>Logout</button>
          </div>
        </div>
      </div>
      {notice.msg&&<div style={{background:notice.type==="err"?"#FEF2F2":SKY[600],color:notice.type==="err"?"#991B1B":"#fff",padding:"8px 16px",fontSize:13,fontWeight:600,textAlign:"center"}}>{notice.msg}</div>}
      <div style={{padding:"18px 16px",maxWidth:900,margin:"0 auto"}}>{children}</div>
      {modal&&<ModalRoot/>}
    </div>;
  }

  function TaskCard({task,actions}){
    const [open,setOpen]=useState(false);
    const eq=EQUIPMENT.find(e=>e.id===task.equipment)||EQUIPMENT[0];
    const ca=CATEGORIES.find(c=>c.id===task.category)||CATEGORIES[0];
    const st=STATUS_MAP[task.status]||STATUS_MAP.scheduled;
    return (
      <div style={{background:"#fff",borderRadius:12,border:`1px solid ${SKY[100]}`,marginBottom:8,overflow:"hidden"}}>
        <div onClick={()=>setOpen(o=>!o)} style={{padding:"12px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}}>
          <Dot status={task.status}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                  {task.client&&<span style={{fontSize:11,fontWeight:700,color:SKY[700],background:SKY[50],padding:"1px 8px",borderRadius:6,border:`1px solid ${SKY[200]}`}}>🏢 {task.client}</span>}
                  <span style={{fontWeight:600,fontSize:14,color:SKY[900]}}>📍 {task.location}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:11,background:"#F8FAFC",color:"#475569",padding:"1px 7px",borderRadius:6,fontWeight:500,border:"1px solid #E2E8F0"}}>{eq.icon} {eq.label}</span>
                  <span style={{fontSize:11,color:"#94A3B8"}}>{ca.icon} {ca.label} · {task.scheduledDate}</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                <Pill label={st.label} status={task.status}/>
                {task.priority!=="normal"&&<Pill label={PRIORITY_MAP[task.priority]?.label} priority={task.priority} sm/>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
              {task.assignedTo&&<div style={{display:"flex",alignItems:"center",gap:5}}><Avt name={task.assignedTo} size={18}/><span style={{fontSize:11,color:"#64748B"}}>{task.assignedTo}</span></div>}
              {task.assignedBy&&<span style={{fontSize:11,color:"#CBD5E1"}}>· by {task.assignedBy}</span>}
              {task.reassignedBy&&<span style={{fontSize:11,color:SKY[400]}}>· reassigned by {task.reassignedBy}</span>}
              {(task.comments||[]).length>0&&<span style={{fontSize:11,color:SKY[500]}}>💬 {task.comments.length}</span>}
              {task.report&&<span style={{fontSize:11,color:"#10B981"}}>📋 reported</span>}
            </div>
          </div>
          <span style={{color:"#CBD5E1",fontSize:13,marginTop:2}}>{open?"▾":"›"}</span>
        </div>
        {open&&(
          <div style={{borderTop:`1px solid ${SKY[100]}`,padding:"12px 16px",background:SKY[50]}}>
            {task.description&&<InfoRow label="Task" val={task.description}/>}
            {task.notes&&<InfoRow label="Notes" val={task.notes}/>}
            {(task.comments||[]).length>0&&(
              <div style={{margin:"10px 0"}}>
                <div style={{fontSize:11,fontWeight:700,color:SKY[600],marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Comments</div>
                {task.comments.map((c,i)=>(
                  <div key={i} style={{background:"#fff",border:`1px solid ${SKY[200]}`,borderRadius:8,padding:"8px 10px",marginBottom:5,display:"flex",gap:8}}>
                    <Avt name={c.by} size={20}/>
                    <div style={{flex:1}}>
                      <span style={{fontSize:11,fontWeight:600,color:SKY[700]}}>{c.by}</span>
                      {c.role&&<span style={{marginLeft:5,fontSize:10,padding:"1px 5px",borderRadius:8,background:SKY[100],color:SKY[600]}}>{c.role}</span>}
                      <span style={{fontSize:10,color:"#94A3B8",marginLeft:5}}>{new Date(c.at).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                      <div style={{fontSize:12,color:"#334155",marginTop:2}}>{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {task.report&&(
              <div style={{background:"#fff",border:"1px solid #D1FAE5",borderRadius:10,padding:"11px 14px",marginTop:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#065F46",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>📋 Field Report — {task.report.by}</div>
                {[["Findings",task.report.findings],["Action taken",task.report.action],["Parts used",task.report.parts],["Next visit",task.report.nextVisit]].filter(([,v])=>v).map(([k,v])=><InfoRow key={k} label={k} val={v}/>)}
                <div style={{fontSize:10,color:"#94A3B8",marginTop:4}}>{new Date(task.report.at).toLocaleString()}</div>
              </div>
            )}
            {actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{actions(task)}</div>}
          </div>
        )}
      </div>
    );
  }

  function ModalRoot(){
    if(modal?.type==="assign")   return <AssignModal/>;
    if(modal?.type==="update")   return <UpdateModal task={modal.task}/>;
    if(modal?.type==="report")   return <ReportModal task={modal.task}/>;
    if(modal?.type==="view")     return <ViewModal task={modal.task}/>;
    if(modal?.type==="adduser")  return <AddUserModal/>;
    if(modal?.type==="edituser") return <EditUserModal user={modal.user}/>;
    if(modal?.type==="addsite")  return <AddSiteModal/>;
    return null;
  }

  function AssignModal(){
    const [f,setF]=useState({client:"",location:"",equipment:"cctv",category:"pm",priority:"normal",assignedTo:"",description:"",scheduledDate:todayStr(),notes:""});
    const set=(k,v)=>setF(p=>({...p,[k]:v}));
    const clientSites=sites.filter(s=>s.client===f.client);
    const ok=f.client&&f.location&&f.assignedTo;
    return <Overlay title="Assign New Task" onClose={()=>setModal(null)} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <Fld label="Client" required><select value={f.client} onChange={e=>{set("client",e.target.value);set("location","");}} style={inp}><option value="">— Select Client —</option>{clients.map(c=><option key={c}>{c}</option>)}</select></Fld>
        <Fld label="Site / Location" required><select value={f.location} onChange={e=>set("location",e.target.value)} style={inp} disabled={!f.client}><option value="">— Select Site —</option>{clientSites.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></Fld>
        <Fld label="Equipment Type"><select value={f.equipment} onChange={e=>set("equipment",e.target.value)} style={inp}>{EQUIPMENT.map(e=><option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}</select></Fld>
        <Fld label="Task Category"><select value={f.category} onChange={e=>set("category",e.target.value)} style={inp}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></Fld>
        <Fld label="Assign to Technician" required><select value={f.assignedTo} onChange={e=>set("assignedTo",e.target.value)} style={inp}><option value="">— Select —</option>{technicians.map(t=><option key={t.id} value={t.displayName}>{t.displayName}</option>)}</select></Fld>
        <Fld label="Scheduled Date"><input type="date" value={f.scheduledDate} onChange={e=>set("scheduledDate",e.target.value)} style={inp}/></Fld>
        <Fld label="Priority"><select value={f.priority} onChange={e=>set("priority",e.target.value)} style={inp}>{Object.entries(PRIORITY_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Fld>
        <div style={{gridColumn:"span 2"}}><Fld label="Description"><textarea value={f.description} onChange={e=>set("description",e.target.value)} placeholder="What needs to be done…" rows={2} style={{...inp,resize:"vertical"}}/></Fld></div>
        <div style={{gridColumn:"span 2"}}><Fld label="Notes for Technician"><input value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Access codes, instructions…" style={inp}/></Fld></div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn>
        <Btn disabled={!ok} onClick={()=>addTask(f)}>Assign Task</Btn>
      </div>
    </Overlay>;
  }

  function UpdateModal({task}){
    const [comment,setComment]=useState("");
    const [newTech,setNewTech]=useState(task.assignedTo);
    const reassigning=newTech!==task.assignedTo;
    return <Overlay title="Comment & Reassign" onClose={()=>setModal(null)} wide>
      <div style={{background:SKY[50],border:`1px solid ${SKY[200]}`,borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
        <Avt name={task.assignedTo} size={34}/>
        <div>{task.client&&<div style={{fontSize:11,fontWeight:700,color:SKY[600],marginBottom:2}}>🏢 {task.client}</div>}<div style={{fontWeight:600,fontSize:14,color:SKY[900]}}>📍 {task.location}</div><div style={{marginTop:4}}><Pill label={STATUS_MAP[task.status]?.label} status={task.status} sm/></div></div>
      </div>
      <Fld label="Add a Comment"><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Instructions, feedback, follow-up notes…" rows={3} style={{...inp,resize:"vertical"}}/></Fld>
      <Fld label="Reassign to Technician">
        <select value={newTech} onChange={e=>setNewTech(e.target.value)} style={{...inp,border:reassigning?`2px solid ${SKY[500]}`:undefined}}>
          {technicians.map(t=><option key={t.id} value={t.displayName}>{t.displayName}</option>)}
        </select>
      </Fld>
      {reassigning&&<div style={{background:SKY[50],border:`1px solid ${SKY[300]}`,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:SKY[700]}}>⚠️ Reassigning from <b>{task.assignedTo}</b> → <b>{newTech}</b>. Status resets to Scheduled.</div>}
      {(task.comments||[]).length>0&&<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#64748B",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Previous Comments</div>{task.comments.map((c,i)=><div key={i} style={{background:"#F8FAFC",borderRadius:8,padding:"6px 10px",marginBottom:4,fontSize:12,display:"flex",gap:8}}><Avt name={c.by} size={18}/><div><b style={{color:SKY[700]}}>{c.by}</b>{c.role&&<span style={{marginLeft:4,fontSize:10,padding:"1px 5px",borderRadius:8,background:SKY[100],color:SKY[600]}}>{c.role}</span>}<div style={{color:"#334155",marginTop:1}}>{c.text}</div></div></div>)}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn>
        <Btn disabled={!comment.trim()&&!reassigning} onClick={()=>doUpdate(task.id,comment,newTech)}>
          {reassigning&&comment.trim()?"Comment & Reassign":reassigning?"Reassign":comment.trim()?"Add Comment":"—"}
        </Btn>
      </div>
    </Overlay>;
  }

  function ReportModal({task}){
    const [f,setF]=useState({findings:"",action:"",parts:"",nextVisit:"",status:"completed"});
    const set=(k,v)=>setF(p=>({...p,[k]:v}));
    const comments=task.comments||[];
    return <Overlay title={`Report — ${task.client?task.client+" · ":""}${task.location}`} onClose={()=>setModal(null)}>
      {comments.length>0&&<div style={{background:SKY[50],border:`1px solid ${SKY[200]}`,borderRadius:10,padding:"10px 12px",marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:SKY[600],marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Instructions</div>{comments.map((c,i)=><div key={i} style={{fontSize:12,color:"#334155",marginBottom:2}}><b style={{color:SKY[700]}}>{c.by}:</b> {c.text}</div>)}</div>}
      <Fld label="Outcome" required><select value={f.status} onChange={e=>set("status",e.target.value)} style={inp}><option value="completed">✅ Completed</option><option value="issue">⚠️ Issue Found</option><option value="escalated">🔴 Escalated</option></select></Fld>
      <Fld label="Findings / Observations" required><textarea value={f.findings} onChange={e=>set("findings",e.target.value)} placeholder="Equipment condition, faults, observations…" rows={3} style={{...inp,resize:"vertical"}}/></Fld>
      <Fld label="Action Taken"><textarea value={f.action} onChange={e=>set("action",e.target.value)} placeholder="Repairs done, settings changed…" rows={2} style={{...inp,resize:"vertical"}}/></Fld>
      <Fld label="Parts / Materials Used"><input value={f.parts} onChange={e=>set("parts",e.target.value)} placeholder="e.g. IP camera ×1, CAT6 cable 10m…" style={inp}/></Fld>
      <Fld label="Next Visit Recommendation"><input value={f.nextVisit} onChange={e=>set("nextVisit",e.target.value)} placeholder="e.g. Within 2 weeks…" style={inp}/></Fld>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn>
        <Btn color="#059669" disabled={!f.findings} onClick={()=>doReport(task.id,f)}>Submit Report</Btn>
      </div>
    </Overlay>;
  }

  function ViewModal({task}){
    const eq=EQUIPMENT.find(e=>e.id===task.equipment)||EQUIPMENT[0]; const ca=CATEGORIES.find(c=>c.id===task.category)||CATEGORIES[0];
    return <Overlay title="Task Details" onClose={()=>setModal(null)} wide>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        <Pill label={STATUS_MAP[task.status]?.label} status={task.status}/>
        <span style={{fontSize:12,padding:"2px 9px",borderRadius:20,background:SKY[50],color:SKY[700],fontWeight:600,border:`1px solid ${SKY[200]}`}}>{eq.icon} {eq.label}</span>
        <span style={{fontSize:12,padding:"2px 9px",borderRadius:20,background:"#F8FAFC",color:"#64748B",fontWeight:500}}>{ca.icon} {ca.label}</span>
        {task.priority!=="normal"&&<Pill label={PRIORITY_MAP[task.priority]?.label} priority={task.priority}/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {[["Client",task.client||"—"],["Site",task.location||"—"],["Assigned to",task.assignedTo],["Assigned by",task.assignedBy||"—"],["Scheduled",task.scheduledDate],["Status",STATUS_MAP[task.status]?.label]].map(([k,v])=>(
          <div key={k} style={{background:SKY[50],borderRadius:8,padding:"9px 12px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>{k}</div><div style={{fontWeight:600,fontSize:13,color:SKY[900]}}>{v}</div></div>
        ))}
      </div>
      {task.description&&<InfoRow label="Description" val={task.description}/>}
      {task.notes&&<InfoRow label="Notes" val={task.notes}/>}
      {task.report&&<div style={{background:"#ECFDF5",border:"1px solid #D1FAE5",borderRadius:10,padding:"11px 14px",marginTop:8}}><div style={{fontSize:11,fontWeight:700,color:"#065F46",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>📋 Field Report — {task.report.by}</div>{[["Findings",task.report.findings],["Action taken",task.report.action],["Parts used",task.report.parts],["Next visit",task.report.nextVisit]].filter(([,v])=>v).map(([k,v])=><InfoRow key={k} label={k} val={v}/>)}<div style={{fontSize:10,color:"#94A3B8",marginTop:4}}>{new Date(task.report.at).toLocaleString()}</div></div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
        {(myRole==="manager"||myRole==="engineer")&&<Btn variant="danger" onClick={()=>{if(window.confirm("Delete this task?"))delTask(task.id);}}>Delete</Btn>}
        <Btn variant="ghost" onClick={()=>setModal(null)}>Close</Btn>
      </div>
    </Overlay>;
  }

  function AddSiteModal(){
    const [client,setClient]=useState(""); const [newClient,setNewClient]=useState(""); const [siteName,setSiteName]=useState("");
    const useNew=client==="__new__"; const finalClient=useNew?newClient.trim():client; const ok=finalClient&&siteName.trim();
    return <Overlay title="Add Site" onClose={()=>setModal(null)}>
      <Fld label="Client"><select value={client} onChange={e=>setClient(e.target.value)} style={{...inp,marginBottom:client==="__new__"?8:0}}><option value="">— Select existing client —</option>{clients.map(c=><option key={c} value={c}>{c}</option>)}<option value="__new__">+ New client…</option></select>{useNew&&<input value={newClient} onChange={e=>setNewClient(e.target.value)} placeholder="Enter new client name…" style={inp}/>}</Fld>
      <Fld label="Site / Location Name"><input value={siteName} onChange={e=>setSiteName(e.target.value)} placeholder="e.g. Main Gate, Floor 3…" style={inp}/></Fld>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn>
        <Btn disabled={!ok} onClick={async()=>{ await saveSiteList([...sites,{id:uid(),client:finalClient,name:siteName.trim()}]); setModal(null); flash(`Site added ✓`); }}>Add Site</Btn>
      </div>
    </Overlay>;
  }

  function AddUserModal(){
    const [f,setF]=useState({username:"",password:"",confirmPw:"",role:"technician",displayName:""});
    const set=(k,v)=>setF(p=>({...p,[k]:v}));
    const pwMatch=f.password===f.confirmPw&&f.password.length>=4;
    const exists=creds.some(c=>c.username.toLowerCase()===f.username.toLowerCase());
    const ok=f.username.trim()&&pwMatch&&f.displayName.trim()&&!exists;
    return <Overlay title="Create User Account" onClose={()=>setModal(null)}>
      <Fld label="Display Name" required><input value={f.displayName} onChange={e=>set("displayName",e.target.value)} placeholder="e.g. Eng. Ali or Tech. Khalid" style={inp}/></Fld>
      <Fld label="Role" required><select value={f.role} onChange={e=>set("role",e.target.value)} style={inp}><option value="engineer">Engineer</option><option value="technician">Technician</option></select></Fld>
      <Fld label="Username" required><input value={f.username} onChange={e=>set("username",e.target.value)} placeholder="e.g. ali.eng" style={inp} autoComplete="off"/></Fld>
      {exists&&f.username&&<div style={{fontSize:12,color:"#DC2626",marginTop:-8,marginBottom:8}}>⚠ Username already taken</div>}
      <Fld label="Password (min 4 chars)" required><PwInput value={f.password} onChange={e=>set("password",e.target.value)} placeholder="Set password"/></Fld>
      <Fld label="Confirm Password" required><PwInput value={f.confirmPw} onChange={e=>set("confirmPw",e.target.value)} placeholder="Confirm"/></Fld>
      {f.confirmPw&&!pwMatch&&<div style={{fontSize:12,color:"#DC2626",marginTop:-8,marginBottom:8}}>⚠ Don't match or too short</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn>
        <Btn disabled={!ok} onClick={async()=>{ await createUser(f); setModal(null); flash(`${f.displayName} created ✓`); }}>Create</Btn>
      </div>
    </Overlay>;
  }

  function EditUserModal({user}){
    const [pw,setPw]=useState(""); const [confirm,setConfirm]=useState(""); const [dName,setDName]=useState(user.displayName);
    const pwMatch=!pw||(pw===confirm&&pw.length>=4); const ok=dName.trim()&&pwMatch;
    return <Overlay title={`Edit — ${user.displayName}`} onClose={()=>setModal(null)}>
      <Fld label="Display Name"><input value={dName} onChange={e=>setDName(e.target.value)} style={inp}/></Fld>
      <Fld label="New Password (blank = keep)"><PwInput value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password…"/></Fld>
      {pw&&<Fld label="Confirm"><PwInput value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm…"/></Fld>}
      {pw&&!pwMatch&&<div style={{fontSize:12,color:"#DC2626",marginTop:-8,marginBottom:8}}>⚠ Don't match or too short</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        {user.role!=="manager"&&<Btn variant="danger" onClick={async()=>{ if(window.confirm(`Delete ${user.displayName}?`)){await deleteUser(user.id);setModal(null);flash(`Removed`);} }}>Delete</Btn>}
        <Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn>
        <Btn disabled={!ok} onClick={async()=>{ const ch={displayName:dName}; if(pw) ch.password=pw; await updateUser(user.id,ch); setModal(null); flash("Updated ✓"); }}>Save</Btn>
      </div>
    </Overlay>;
  }

  const updateAct=t=><><Btn variant="sky" onClick={()=>setModal({type:"update",task:t})}>💬 Comment / Reassign</Btn><Btn variant="ghost" onClick={()=>setModal({type:"view",task:t})}>View</Btn>{(myRole==="manager"||myRole==="engineer")&&<Btn variant="danger" onClick={()=>{if(window.confirm("Delete?"))delTask(t.id);}}>Delete</Btn>}</>;

  if((myRole==="manager"||myRole==="engineer")&&view==="overview"){
    const total=tasks.length,done=tasks.filter(t=>t.status==="completed").length,prog=tasks.filter(t=>t.status==="inprogress").length,issues=tasks.filter(t=>t.status==="issue"||t.status==="escalated").length,sched=tasks.filter(t=>t.status==="scheduled").length;
    const pct=total?Math.round(done/total*100):0;
    const todayT=tasks.filter(t=>t.scheduledDate===todayStr());
    return <Shell>
      <div style={{marginBottom:16}}><div style={{fontSize:20,fontWeight:700,color:SKY[900],marginBottom:2}}>Overview</div><div style={{fontSize:11,color:"#64748B"}}>{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}><StatCard label="Total" val={total}/><StatCard label="Scheduled" val={sched} accent="#64748B"/><StatCard label="In Progress" val={prog} accent="#D97706"/><StatCard label="Completed" val={done} accent="#059669"/><StatCard label="Issues" val={issues} accent="#DC2626"/></div>
      {total>0&&<div style={{background:"#fff",borderRadius:12,border:`1px solid ${SKY[100]}`,padding:"13px 16px",marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:600,color:SKY[900]}}>Overall completion</span><span style={{fontSize:13,fontWeight:700,color:SKY[600]}}>{pct}%</span></div><div style={{height:8,background:SKY[100],borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:SKY[500],borderRadius:8}}/></div></div>}
      <Sect title="By Client"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>{clients.map(cl=>{ const ct=tasks.filter(t=>t.client===cl); const d=ct.filter(t=>t.status==="completed").length; const i=ct.filter(t=>t.status==="issue"||t.status==="escalated").length; return <div key={cl} style={{background:"#fff",border:`1px solid ${i>0?"#FECACA":SKY[100]}`,borderRadius:10,padding:"12px 14px"}}><div style={{fontWeight:700,fontSize:13,color:SKY[900],marginBottom:3}}>🏢 {cl}</div><div style={{fontSize:11,color:"#94A3B8",marginBottom:6}}>{sites.filter(s=>s.client===cl).length} sites · {ct.length} tasks</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}><Pill label={`${d} done`} status="completed" sm/>{i>0&&<Pill label={`${i} issues`} status="issue" sm/>}</div></div>; })}{clients.length===0&&<div style={{fontSize:13,color:"#94A3B8",padding:"10px 0"}}>No clients yet.</div>}</div></Sect>
      <Sect title="By Equipment"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(108px,1fr))",gap:8}}>{EQUIPMENT.map(eq=>{ const n=tasks.filter(t=>t.equipment===eq.id).length; const c=tasks.filter(t=>t.equipment===eq.id&&t.status==="completed").length; return <div key={eq.id} style={{background:"#fff",borderRadius:10,border:`1px solid ${SKY[100]}`,padding:"11px",textAlign:"center"}}><div style={{fontSize:20,marginBottom:3}}>{eq.icon}</div><div style={{fontSize:10,fontWeight:700,color:SKY[700],marginBottom:4,lineHeight:1.3}}>{eq.label}</div><div style={{fontSize:18,fontWeight:700,color:SKY[900]}}>{n}</div><div style={{fontSize:10,color:"#94A3B8"}}>{c} done</div></div>; })}</div></Sect>
      <Sect title="Technicians"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:8}}>{technicians.map(tech=>{ const tt=tasks.filter(t=>t.assignedTo===tech.displayName); const d=tt.filter(t=>t.status==="completed").length; const p=tt.filter(t=>t.status==="inprogress").length; const s=tt.filter(t=>t.status==="scheduled").length; const i=tt.filter(t=>t.status==="issue"||t.status==="escalated").length; return <div key={tech.id} style={{background:"#fff",border:`1px solid ${i>0?"#FECACA":SKY[100]}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}><Avt name={tech.displayName} size={30}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:SKY[900]}}>{tech.displayName}</div><div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:4}}>{s>0&&<Pill label={`${s} sched`} sm/>}{p>0&&<Pill label={`${p} prog`} status="inprogress" sm/>}{d>0&&<Pill label={`${d} done`} status="completed" sm/>}{i>0&&<Pill label={`${i} iss`} status="issue" sm/>}{tt.length===0&&<span style={{fontSize:10,color:"#CBD5E1"}}>No tasks</span>}</div></div></div>; })}</div></Sect>
      {issues>0&&<Sect title="⚠ Needs Attention" count={issues} accent="#DC2626">{tasks.filter(t=>t.status==="issue"||t.status==="escalated").map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}</Sect>}
      {todayT.length>0&&<Sect title="Today" count={todayT.length}>{todayT.map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}</Sect>}
    </Shell>;
  }

  if((myRole==="manager"||myRole==="engineer")&&view==="alltasks"){
    const [sf,setSf]=useState({status:"all",client:"all",eq:"all",cat:"all"});
    const fil=tasks.filter(t=>{ if(sf.status!=="all"&&t.status!==sf.status)return false; if(sf.client!=="all"&&t.client!==sf.client)return false; if(sf.eq!=="all"&&t.equipment!==sf.eq)return false; if(sf.cat!=="all"&&t.category!==sf.cat)return false; return true; });
    const F=(k,v)=>setSf(f=>({...f,[k]:v}));
    return <Shell>
      <div style={{fontSize:20,fontWeight:700,color:SKY[900],marginBottom:12}}>All Tasks</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <select value={sf.status} onChange={e=>F("status",e.target.value)} style={inp}><option value="all">All statuses</option>{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
        <select value={sf.client} onChange={e=>F("client",e.target.value)} style={inp}><option value="all">All clients</option>{clients.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select value={sf.eq} onChange={e=>F("eq",e.target.value)} style={inp}><option value="all">All equipment</option>{EQUIPMENT.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select>
        <select value={sf.cat} onChange={e=>F("cat",e.target.value)} style={inp}><option value="all">All categories</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
      </div>
      <div style={{fontSize:11,color:"#94A3B8",marginBottom:12}}>{fil.length} of {tasks.length} tasks</div>
      {fil.length===0?<Empty msg="No tasks match filters."/>:fil.map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}
    </Shell>;
  }

  if((myRole==="manager"||myRole==="engineer")&&view==="assign"){
    const mine=myRole==="manager"?tasks:tasks.filter(t=>t.assignedBy===me);
    const openT=mine.filter(t=>t.status==="scheduled"||t.status==="inprogress");
    const issT=mine.filter(t=>t.status==="issue"||t.status==="escalated");
    const doneT=mine.filter(t=>t.status==="completed");
    return <Shell>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:20,fontWeight:700,color:SKY[900]}}>Assign Tasks</div>
        <button onClick={()=>setModal({type:"assign"})} style={{padding:"9px 18px",borderRadius:10,border:"none",background:SKY[600],color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+ New Task</button>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}><StatCard label="Assigned" val={mine.length}/><StatCard label="Open" val={openT.length} accent="#D97706"/><StatCard label="Issues" val={issT.length} accent="#DC2626"/><StatCard label="Done" val={doneT.length} accent="#059669"/></div>
      {issT.length>0&&<Sect title="Needs Attention" count={issT.length} accent="#DC2626">{issT.map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}</Sect>}
      {openT.length>0&&<Sect title="Active" count={openT.length}>{openT.map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}</Sect>}
      {doneT.length>0&&<Sect title="Completed" count={doneT.length}>{doneT.map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}</Sect>}
      {mine.length===0&&<Empty msg="No tasks yet. Tap + New Task." icon="📋"/>}
    </Shell>;
  }

  if((myRole==="manager"||myRole==="engineer")&&view==="reports"){
    const [period,setPeriod]=useState("month"); const [from,setFrom]=useState(""); const [to,setTo]=useState(""); const [fClient,setFClient]=useState("all"); const [fStatus,setFStatus]=useState("all"); const [fTech,setFTech]=useState("all");
    const filtered=tasks.filter(t=>{ if(!inPeriod(t,period,from,to))return false; if(fClient!=="all"&&t.client!==fClient)return false; if(fStatus!=="all"&&t.status!==fStatus)return false; if(fTech!=="all"&&t.assignedTo!==fTech)return false; return true; });
    const done=filtered.filter(t=>t.status==="completed").length; const issues=filtered.filter(t=>t.status==="issue"||t.status==="escalated").length; const withRep=filtered.filter(t=>t.report).length;
    const periodLabel={today:"Today",week:"This Week",month:"This Month",custom:"Custom Range"}[period]; const filename=`FieldReport_${periodLabel.replace(/\s/g,"")}_${todayStr()}`;
    return <Shell>
      <div style={{fontSize:20,fontWeight:700,color:SKY[900],marginBottom:14}}>Reports & Export</div>
      <div style={{background:"#fff",border:`1px solid ${SKY[100]}`,borderRadius:12,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:SKY[700],marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Time Period</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:period==="custom"?10:0}}>
          {[["today","Today"],["week","This Week"],["month","This Month"],["custom","Custom"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setPeriod(id)} style={{padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:period===id?700:500,background:period===id?SKY[600]:"#F1F5F9",color:period===id?"#fff":"#475569"}}>{lbl}</button>
          ))}
        </div>
        {period==="custom"&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8}}><div style={{flex:1,minWidth:140}}><Fld label="From"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp}/></Fld></div><div style={{flex:1,minWidth:140}}><Fld label="To"><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp}/></Fld></div></div>}
      </div>
      <div style={{background:"#fff",border:`1px solid ${SKY[100]}`,borderRadius:12,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:SKY[700],marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Filters</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <select value={fClient} onChange={e=>setFClient(e.target.value)} style={inp}><option value="all">All clients</option>{clients.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={inp}><option value="all">All statuses</option>{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <select value={fTech} onChange={e=>setFTech(e.target.value)} style={inp}><option value="all">All technicians</option>{technicians.map(t=><option key={t.id} value={t.displayName}>{t.displayName}</option>)}</select>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}><StatCard label="Total" val={filtered.length}/><StatCard label="Completed" val={done} accent="#059669" sub={`${filtered.length?Math.round(done/filtered.length*100):0}%`}/><StatCard label="Issues" val={issues} accent="#DC2626"/><StatCard label="With report" val={withRep} accent={SKY[600]}/></div>
      <div style={{background:"#fff",border:`1px solid ${SKY[100]}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:SKY[700],marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Export — {filtered.length} records · {periodLabel}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>{ if(!filtered.length)return; exportExcel(buildRows(filtered),filename+".xlsx"); }} disabled={!filtered.length} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:10,border:`1px solid ${SKY[200]}`,background:filtered.length?SKY[50]:"#F8FAFC",color:filtered.length?SKY[700]:"#CBD5E1",cursor:filtered.length?"pointer":"not-allowed",fontSize:13,fontWeight:600}}><span style={{fontSize:18}}>📊</span> Export to Excel (.xlsx)</button>
          <button onClick={()=>{ if(!filtered.length)return; exportWord(buildRows(filtered),`Field Report – ${periodLabel}`); }} disabled={!filtered.length} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:10,border:"1px solid #D1FAE5",background:filtered.length?"#ECFDF5":"#F8FAFC",color:filtered.length?"#065F46":"#CBD5E1",cursor:filtered.length?"pointer":"not-allowed",fontSize:13,fontWeight:600}}><span style={{fontSize:18}}>📝</span> Export to Word (.doc)</button>
        </div>
        {!filtered.length&&<div style={{fontSize:12,color:"#94A3B8",marginTop:8}}>No tasks match the selected period and filters.</div>}
      </div>
      {filtered.length>0&&<Sect title={`Preview — ${filtered.length} tasks`}>{filtered.slice(0,15).map(t=><TaskCard key={t.id} task={t} actions={updateAct}/>)}{filtered.length>15&&<div style={{textAlign:"center",fontSize:13,color:"#94A3B8",padding:"10px 0"}}>+{filtered.length-15} more in export</div>}</Sect>}
    </Shell>;
  }

  if((myRole==="manager"||myRole==="engineer")&&view==="sites"){
    return <Shell>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700,color:SKY[900]}}>Sites & Clients</div>
        <button onClick={()=>setModal({type:"addsite"})} style={{padding:"9px 18px",borderRadius:10,border:"none",background:SKY[600],color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+ Add Site</button>
      </div>
      {clients.length===0&&<Empty msg="No sites yet. Click + Add Site to get started." icon="🏢"/>}
      {clients.map(cl=>(
        <Sect key={cl} title={`🏢 ${cl}`} count={sites.filter(s=>s.client===cl).length}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            {sites.filter(s=>s.client===cl).map(s=>(
              <div key={s.id} style={{background:"#fff",border:`1px solid ${SKY[100]}`,borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>📍</span>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:SKY[900]}}>{s.name}</div><div style={{fontSize:10,color:"#94A3B8",marginTop:1}}>{tasks.filter(t=>t.client===cl&&t.location===s.name).length} tasks</div></div>
                {myRole==="manager"&&<button onClick={async()=>{ if(window.confirm(`Remove "${s.name}"?`)) await saveSiteList(sites.filter(x=>x.id!==s.id)); }} style={{background:"none",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:15,lineHeight:1}}>✕</button>}
              </div>
            ))}
          </div>
        </Sect>
      ))}
    </Shell>;
  }

  if(myRole==="manager"&&view==="accounts"){
    return <Shell>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700,color:SKY[900]}}>User Accounts</div>
        <button onClick={()=>setModal({type:"adduser"})} style={{padding:"9px 18px",borderRadius:10,border:"none",background:SKY[600],color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+ Create Account</button>
      </div>
      {[["👔 Manager",creds.filter(c=>c.role==="manager")],["👷 Engineers",creds.filter(c=>c.role==="engineer")],["🔧 Technicians",creds.filter(c=>c.role==="technician")]].map(([title,list])=>(
        <Sect key={title} title={title} count={list.length}>
          {list.length===0?<Empty msg="None yet."/>:list.map(u=>(
            <div key={u.id} style={{background:"#fff",border:`1px solid ${SKY[100]}`,borderRadius:10,padding:"11px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:12}}>
              <Avt name={u.displayName} size={34}/><div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:SKY[900]}}>{u.displayName}</div><div style={{fontSize:12,color:"#94A3B8"}}>@{u.username}</div></div>
              <Btn variant="sky" onClick={()=>setModal({type:"edituser",user:u})} style={{padding:"6px 12px",fontSize:12}}>Edit</Btn>
            </div>
          ))}
        </Sect>
      ))}
    </Shell>;
  }

  if(myRole==="technician"&&view==="mytasks"){
    const myT=tasks.filter(t=>t.assignedTo===me); const td=todayStr();
    const todayMine=myT.filter(t=>t.scheduledDate===td&&t.status!=="completed"&&t.status!=="issue"&&t.status!=="escalated");
    const inprog=myT.filter(t=>t.status==="inprogress"); const upcoming=myT.filter(t=>t.scheduledDate>td&&t.status==="scheduled");
    const hasComments=myT.some(t=>(t.comments||[]).length>0&&(t.status==="scheduled"||t.status==="inprogress"));
    const techAct=task=>{ const b=[<Btn key="u" variant="sky" onClick={()=>setModal({type:"update",task})}>💬 Comment / Reassign</Btn>]; if(task.status==="scheduled") b.push(<Btn key="s" color="#D97706" onClick={()=>startTask(task.id)}>▶ Start</Btn>); if(task.status==="inprogress"){b.push(<Btn key="r" color="#059669" onClick={()=>setModal({type:"report",task})}>✓ Report</Btn>);b.push(<Btn key="i" variant="ghost" onClick={()=>setModal({type:"report",task})}>⚠ Issue</Btn>);} return b; };
    return <Shell>
      <div style={{marginBottom:14}}><div style={{fontSize:20,fontWeight:700,color:SKY[900],marginBottom:2}}>My Tasks</div><div style={{fontSize:11,color:"#64748B"}}>{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>{hasComments&&<div style={{marginTop:8,background:SKY[50],border:`1px solid ${SKY[300]}`,borderRadius:8,padding:"7px 10px",fontSize:12,color:SKY[700]}}>💬 You have new comments — tap a task to read.</div>}</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}><StatCard label="Today" val={todayMine.length}/><StatCard label="In Progress" val={inprog.length} accent="#D97706"/><StatCard label="Upcoming" val={upcoming.length}/></div>
      {inprog.length>0&&<Sect title="In Progress" accent="#D97706">{inprog.map(t=><TaskCard key={t.id} task={t} actions={techAct}/>)}</Sect>}
      {todayMine.filter(t=>t.status!=="inprogress").length>0&&<Sect title="Today" count={todayMine.length}>{todayMine.filter(t=>t.status!=="inprogress").map(t=><TaskCard key={t.id} task={t} actions={techAct}/>)}</Sect>}
      {upcoming.length>0&&<Sect title="Upcoming">{upcoming.map(t=><TaskCard key={t.id} task={t} actions={techAct}/>)}</Sect>}
      {!inprog.length&&!todayMine.length&&!upcoming.length&&<Empty msg="No tasks assigned yet." icon="📅"/>}
    </Shell>;
  }

  if(myRole==="technician"&&view==="history"){
    const hist=tasks.filter(t=>t.assignedTo===me&&(t.status==="completed"||t.status==="issue"||t.status==="escalated")).sort((a,b)=>(b.report?.at||b.createdAt).localeCompare(a.report?.at||a.createdAt));
    return <Shell><div style={{fontSize:20,fontWeight:700,color:SKY[900],marginBottom:14}}>My History</div>{hist.length===0?<Empty msg="No completed tasks yet." icon="✅"/>:hist.map(t=><TaskCard key={t.id} task={t}/>)}</Shell>;
  }
  return null;
}

function Splash(){ return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F0F9FF"}}><div style={{textAlign:"center"}}><div style={{width:48,height:48,borderRadius:12,background:"#0284C7",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🛠️</div><div style={{color:"#0284C7",fontWeight:600,fontSize:14}}>Loading…</div></div></div>; }

function SetupScreen({onDone}){
  const [f,setF]=useState({username:"",password:"",confirmPw:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const pwMatch=f.password===f.confirmPw&&f.password.length>=4; const ok=f.username.trim()&&pwMatch;
  return <div style={{minHeight:"100vh",background:"#F0F9FF",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:400,background:"#fff",borderRadius:20,border:"1px solid #E0F2FE",padding:"32px 28px"}}>
      <div style={{textAlign:"center",marginBottom:28}}><div style={{width:56,height:56,borderRadius:16,background:"#0284C7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>🛠️</div><div style={{fontSize:20,fontWeight:700,color:"#0C4A6E",marginBottom:6}}>First-time Setup</div><div style={{fontSize:13,color:"#64748B",lineHeight:1.6}}>Create the <b>Manager account</b> to get started.</div></div>
      <Fld2 label="Manager Username"><input value={f.username} onChange={e=>set("username",e.target.value)} placeholder="e.g. manager" style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid #BAE6FD",fontSize:13,outline:"none",fontFamily:"inherit"}} autoComplete="off"/></Fld2>
      <Fld2 label="Password (min 4 characters)"><PwF value={f.password} onChange={e=>set("password",e.target.value)}/></Fld2>
      <Fld2 label="Confirm Password"><PwF value={f.confirmPw} onChange={e=>set("confirmPw",e.target.value)}/></Fld2>
      {f.confirmPw&&!pwMatch&&<div style={{fontSize:12,color:"#DC2626",marginBottom:10}}>⚠ Don't match or too short</div>}
      <button disabled={!ok} onClick={()=>ok&&onDone(f)} style={{width:"100%",padding:11,borderRadius:10,border:"none",background:ok?"#0284C7":"#CBD5E1",color:"#fff",cursor:ok?"pointer":"not-allowed",fontSize:14,fontWeight:700}}>Create Manager Account</button>
    </div>
  </div>;
}

function LoginScreen({onLogin,notice}){
  const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const go=async()=>{ if(!username.trim()||!password)return; setBusy(true); setErr(""); const ok=await onLogin(username,password); if(!ok){setErr("Incorrect username or password.");setPassword("");} setBusy(false); };
  return <div style={{minHeight:"100vh",background:"#F0F9FF",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:380,background:"#fff",borderRadius:20,border:"1px solid #E0F2FE",padding:"32px 28px"}}>
      <div style={{textAlign:"center",marginBottom:28}}><div style={{width:56,height:56,borderRadius:16,background:"#0284C7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>🛠️</div><div style={{fontSize:20,fontWeight:700,color:"#0C4A6E",marginBottom:4}}>Field Work Tracker</div><div style={{fontSize:12,color:"#94A3B8"}}>Sign in to your account</div></div>
      {notice?.msg&&<div style={{background:"#F0F9FF",color:"#0369A1",border:"1px solid #BAE6FD",borderRadius:8,padding:"9px 12px",fontSize:12,fontWeight:500,marginBottom:14,textAlign:"center"}}>{notice.msg}</div>}
      <Fld2 label="Username"><input value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Your username" style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid #BAE6FD",fontSize:13,outline:"none",fontFamily:"inherit"}} autoComplete="username"/></Fld2>
      <Fld2 label="Password"><PwF value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/></Fld2>
      {err&&<div style={{fontSize:12,color:"#DC2626",marginBottom:12,background:"#FEF2F2",padding:"7px 10px",borderRadius:6,border:"1px solid #FECACA"}}>{err}</div>}
      <button onClick={go} disabled={busy||!username.trim()||!password} style={{width:"100%",padding:11,borderRadius:10,border:"none",background:(busy||!username.trim()||!password)?"#CBD5E1":"#0284C7",color:"#fff",cursor:(busy||!username.trim()||!password)?"not-allowed":"pointer",fontSize:14,fontWeight:700}}>{busy?"Signing in…":"Sign In"}</button>
      <div style={{textAlign:"center",marginTop:14,fontSize:11,color:"#CBD5E1"}}>Contact your manager if you forgot your password.</div>
    </div>
  </div>;
}

function Fld2({label,children}){ return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:4,fontWeight:600}}>{label}</label>{children}</div>; }
function PwF({value,onChange,onKeyDown}){
  const [show,setShow]=useState(false);
  return <div style={{position:"relative"}}><input type={show?"text":"password"} value={value} onChange={onChange} onKeyDown={onKeyDown} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",paddingRight:38,borderRadius:8,border:"1px solid #BAE6FD",fontSize:13,outline:"none",fontFamily:"inherit"}} autoComplete="new-password"/><button type="button" onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:15}}>{show?"🙈":"👁️"}</button></div>;
}
