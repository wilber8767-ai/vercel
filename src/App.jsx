/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  郭華益 團隊業績管理系統  ─  React + Tailwind CSS + Supabase ║
 * ║  明亮高對比版  ·  115 年度官方校對工作月日期                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 環境變數（在 .env 設定，不要直接寫在程式碼裡）：
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key
 *
 * Supabase 資料表：sales_data
 *   欄位：agent_name (text PK), work_month (int2 PK),
 *          life_fyc (numeric), p_c_premium (numeric),
 *          is_active (bool), recruits (jsonb)
 *
 * Row Level Security 建議：
 *   啟用 RLS，並設定 policy 讓 anon 只能讀寫自己的資料列。
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ComposedChart,
} from "recharts";
import {
  Menu, X, Download, Target, TrendingUp, Award,
  LayoutDashboard, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Plus, Zap, Medal, Clock,
  CloudOff, Cloud, Loader2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// §0  SUPABASE CLIENT
//     金鑰從 import.meta.env 讀取，確保不寫死在程式碼裡
// ═══════════════════════════════════════════════════════════════

const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL  ?? "";
const SUPA_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const TABLE     = "sales_data";

// createClient 只在 URL + KEY 都存在時初始化，否則回傳 null
const supabase = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

/**
 * 從 Supabase 讀取所有業績，轉換成 allPerf 格式
 * key = member.id（如 "GHY"），不是姓名
 * { [member_id]: [[life_fyc, p_c_premium], ...] × 12 }
 */
async function fetchAllPerf(members) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)               // sales_data
    .select("agent_name, work_month, life_fyc, p_c_premium");

  if (error) {
    console.error("[supabase] fetchAllPerf error:", error.message);
    return null;
  }

  console.log("抓到的雲端資料:", data);   // ← 偵錯用，確認雲端有東西

  // 建立「姓名 → member.id」的對照表（確保對齊）
  const nameToId = {};
  for (const m of members) nameToId[m.name] = m.id;

  const result = {};
  for (const row of data) {
    const memberId = nameToId[row.agent_name];
    if (!memberId) {
      console.warn("[fetch] 未知姓名，跳過:", row.agent_name);
      continue;
    }
    if (!result[memberId]) result[memberId] = Array(12).fill(null).map(() => [0, 0]);
    const mi = Number(row.work_month) - 1;   // 強制轉 Number，DB 1-12 → array 0-11
    if (mi >= 0 && mi < 12) {
      result[memberId][mi] = [Number(row.life_fyc) || 0, Number(row.p_c_premium) || 0];
    }
  }
  console.log("[fetch] 轉換後 allPerf:", result);
  return result;
}

/**
 * 從 Supabase 讀取 meta（recruits, is_active），轉換成 allMeta 格式
 */
async function fetchAllMeta(members) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("agent_name, work_month, is_active, recruits");

  if (error) {
    console.error("[supabase] fetchAllMeta error:", error.message);
    return null;
  }

  const nameToId = {};
  for (const m of members) nameToId[m.name] = m.id;

  const result = {};
  for (const row of data) {
    const memberId = nameToId[row.agent_name];
    if (!memberId) continue;
    if (!result[memberId]) result[memberId] = {};
    // work_month=1 那一行存放 meta
    if (Number(row.work_month) === 1 && row.recruits) {
      try {
        result[memberId].recruits = typeof row.recruits === "string"
          ? JSON.parse(row.recruits)
          : row.recruits;
      } catch {
        result[memberId].recruits = [];
      }
    }
  }
  return result;
}

/**
 * 將單一業績格更新至 Supabase（upsert）
 * PK: (agent_name, work_month) — onConflict 陣列格式確保覆蓋不重複新增
 */
async function upsertPerfRow(agentName, workMonth, lifeFyc, pcPremium) {
  if (!supabase) {
    alert("錯誤原因：Supabase 未初始化，請確認環境變數 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
    return;
  }
  console.log("[supabase] upsert perf →", { agentName, workMonth, lifeFyc, pcPremium });

  const { data, error } = await supabase
    .from(TABLE)                          // 'sales_data'
    .upsert(
      {
        agent_name:  agentName,           // 姓名
        work_month:  workMonth,           // 月份 (1-12)
        life_fyc:    lifeFyc,             // 壽險業績
        p_c_premium: pcPremium,           // 產險保費
      },
      { onConflict: ["agent_name", "work_month"] }   // ← 陣列格式，確保覆蓋
    )
    .select();

  if (error) {
    console.error("[supabase] upsert error:", error);
    alert("錯誤原因：" + error.message);
  } else {
    console.log("[supabase] upsert ok:", data);
    alert("儲存成功");
  }
}

/**
 * 將 meta（recruits / is_active）更新至 Supabase
 * 寫入 work_month=1 那一行
 */
async function upsertMetaRow(agentName, meta) {
  if (!supabase) {
    console.warn("[supabase] client not initialised — check env vars");
    return;
  }
  console.log("[supabase] upsert meta →", agentName);

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        agent_name: agentName,            // 姓名
        work_month: 1,                    // meta 行固定存在第1月
        recruits:   JSON.stringify(meta.recruits ?? []),  // 增員人數
        is_active:  meta.isActive ?? true,                // 是否實動
      },
      { onConflict: ["agent_name", "work_month"] }
    )
    .select();

  if (error) console.error("[supabase] meta upsert error:", error.message, error.details);
  else       console.log("[supabase] meta upsert ok:", data);
}

// Debounce helper — stable ref pattern prevents stale closures & timer leaks
function useDebounce(fn, delay=800) {
  const timer  = useRef(null);
  const fnRef  = useRef(fn);
  // Keep fnRef always pointing at latest fn without re-creating the debounced fn
  useEffect(() => { fnRef.current = fn; });
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { fnRef.current(...args); }, delay);
  }, [delay]);  // only re-create if delay changes
}


// ═══════════════════════════════════════════════════════════════
// §1  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const WORK_MONTHS = [
  { wm:1,  mi:0,  start:"2025-12-27", end:"2026-01-26", close:"2026-02-05",  label:"第1月",  short:"1"  },
  { wm:2,  mi:1,  start:"2026-01-27", end:"2026-02-25", close:"2026-03-07",  label:"第2月",  short:"2"  },
  { wm:3,  mi:2,  start:"2026-02-26", end:"2026-03-25", close:"2026-04-04",  label:"第3月",  short:"3"  },
  { wm:4,  mi:3,  start:"2026-03-26", end:"2026-04-27", close:"2026-05-07",  label:"第4月",  short:"4"  },
  { wm:5,  mi:4,  start:"2026-04-28", end:"2026-05-25", close:"2026-06-04",  label:"第5月",  short:"5"  },
  { wm:6,  mi:5,  start:"2026-05-26", end:"2026-06-25", close:"2026-07-05",  label:"第6月",  short:"6"  },
  { wm:7,  mi:6,  start:"2026-06-26", end:"2026-07-27", close:"2026-08-06",  label:"第7月",  short:"7"  },
  { wm:8,  mi:7,  start:"2026-07-28", end:"2026-08-25", close:"2026-09-04",  label:"第8月",  short:"8"  },
  { wm:9,  mi:8,  start:"2026-08-26", end:"2026-09-29", close:"2026-10-09",  label:"第9月",  short:"9"  },
  { wm:10, mi:9,  start:"2026-09-30", end:"2026-10-27", close:"2026-11-06",  label:"第10月", short:"10" },
  { wm:11, mi:10, start:"2026-10-28", end:"2026-11-25", close:"2026-12-05",  label:"第11月", short:"11" },
  { wm:12, mi:11, start:"2026-11-26", end:"2026-12-28", close:"2027-01-07",  label:"第12月", short:"12" },
];

const ROLES = {
  "CA":   { label:"行銷專員",  isManager:false, target:null,  overriding:null },
  "SP-A": { label:"業務主任", isManager:true,  target:33000, overriding:0.10 },
  "AM-A": { label:"業務襄理", isManager:true,  target:44000, overriding:0.11 },
  "UM-A": { label:"業務經理", isManager:true,  target:55000, overriding:0.13 },
};

// Role accent colors (vivid, readable on white)
const ROLE_COLOR  = { "CA":"#0ea5e9", "SP-A":"#7c3aed", "AM-A":"#059669", "UM-A":"#d97706" };
const ROLE_BG     = { "CA":"#e0f2fe", "SP-A":"#ede9fe", "AM-A":"#d1fae5", "UM-A":"#fef3c7" };
const ROLE_BORDER = { "CA":"#7dd3fc", "SP-A":"#c4b5fd", "AM-A":"#6ee7b7", "UM-A":"#fcd34d" };

const BASE_SALARY = {
  "SP-A":[[1.00,12900,null],[0.85,9400,null],[0.70,6500,null],[0.60,4500,null],[0,null,0.10]],
  "AM-A":[[1.00,13750,null],[0.85,11550,null],[0.70,9350,null],[0.60,7150,null],[0,null,0.12]],
  "UM-A":[[1.00,20350,null],[0.85,16500,null],[0.70,12900,null],[0.60,9350,null],[0,null,0.14]],
};

const FYC_TIERS = [
  [900000,0.200,"≥90萬"],[700000,0.175,"≥70萬"],[500000,0.150,"≥50萬"],
  [400000,0.125,"≥40萬"],[300000,0.100,"≥30萬"],[200000,0.080,"≥20萬"],
  [120000,0.060,"≥12萬"],[ 80000,0.040,"≥8萬" ],[0,0,"未達標"],
];

const Q_TIERS = [
  [150000,0.18,">15萬"],[120000,0.15,">12萬"],[90000,0.12,">9萬"],
  [60000,0.10,">6萬"],[40000,0.05,">4萬"],[0,0,"未達標"],
];

const DEFAULT_MEMBERS = [
  { id:"GHY", name:"郭華益", role:"UM-A", parentId:null },
  { id:"CLM", name:"陳立閔", role:"SP-A", parentId:"GHY" },
  { id:"ZYJ", name:"鄭宇倢", role:"CA",   parentId:"GHY" },
  { id:"ZYX", name:"張永璇", role:"CA",   parentId:"GHY" },
  { id:"LWC", name:"李偉誠", role:"SP-A", parentId:"GHY" },
  { id:"ZCX", name:"鍾承修", role:"CA",   parentId:"LWC" },
  { id:"LGY", name:"林冠佑", role:"CA",   parentId:"ZCX" },
];

const LS = { PERF:"sps_perf_v1", META:"sps_meta_v1", MEMBERS:"sps_members_v1" };

// ═══════════════════════════════════════════════════════════════
// §2  HELPERS
// ═══════════════════════════════════════════════════════════════

const safe   = (v) => Math.max(0, Number(v) || 0);
const sumArr = (a) => a.reduce((s,v) => s+v, 0);
const emptyPerf = () => Array(12).fill(null).map(() => [0,0]);

function fmt(n, compact=true) {
  if (n === 0) return "–";
  if (compact && n >= 10000) return `${(n/10000).toFixed(1)}萬`;
  return n.toLocaleString("zh-TW");
}
function toRoc(iso) {
  const [y,m,d] = iso.split("-");
  return `${+y-1911}/${m}/${d}`;
}
function getCurrentWM() {
  const today = new Date(); today.setHours(0,0,0,0);
  for (const wm of WORK_MONTHS) {
    const s = new Date(wm.start), e = new Date(wm.end); e.setHours(23,59,59);
    if (today >= s && today <= e) return wm;
  }
  return today < new Date(WORK_MONTHS[0].start) ? WORK_MONTHS[0] : WORK_MONTHS.at(-1);
}
function getWMProgress() {
  const wm = getCurrentWM();
  const s  = new Date(wm.start).getTime();
  const e  = new Date(wm.end).getTime() + 86399999;
  return Math.min(1, Math.max(0, (Date.now()-s)/(e-s)));
}
function activityBonus(m, role) {
  if (role==="CA") return m>=20000?2000:m>=10000?1000:0;
  return m>=20000?1000:0;
}
function calcBaseSalary(dgm, role) {
  const tiers=BASE_SALARY[role]; if(!tiers) return {salary:0,pct:0};
  const t=ROLES[role].target, ach=t?dgm/t:0;
  for (const [minR,amt,rate] of tiers)
    if (ach>=minR) return {salary:rate?Math.round(dgm*rate):amt, pct:Math.round(ach*100)};
  return {salary:0,pct:0};
}
function calcOverriding(ftm, role) {
  const c=ROLES[role]; if(!c.overriding||!c.target) return 0;
  return ftm>c.target?Math.round((ftm-c.target)*c.overriding):0;
}
function getFycTier(total, newcomer=false) {
  const eff=newcomer?total*2:total;
  return FYC_TIERS.find(([m])=>eff>=m)??FYC_TIERS.at(-1);
}
function getQTier(qt) { return Q_TIERS.find(([m])=>qt>=m)??Q_TIERS.at(-1); }

function lsGet(k,fb) { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} }
function lsSet(k,v)  { try{localStorage.setItem(k,JSON.stringify(v));}catch{} }

// ═══════════════════════════════════════════════════════════════
// §3  SHARED UI ATOMS (light theme)
// ═══════════════════════════════════════════════════════════════

// White card with strong border
function Card({ className="", children, ...p }) {
  return (
    <div className={`bg-white rounded-2xl border-2 border-gray-200 shadow-md ${className}`} {...p}>
      {children}
    </div>
  );
}

// Role badge
function Badge({ role }) {
  return (
    <span className="text-sm font-bold px-2.5 py-1 rounded-full"
      style={{ background:ROLE_BG[role], color:ROLE_COLOR[role], border:`2px solid ${ROLE_BORDER[role]}` }}>
      {ROLES[role]?.label ?? role}
    </span>
  );
}

// Progress bar
function ProgBar({ value, max=1, color="#2563eb", thick=false, className="" }) {
  const pct = Math.min(100, max>0?(value/max)*100:0);
  return (
    <div className={`w-full rounded-full overflow-hidden bg-gray-200 ${thick?"h-4":"h-2.5"} ${className}`}>
      <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:color}}/>
    </div>
  );
}

// Number input optimised for mobile (font-size 16px prevents iOS zoom)
function NumInput({ value, onChange, color="#2563eb" }) {
  const [draft, setDraft] = useState(String(value||""));
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{ if(!focused) setDraft(String(value||"")); },[value,focused]);
  const commit=()=>{ const n=Math.max(0,Number(draft)||0); setDraft(String(n||"")); onChange(n); };
  return (
    <input ref={ref} type="number" inputMode="decimal" min="0"
      value={draft} placeholder="0"
      onChange={e=>setDraft(e.target.value)}
      onFocus={()=>setFocused(true)}
      onBlur={()=>{ setFocused(false); commit(); }}
      onKeyDown={e=>{ if(e.key==="Enter") ref.current?.blur(); }}
      className="w-full rounded-xl border-2 text-right font-mono font-bold text-slate-900 outline-none transition-all py-3 px-4"
      style={{
        fontSize:16,
        borderColor: focused ? color : "#d1d5db",
        boxShadow:   focused ? `0 0 0 4px ${color}20` : "none",
        background:  "#f9fafb",
        WebkitAppearance:"none",
      }}/>
  );
}

// Recharts tooltip on white bg
function ChartTip({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-gray-500 font-medium mb-1">{label}</p>
      {payload.map((p,i)=>(
        <div key={i} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{background:p.color}}/>
          <span className="text-slate-700 font-medium">{p.name}</span>
          <span className="font-bold ml-auto" style={{color:p.color}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Section header with left accent bar
function SectionHead({ color="#2563eb", children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1.5 h-7 rounded-full shrink-0" style={{background:color}}/>
      <h3 className="text-xl font-bold text-slate-900">{children}</h3>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §4  WORK-MONTH CARD (collapsible)
// ═══════════════════════════════════════════════════════════════

function WMCard({ wm, perf, onUpdate, role, isCurrent }) {
  const [open, setOpen] = useState(isCurrent);
  const life    = safe(perf?.[wm.mi]?.[0]);
  const nonLife = safe(perf?.[wm.mi]?.[1]);
  const total   = life+nonLife;
  const ab      = activityBonus(total, role);

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden
      ${isCurrent
        ? "border-blue-400 shadow-lg shadow-blue-100 bg-blue-50"
        : "border-gray-200 bg-white hover:border-gray-300 shadow-sm"}`}>

      {/* Header row */}
      <button className="w-full flex items-center gap-4 px-5 py-4 text-left" onClick={()=>setOpen(v=>!v)}>
        {/* WM label */}
        <div className="shrink-0 w-24">
          <div className={`text-lg font-bold ${isCurrent?"text-blue-700":"text-slate-700"}`}>
            {wm.label}
            {isCurrent && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">本月</span>}
          </div>
          <div className="text-sm text-gray-500 font-mono mt-0.5">{toRoc(wm.start).slice(3)}</div>
        </div>

        {/* Mini stacked bar + summary */}
        <div className="flex-1 min-w-0">
          {total > 0 ? (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 mb-1.5">
                {life>0    && <div style={{width:`${Math.round(life/total*100)}%`,    background:"#2563eb"}}/>}
                {nonLife>0 && <div style={{width:`${Math.round(nonLife/total*100)}%`, background:"#059669"}}/>}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-bold text-slate-900 tabular-nums">{fmt(total)}</span>
                <span className="text-sm text-gray-500">壽{fmt(life)} 產{fmt(nonLife)}</span>
              </div>
            </>
          ) : (
            <span className="text-base text-gray-400">尚未輸入</span>
          )}
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-2 shrink-0">
          {ab>0 && (
            <span className="text-sm font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-300">
              實動 +{ab/1000}K
            </span>
          )}
          {open
            ? <ChevronUp  size={20} className="text-gray-400"/>
            : <ChevronDown size={20} className="text-gray-400"/>}
        </div>
      </button>

      {/* Expanded inputs */}
      {open && (
        <div className="border-t-2 border-gray-100 px-5 py-5 bg-white">
          {/* Date info */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-base">
            <span className="text-gray-500">受理：
              <span className="font-semibold text-slate-800 ml-1">{toRoc(wm.start)} ～ {toRoc(wm.end)}</span>
            </span>
            <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
              ⚠ 結案截止 {toRoc(wm.close)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-base font-bold text-blue-700 mb-2 block">壽險業績</label>
              <NumInput value={life}    color="#2563eb" onChange={v=>onUpdate(wm.mi,0,v)}/>
            </div>
            <div>
              <label className="text-base font-bold text-green-700 mb-2 block">產險業績</label>
              <NumInput value={nonLife} color="#059669" onChange={v=>onUpdate(wm.mi,1,v)}/>
            </div>
          </div>

          {total>0 && (
            <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
              <span className="text-base font-semibold text-gray-600">本月合計</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-slate-900 tabular-nums">{fmt(total)}</span>
                {ab>0 && <span className="text-base font-bold text-green-600">實動津貼 +{ab.toLocaleString()}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §5  PAGE: PERF INPUT
// ═══════════════════════════════════════════════════════════════

function PagePerf({ member, perf, onUpdate, meta }) {
  const curWM  = getCurrentWM();
  const prog   = getWMProgress();
  const yearL  = sumArr(perf.map(r=>safe(r[0])));
  const yearNL = sumArr(perf.map(r=>safe(r[1])));
  const yearT  = yearL+yearNL;
  const mTgt   = (meta.lifeTarget||0)+(meta.nlTarget||0);
  const curMT  = safe(perf[curWM.mi]?.[0])+safe(perf[curWM.mi]?.[1]);
  const should = mTgt*prog;

  const chartData = WORK_MONTHS.map(wm=>({
    name:wm.short, 壽險:safe(perf[wm.mi]?.[0]), 產險:safe(perf[wm.mi]?.[1]),
  }));

  return (
    <div className="space-y-6">
      {/* KPI strip — large numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:"年度壽險",   val:yearL,  color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
          { label:"年度產險",   val:yearNL, color:"#059669", bg:"#f0fdf4", border:"#bbf7d0" },
          { label:"年度總績效", val:yearT,  color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
        ].map(k=>(
          <div key={k.label} className="rounded-2xl border-2 px-6 py-5"
            style={{background:k.bg, borderColor:k.border}}>
            <p className="text-base font-semibold text-gray-500 mb-1">{k.label}</p>
            <p className="text-5xl font-black tabular-nums" style={{color:k.color}}>{fmt(k.val)}</p>
          </div>
        ))}
      </div>

      {/* Current WM progress card */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={20} className="text-blue-600"/>
          <h3 className="text-xl font-bold text-slate-900">{curWM.label} 工作月進度</h3>
          <span className="ml-auto text-lg font-bold text-blue-600">{Math.round(prog*100)}% 已過</span>
        </div>
        {/* Progress track */}
        <div className="relative mb-5 h-5 rounded-full overflow-hidden bg-gray-200">
          <div className="h-full rounded-full bg-blue-200 transition-all duration-700" style={{width:`${prog*100}%`}}/>
          <div className="absolute top-0 h-full w-1 bg-amber-500 rounded-full pointer-events-none"
            style={{left:`${prog*100}%`}}/>
        </div>
        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500 mb-1">受理區間</p>
            <p className="text-base font-bold text-slate-800">{toRoc(curWM.start)}</p>
            <p className="text-base font-bold text-slate-800">～ {toRoc(curWM.end)}</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-gray-500 mb-1">結案截止</p>
            <p className="text-lg font-black text-red-600">{toRoc(curWM.close)}</p>
          </div>
          {mTgt>0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500 mb-1">本月進度</p>
              <p className="text-lg font-black tabular-nums"
                style={{color:curMT>=should?"#059669":"#dc2626"}}>
                {fmt(curMT)}
              </p>
              <p className="text-sm text-gray-400">應達 {fmt(should)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Bar chart */}
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-xl font-bold text-slate-900">115 年度月度業績</h3>
          <div className="ml-auto flex items-center gap-4 text-sm font-medium text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"/>壽險</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"/>產險</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{top:4,right:4,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
            <XAxis dataKey="name" tick={{fontSize:13,fill:"#6b7280",fontWeight:600}}/>
            <YAxis tick={{fontSize:12,fill:"#6b7280"}} tickFormatter={v=>v>=10000?`${v/10000}萬`:v}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="壽險" stackId="a" fill="#2563eb"/>
            <Bar dataKey="產險" stackId="a" fill="#059669" radius={[4,4,0,0]}/>
            {mTgt>0 && (
              <ReferenceLine y={mTgt} stroke="#d97706" strokeWidth={2} strokeDasharray="5 5"
                label={{value:"月均目標",position:"right",fontSize:12,fill:"#d97706",fontWeight:700}}/>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly WM cards */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">月份業績輸入</h3>
        <div className="space-y-3">
          {WORK_MONTHS.map(wm=>(
            <WMCard key={wm.wm} wm={wm} perf={perf} onUpdate={onUpdate}
              role={member.role} isCurrent={wm.wm===curWM.wm}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §6  PAGE: TARGETS
// ═══════════════════════════════════════════════════════════════

function PageTargets({ member, perf, meta, onMetaUpdate }) {
  const yearL  = sumArr(perf.map(r=>safe(r[0])));
  const yearNL = sumArr(perf.map(r=>safe(r[1])));
  const yearT  = yearL+yearNL;
  const isNew  = meta.isNewcomer||false;
  const [fycR,,fycLbl] = getFycTier(yearT,isNew);
  const fycBonus = Math.round(yearT*fycR);
  const mTgt   = (meta.lifeTarget||0)+(meta.nlTarget||0);
  const filled = perf.filter(r=>safe(r[0])+safe(r[1])>0).length;
  const avgAct = filled>0?yearT/filled:0;
  const recTgt = meta.recruitTarget||0;
  const recs   = meta.recruits||[];
  const nextTier = FYC_TIERS.find(([m])=>(isNew?yearT*2:yearT)<m&&m>0);
  const fycChart = FYC_TIERS.slice(0,-1).map(([m,r,lbl])=>({
    name:lbl, 門檻:m, passed:(isNew?yearT*2:yearT)>=m,
  }));

  return (
    <div className="space-y-6">
      {/* Target settings */}
      <Card className="p-6">
        <SectionHead color="#d97706">115 年度個人目標設定</SectionHead>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          {[
            {label:"月均壽險目標",key:"lifeTarget",   color:"#2563eb"},
            {label:"月均產險目標",key:"nlTarget",     color:"#059669"},
            {label:"年度增員目標 (人)",key:"recruitTarget",color:"#7c3aed"},
          ].map(f=>(
            <div key={f.key}>
              <label className="text-base font-bold mb-2 block" style={{color:f.color}}>{f.label}</label>
              <NumInput value={meta[f.key]||0} color={f.color}
                onChange={v=>onMetaUpdate({...meta,[f.key]:v})}/>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isNew}
            onChange={e=>onMetaUpdate({...meta,isNewcomer:e.target.checked})}
            className="w-5 h-5 accent-blue-600"/>
          <span className="text-base font-medium text-slate-700">未滿一年新人（FYC 門檻減半）</span>
        </label>
      </Card>

      {/* Indicator 1 */}
      <Card className="p-6">
        <SectionHead color="#2563eb">指標一：個人月均業績</SectionHead>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            {label:"目標月均",val:mTgt,    color:"#2563eb"},
            {label:"實際月均",val:avgAct,  color:avgAct>=mTgt?"#059669":"#dc2626"},
            {label:"達成率",  val:null,    color:mTgt>0&&avgAct>=mTgt?"#059669":"#1e293b"},
          ].map((k,i)=>(
            <div key={i} className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-4">
              <p className="text-sm text-gray-500 mb-1 font-medium">{k.label}</p>
              {k.val!==null
                ? <p className="text-3xl font-black tabular-nums" style={{color:k.color}}>{fmt(k.val)}</p>
                : <p className="text-3xl font-black" style={{color:k.color}}>
                    {mTgt>0?`${Math.round(avgAct/mTgt*100)}%`:"–"}
                  </p>}
            </div>
          ))}
        </div>
        {mTgt>0 && <ProgBar value={avgAct} max={mTgt} color={avgAct>=mTgt?"#059669":"#2563eb"} thick/>}
      </Card>

      {/* Indicator 2: FYC */}
      <Card className="p-6">
        <SectionHead color="#7c3aed">指標二：年度累計 FYC</SectionHead>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-5xl font-black text-slate-900 tabular-nums">{fmt(yearT)}</p>
            <p className="text-lg text-gray-500 mt-1">
              壽 <span className="font-bold text-blue-600">{fmt(yearL)}</span>
              　產 <span className="font-bold text-green-600">{fmt(yearNL)}</span>
            </p>
          </div>
          {fycR>0 && (
            <div className="text-right bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4">
              <p className="text-sm text-gray-500 font-medium">FYC 年終加成</p>
              <p className="text-4xl font-black text-amber-600">{(fycR*100).toFixed(1)}%</p>
              <p className="text-base font-bold text-green-600">${fycBonus.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Stacked progress bar with tier ticks */}
        <div className="relative mb-7">
          <div className="h-5 rounded-full overflow-hidden bg-gray-200">
            <div className="h-full flex">
              <div style={{width:`${Math.min(100,yearL/9000)}%`,background:"#2563eb"}}/>
              <div style={{width:`${Math.min(100-yearL/9000,yearNL/9000)}%`,background:"#059669"}}/>
            </div>
          </div>
          {FYC_TIERS.slice(0,-1).map(([m,,lbl])=>{
            const x=m/900000*100;
            const passed=(isNew?yearT*2:yearT)>=m;
            return (
              <div key={m} className="absolute top-0 flex flex-col items-center pointer-events-none"
                style={{left:`${x}%`,transform:"translateX(-50%)"}}>
                <div className="w-0.5 h-5" style={{background:passed?"#7c3aed":"#d1d5db"}}/>
                <span className="text-xs font-bold mt-0.5 whitespace-nowrap"
                  style={{color:passed?"#7c3aed":"#9ca3af"}}>{lbl}</span>
              </div>
            );
          })}
        </div>

        {/* Tier bar chart */}
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={fycChart} margin={{top:0,right:4,left:-20,bottom:0}}>
            <XAxis dataKey="name" tick={{fontSize:11,fill:"#6b7280",fontWeight:600}}/>
            <Tooltip content={({active,payload})=>active&&payload?.[0]?(
              <div className="bg-white border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-mono">
                {payload[0].payload.name}: {fmt(payload[0].payload.門檻)}
              </div>
            ):null}/>
            <Bar dataKey="門檻" radius={[4,4,0,0]}>
              {fycChart.map((d,i)=><Cell key={i} fill={d.passed?"#059669":"#e5e7eb"}/>)}
            </Bar>
            <ReferenceLine y={isNew?yearT*2:yearT} stroke="#2563eb" strokeWidth={2}
              label={{value:"目前",fontSize:11,fill:"#2563eb",fontWeight:700}}/>
          </BarChart>
        </ResponsiveContainer>

        {nextTier && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <Zap size={18} className="text-amber-600 shrink-0"/>
            <span className="text-base text-gray-600">距離
              <span className="font-bold text-amber-700 mx-1">{nextTier[2]} ({(nextTier[1]*100).toFixed(1)}%)</span>
              還差
            </span>
            <span className="font-black text-xl text-amber-700 ml-auto tabular-nums">
              {fmt(isNew?(nextTier[0]-yearT*2)/2:nextTier[0]-yearT)}
            </span>
          </div>
        )}
      </Card>

      {/* Indicator 3: Recruits */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <SectionHead color="#059669">指標三：年度增員</SectionHead>
          <button className="flex items-center gap-2 text-base font-bold text-green-700 bg-green-50 border border-green-300 px-4 py-2 rounded-xl hover:bg-green-100 transition-colors"
            onClick={()=>{
              const name=prompt("增員姓名："); if(!name?.trim()) return;
              const mo=Math.max(0,Math.min(11,(parseInt(prompt("增員月份(1-12)：")||"1")-1)));
              onMetaUpdate({...meta,recruits:[...(meta.recruits||[]),{name:name.trim(),month:mo,role:"CA",id:Date.now()}]});
            }}>
            <Plus size={16}/>新增增員
          </button>
        </div>
        <div className="flex items-end gap-6 mb-4">
          <div>
            <p className="text-6xl font-black text-slate-900 tabular-nums">{recs.length}</p>
            <p className="text-base text-gray-500 font-medium">已增員人數</p>
          </div>
          <div className="text-4xl text-gray-300 mb-2">/</div>
          <div>
            <p className="text-6xl font-black text-gray-400 tabular-nums">{recTgt||"?"}</p>
            <p className="text-base text-gray-500 font-medium">年度目標</p>
          </div>
          {recTgt>0 && (
            <div className="ml-auto text-right">
              <p className="text-4xl font-black tabular-nums"
                style={{color:recs.length>=recTgt?"#059669":"#1e293b"}}>
                {Math.round(recs.length/recTgt*100)}%
              </p>
              <p className="text-base text-gray-500">達成率</p>
            </div>
          )}
        </div>
        {recTgt>0 && <ProgBar value={recs.length} max={recTgt} color={recs.length>=recTgt?"#059669":"#2563eb"} thick className="mb-5"/>}
        {recs.length>0 && (
          <div className="space-y-2">
            {recs.map(r=>(
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black shrink-0"
                  style={{background:ROLE_BG[r.role],color:ROLE_COLOR[r.role],border:`2px solid ${ROLE_BORDER[r.role]}`}}>
                  {r.name[0]}
                </div>
                <span className="text-base font-semibold text-slate-800 flex-1">{r.name}</span>
                <span className="text-sm text-gray-500 font-medium">{WORK_MONTHS[r.month]?.label}</span>
                <button onClick={()=>onMetaUpdate({...meta,recruits:recs.filter(x=>x.id!==r.id)})}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"><X size={16}/></button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §7  PAGE: BONUS
// ═══════════════════════════════════════════════════════════════

function PageBonus({ member, perf, meta, members, allPerf }) {
  const role  = member.role;
  const yearT = sumArr(perf.map(r=>safe(r[0])+safe(r[1])));
  const isNew = meta.isNewcomer||false;
  const quarters=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]].map((mis,qi)=>{
    const qt=sumArr(mis.map(mi=>safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
    const [,rate,lbl]=getQTier(qt);
    return {label:`Q${qi+1}`,total:qt,rate,tierLabel:lbl,bonus:Math.round(qt*rate)};
  });
  const act  = sumArr(perf.map(r=>activityBonus(safe(r[0])+safe(r[1]),role)));
  const qB   = sumArr(quarters.map(q=>q.bonus));
  const ye   = Math.round(act*0.18);
  const [fycR,,fycLbl]=getFycTier(yearT,isNew);
  const fycB = Math.round(yearT*fycR);
  const pers = act+qB+ye+fycB;
  const isMgr=ROLES[role]?.isManager;
  let bsY=0,ovY=0;
  if(isMgr){
    const cas=members.filter(m=>m.parentId===member.id&&m.role==="CA");
    bsY=sumArr(Array(12).fill(0).map((_,mi)=>{
      const dgm=sumArr([member.id,...cas.map(c=>c.id)].map(id=>safe(allPerf[id]?.[mi]?.[0])+safe(allPerf[id]?.[mi]?.[1])));
      return calcBaseSalary(dgm,role).salary;
    }));
    ovY=sumArr(Array(12).fill(0).map((_,mi)=>{
      const ftm=sumArr(members.map(m2=>safe(allPerf[m2.id]?.[mi]?.[0])+safe(allPerf[m2.id]?.[mi]?.[1])));
      return calcOverriding(ftm,role);
    }));
  }
  const grand=pers+bsY+ovY;

  return (
    <div className="space-y-6">
      {/* Q cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {quarters.map(q=>(
          <div key={q.label} className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl font-black text-slate-900">{q.label}</span>
              <span className="text-sm font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                {q.tierLabel}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums mb-2">{fmt(q.total)}</p>
            <ProgBar value={q.total} max={150000} color="#d97706" thick className="mb-2"/>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">季獎金</span>
              <span className="font-black text-amber-700 tabular-nums">{q.bonus.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Personal section */}
      <Card className="p-6">
        <SectionHead color="#2563eb">個人部分</SectionHead>
        <div className="space-y-3">
          {[
            {label:"實動津貼",       val:act,  sub:"10K→1,000 / 20K→2,000", color:"#059669",bg:"#f0fdf4",bd:"#bbf7d0"},
            {label:"季獎金合計",     val:qB,   sub:"四季累計 5%–18%",         color:"#7c3aed",bg:"#f5f3ff",bd:"#c4b5fd"},
            {label:"個人年終 (×18%)",val:ye,   sub:"以年度實動金為基準",       color:"#0ea5e9",bg:"#f0f9ff",bd:"#7dd3fc"},
            {label:`FYC年終 (${fycLbl})`,val:fycB,sub:`${(fycR*100).toFixed(1)}% 加成`,color:"#d97706",bg:"#fffbeb",bd:"#fde68a"},
          ].map(item=>(
            <div key={item.label} className="flex items-center justify-between px-5 py-4 rounded-xl border-2"
              style={{background:item.bg,borderColor:item.bd}}>
              <div>
                <p className="text-lg font-bold" style={{color:item.color}}>{item.label}</p>
                <p className="text-sm text-gray-500">{item.sub}</p>
              </div>
              <p className="text-2xl font-black tabular-nums" style={{color:item.color}}>
                ${item.val.toLocaleString()}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-4 rounded-xl border-2 border-blue-300 bg-blue-50">
            <span className="text-xl font-black text-blue-800">個人部分小計</span>
            <span className="text-3xl font-black text-blue-700 tabular-nums">${pers.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {isMgr && (
        <Card className="p-6">
          <SectionHead color="#d97706">團隊部分（主管）</SectionHead>
          <div className="space-y-3">
            {[
              {label:"年度基本薪",   val:bsY,color:"#d97706",bg:"#fffbeb",bd:"#fde68a"},
              {label:"年度超額獎金", val:ovY,color:"#ea580c",bg:"#fff7ed",bd:"#fdba74"},
            ].map(item=>(
              <div key={item.label} className="flex items-center justify-between px-5 py-4 rounded-xl border-2"
                style={{background:item.bg,borderColor:item.bd}}>
                <p className="text-lg font-bold" style={{color:item.color}}>{item.label}</p>
                <p className="text-2xl font-black tabular-nums" style={{color:item.color}}>
                  ${item.val.toLocaleString()}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-4 rounded-xl border-2 border-amber-300 bg-amber-50">
              <span className="text-xl font-black text-amber-800">團隊部分小計</span>
              <span className="text-3xl font-black text-amber-700 tabular-nums">${(bsY+ovY).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Grand total */}
      <div className="rounded-2xl border-4 border-amber-400 bg-gradient-to-br from-amber-50 to-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-gray-600 mb-1">年度預估總收入</p>
            <p className="text-base text-gray-400">
              個人 ${pers.toLocaleString()}
              {isMgr && ` ＋ 團隊 $${(bsY+ovY).toLocaleString()}`}
            </p>
          </div>
          <p className="text-5xl font-black text-amber-600 tabular-nums">${grand.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §8  PAGE: ASSESSMENT
// ═══════════════════════════════════════════════════════════════

function PageAssess({ member, perf, meta, onMetaUpdate }) {
  const role  = member.role;
  const isCA  = role==="CA";
  const isMgr = ["SP-A","AM-A","UM-A"].includes(role);

  // CA quarterly check
  const cycQ   = meta.cycleQ??0;
  const cases  = meta.caseCount??0;
  const mis    = [cycQ*3,cycQ*3+1,cycQ*3+2];
  const cycT   = sumArr(mis.map(mi=>safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
  const maxM   = Math.max(...mis.map(mi=>safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
  const perfOK = maxM>=10000||cycT>=45000;
  const casOK  = cases>=1;
  const caPass = perfOK&&casOK;

  // Manager 6-month
  const ATHR = {"SP-A":[160000,9],"AM-A":[220000,15],"UM-A":[280000,21]};
  const [pThr=0,fThr=0]=ATHR[role]??[];
  const cS  = meta.cycleStart??0;
  const mM  = Array.from({length:6},(_,i)=>cS+i).filter(i=>i<12);
  const mCT = sumArr(mM.map(mi=>safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
  const fte = meta.fteCount??0;
  const mgrP= mCT>=pThr&&fte>=fThr;

  const Stepper = ({value, onChange, label, max_=99}) => (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200">
      <span className="text-base font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={()=>onChange(Math.max(0,value-1))}
          className="w-10 h-10 rounded-xl bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xl flex items-center justify-center transition-colors">
          −
        </button>
        <span className="text-2xl font-black text-slate-900 w-12 text-center tabular-nums">{value}</span>
        <button onClick={()=>onChange(Math.min(max_,value+1))}
          className="w-10 h-10 rounded-xl bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xl flex items-center justify-center transition-colors">
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {isCA && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionHead color="#2563eb">三個月考核追蹤</SectionHead>
            {caPass
              ? <span className="flex items-center gap-2 text-lg font-bold text-green-700 bg-green-100 border-2 border-green-300 px-4 py-2 rounded-xl"><CheckCircle2 size={18}/>達標</span>
              : <span className="flex items-center gap-2 text-lg font-bold text-red-700 bg-red-100 border-2 border-red-300 px-4 py-2 rounded-xl"><AlertCircle size={18}/>未達標</span>}
          </div>

          {/* Quarter selector */}
          <div className="flex gap-2 mb-6">
            {["Q1","Q2","Q3","Q4"].map((q,i)=>(
              <button key={q} onClick={()=>onMetaUpdate({...meta,cycleQ:i})}
                className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all border-2
                  ${cycQ===i?"bg-blue-600 text-white border-blue-600 shadow-md":"bg-white text-slate-600 border-gray-200 hover:border-gray-300"}`}>
                {q}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-base font-semibold mb-2">
                <span className="text-gray-600">三月累計業績</span>
                <span style={{color:cycT>=45000?"#059669":"#dc2626"}} className="tabular-nums">
                  {fmt(cycT)} / 4.5萬
                  {cycT<45000 && <span className="ml-2">差 {fmt(45000-cycT)}</span>}
                </span>
              </div>
              <ProgBar value={cycT} max={45000} color={cycT>=45000?"#059669":"#2563eb"} thick/>
            </div>
            <div>
              <div className="flex justify-between text-base font-semibold mb-2">
                <span className="text-gray-600">單月最高業績</span>
                <span className={maxM>=10000?"text-green-600":"text-gray-500"}>
                  {fmt(maxM)} / 1萬 {maxM>=10000?"✓":""}
                </span>
              </div>
              <ProgBar value={maxM} max={10000} color={maxM>=10000?"#059669":"#d97706"}/>
            </div>
            <Stepper value={cases} onChange={v=>onMetaUpdate({...meta,caseCount:v})} label="累計件數 (需≥1件)"/>
          </div>

          <div className={`mt-5 px-5 py-4 rounded-xl border-2 text-lg font-bold text-center
            ${caPass?"bg-green-50 border-green-300 text-green-700":"bg-red-50 border-red-300 text-red-700"}`}>
            {caPass?"✓ 本週期三個月考核達標":`✗ 未達標：${!perfOK?"業績條件 ":""}${!casOK?"件數條件":""}`}
          </div>
        </Card>
      )}

      {isMgr && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionHead color="#d97706">六個月主管考核</SectionHead>
            {mgrP
              ? <span className="flex items-center gap-2 text-lg font-bold text-green-700 bg-green-100 border-2 border-green-300 px-4 py-2 rounded-xl"><CheckCircle2 size={18}/>達標</span>
              : <span className="flex items-center gap-2 text-lg font-bold text-gray-600 bg-gray-100 border-2 border-gray-300 px-4 py-2 rounded-xl"><AlertCircle size={18}/>未達標</span>}
          </div>

          <div className="flex gap-2 mb-6">
            {[{l:"前半年",v:0},{l:"後半年",v:6}].map(({l,v})=>(
              <button key={l} onClick={()=>onMetaUpdate({...meta,cycleStart:v})}
                className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all border-2
                  ${cS===v?"bg-amber-500 text-white border-amber-500 shadow-md":"bg-white text-slate-600 border-gray-200"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-base font-semibold mb-2">
                <span className="text-gray-600">直轄組六月累計</span>
                <span style={{color:mCT>=pThr?"#059669":"#dc2626"}} className="tabular-nums">
                  {fmt(mCT)} / {fmt(pThr)}
                  {mCT<pThr && <span className="ml-2">差 {fmt(pThr-mCT)}</span>}
                </span>
              </div>
              <ProgBar value={mCT} max={pThr} color={mCT>=pThr?"#059669":"#2563eb"} thick/>
            </div>
            <Stepper value={fte} onChange={v=>onMetaUpdate({...meta,fteCount:v})} label={`專職人數 (需≥${fThr}人)`} max_={99}/>
          </div>

          <div className={`mt-5 px-5 py-4 rounded-xl border-2 text-lg font-bold text-center
            ${mgrP?"bg-green-50 border-green-300 text-green-700":"bg-gray-50 border-gray-200 text-gray-600"}`}>
            {mgrP?"✓ 六個月主管考核達標":"❌ 考核條件尚未達標"}
          </div>
        </Card>
      )}

      {isCA && (
        <Card className="p-6">
          <SectionHead color="#059669">晉升業務主任追蹤</SectionHead>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-base font-semibold mb-2">
                <span className="text-gray-600">6個月累計 FYC（含增員貢獻）</span>
                <span className="tabular-nums" style={{color:(meta.promo_fyc||0)>=240000?"#059669":"#1e293b"}}>
                  {fmt(meta.promo_fyc||0)} / 24萬
                </span>
              </div>
              <NumInput value={meta.promo_fyc||0} color="#d97706"
                onChange={v=>onMetaUpdate({...meta,promo_fyc:v})}/>
              <ProgBar value={meta.promo_fyc||0} max={240000}
                color={(meta.promo_fyc||0)>=240000?"#059669":"#d97706"} thick className="mt-2"/>
            </div>
            <Stepper value={meta.promo_cases||0}
              onChange={v=>onMetaUpdate({...meta,promo_cases:v})} label="6個月累計件數 (需≥18件)" max_={99}/>
            <label className="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200">
              <input type="checkbox" checked={meta.promo_recruited||false}
                onChange={e=>onMetaUpdate({...meta,promo_recruited:e.target.checked})}
                className="w-5 h-5 accent-green-600"/>
              <span className="text-base font-medium text-slate-700">上月已完成增員晉升 1 人</span>
            </label>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §9  EXPORT CSV
// ═══════════════════════════════════════════════════════════════

function exportCSV(member, perf) {
  const rows=["工作月,受理起日,受理迄日,結案截止,壽險,產險,總業績"];
  WORK_MONTHS.forEach(wm=>{
    const l=safe(perf[wm.mi]?.[0]), nl=safe(perf[wm.mi]?.[1]);
    rows.push(`${wm.label},${toRoc(wm.start)},${toRoc(wm.end)},${toRoc(wm.close)},${l},${nl},${l+nl}`);
  });
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\uFEFF"+rows.join("\n")],{type:"text/csv;charset=utf-8"}));
  a.download=`業績_${member.name}_115年.csv`; a.click(); URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════
// §10  ROOT APP
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { id:"perf",   label:"業績",   icon:LayoutDashboard },
  { id:"target", label:"目標",   icon:Target },
  { id:"bonus",  label:"獎金",   icon:TrendingUp },
  { id:"assess", label:"考核",   icon:Award },
];

export default function App() {
  // ── Local state (initialised from localStorage as fallback) ──
  const [members,    setMembers]    = useState(()=>lsGet(LS.MEMBERS, DEFAULT_MEMBERS));
  const [allPerf,    setAllPerf]    = useState(()=>lsGet(LS.PERF, {}));
  const [allMeta,    setAllMeta]    = useState(()=>lsGet(LS.META, {}));
  const [selectedId, setSelectedId] = useState(()=>lsGet(LS.MEMBERS, DEFAULT_MEMBERS)[0]?.id??"");
  const [tab,        setTab]        = useState("perf");
  const [sideOpen,   setSideOpen]   = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Cloud sync state ──────────────────────────────────────────
  const [cloudStatus, setCloudStatus] = useState(supabase?"loading":"offline");
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState(null); // { text, isError }

  const showToast = useCallback((text, isError=false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  // ── Boot: fetch from Supabase, apply over localStorage ──────
  useEffect(()=>{
    if(!supabase){
      console.warn("[supabase] No client — VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing");
      return;
    }
    console.log("[supabase] client ready, TABLE =", TABLE);
    (async()=>{
      try{
        // 1. Connection test
        const test = await supabase.from(TABLE).select("agent_name").limit(1);
        if(test.error) throw test.error;
        console.log("[supabase] connection OK ✓");

        // 2. Fetch — pass members so name→id mapping works
        const currentMembers = lsGet(LS.MEMBERS, DEFAULT_MEMBERS);
        console.log("[supabase] fetching with member list:", currentMembers.map(m=>`${m.name}(${m.id})`));

        const [cp, cm] = await Promise.all([
          fetchAllPerf(currentMembers),
          fetchAllMeta(currentMembers),
        ]);

        if (cp) {
          console.log("[supabase] allPerf loaded:", cp);
          setAllPerf(cp);
          lsSet(LS.PERF, cp);
        } else {
          console.warn("[supabase] fetchAllPerf returned null");
        }

        if (cm) {
          setAllMeta(prev => {
            const merged = { ...prev };
            Object.entries(cm).forEach(([id, m]) => { merged[id] = { ...prev[id], ...m }; });
            lsSet(LS.META, merged);
            return merged;
          });
        }

        console.log("[supabase] boot complete ✓");
        setCloudStatus("ok");
      }catch(e){
        console.error("[supabase] boot error:", e.message ?? e);
        showToast(`連線失敗：${e.message ?? e}`, true);
        setCloudStatus("error");
      }
    })();
  },[]);


  // ── Direct upsert helpers (no debounce — fires on every commit) ──
  const syncPerf = useCallback(async (agentName, workMonth, life, pc) => {
    setSyncing(true);
    try {
      await upsertPerfRow(agentName, workMonth, life, pc);
    } catch(e) {
      showToast(`儲存失敗：${e.message}`, true);
    } finally {
      setSyncing(false);
    }
  }, [showToast]);

  const syncMeta = useCallback(async (agentName, meta) => {
    setSyncing(true);
    try {
      await upsertMetaRow(agentName, meta);
    } catch(e) {
      showToast(`Meta 儲存失敗：${e.message}`, true);
    } finally {
      setSyncing(false);
    }
  }, [showToast]);

  // ── updatePerf: write localStorage then immediately upsert ───
  const updatePerf = useCallback((mi, col, val) => {
    const agentName = members.find(m => m.id === selectedId)?.name ?? selectedId;
    // Capture both columns after update so upsert gets the full row
    let life = 0, pc = 0;
    setAllPerf(prev => {
      const next = { ...prev };
      const row  = (next[selectedId] ?? emptyPerf()).map(r => [...r]);
      row[mi][col] = val;
      next[selectedId] = row;
      lsSet(LS.PERF, next);
      life = Number(row[mi][0]) || 0;
      pc   = Number(row[mi][1]) || 0;
      return next;
    });
    // Fire upsert immediately after state update queued
    // Use setTimeout(0) so the closure above runs first and captures latest values
    setTimeout(() => {
      syncPerf(agentName, mi + 1, life, pc)
        .catch(e => console.error("[updatePerf] sync failed:", e));
    }, 0);
  }, [selectedId, members, syncPerf]);

  // ── updateMeta: write localStorage then immediately upsert ───
  const updateMeta = useCallback(nm => {
    const agentName = members.find(m => m.id === selectedId)?.name ?? selectedId;
    setAllMeta(prev => {
      const next = { ...prev, [selectedId]: nm };
      lsSet(LS.META, next);
      return next;
    });
    setTimeout(() => {
      syncMeta(agentName, nm).catch(e => console.error("[updateMeta] sync failed:", e));
    }, 0);
  }, [selectedId, members, syncMeta]);

  const member = members.find(m=>m.id===selectedId)??members[0];
  const perf   = allPerf[selectedId]??emptyPerf();
  const meta   = allMeta[selectedId]??{};
  const curWM  = getCurrentWM();
  const globalL  = members.reduce((s,m)=>s+sumArr((allPerf[m.id]??emptyPerf()).map(r=>safe(r[0]))),0);
  const globalNL = members.reduce((s,m)=>s+sumArr((allPerf[m.id]??emptyPerf()).map(r=>safe(r[1]))),0);

  const pageProps = {member,perf,meta,onMetaUpdate:updateMeta,members,allPerf};
  const page = useMemo(()=>{
    if(tab==="perf")   return <PagePerf   {...pageProps} onUpdate={updatePerf}/>;
    if(tab==="target") return <PageTargets {...pageProps}/>;
    if(tab==="bonus")  return <PageBonus   {...pageProps}/>;
    if(tab==="assess") return <PageAssess  {...pageProps}/>;
    return null;
  },[tab,selectedId,perf,meta,allPerf]);

  useEffect(()=>setDrawerOpen(false),[selectedId,tab]);

  // ── Cloud status badge ────────────────────────────────────────
  const CloudBadge = ()=>{
    const cfgs={
      loading:{ icon:<Loader2 size={15} className="animate-spin"/>, text:"連線中",  cls:"text-blue-600 bg-blue-50 border-blue-200" },
      ok:     { icon:<Cloud    size={15}/>,                          text:"已同步",  cls:"text-green-700 bg-green-50 border-green-200" },
      error:  { icon:<CloudOff size={15}/>,                          text:"離線",    cls:"text-red-600 bg-red-50 border-red-200" },
      offline:{ icon:<CloudOff size={15}/>,                          text:"本機模式",cls:"text-gray-500 bg-gray-50 border-gray-200" },
    };
    const cfg=cfgs[cloudStatus]??cfgs.offline;
    return (
      <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-semibold ${cfg.cls}`}>
        {syncing?<Loader2 size={15} className="animate-spin"/>:cfg.icon}
        {syncing?"同步中…":cfg.text}
      </div>
    );
  };

  // ── Loading screen ────────────────────────────────────────────
  if(cloudStatus==="loading"){
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg px-10 py-10 text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-4"/>
          <p className="text-xl font-bold text-slate-900 mb-1">正在從雲端載入資料</p>
          <p className="text-base text-gray-500">連接 Supabase 中，請稍候…</p>
        </div>
      </div>
    );
  }

  // ── Sidebar content ───────────────────────────────────────────
  const SideContent = ()=>(
    <div className="flex flex-col h-full">
      <div className="p-4 border-b-2 border-gray-200">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">成員選擇</p>
        <div className="space-y-1">
          {members.map(m=>{
            const mt=sumArr((allPerf[m.id]??emptyPerf()).map(r=>safe(r[0])+safe(r[1])));
            const sel=m.id===selectedId;
            return (
              <button key={m.id} onClick={()=>setSelectedId(m.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all border-2
                  ${sel?"border-current shadow-sm":"border-transparent hover:border-gray-200 hover:bg-gray-50"}`}
                style={sel?{background:ROLE_BG[m.role],borderColor:ROLE_BORDER[m.role]}:{}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                  style={{background:ROLE_BG[m.role],color:ROLE_COLOR[m.role],border:`2px solid ${ROLE_BORDER[m.role]}`}}>
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-slate-900 truncate">{m.name}</p>
                  <p className="text-sm font-medium" style={{color:ROLE_COLOR[m.role]}}>{ROLES[m.role]?.label}</p>
                </div>
                {mt>0&&<span className="text-sm font-bold tabular-nums shrink-0" style={{color:ROLE_COLOR[m.role]}}>{fmt(mt)}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <nav className="p-4 flex-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">功能選單</p>
        <div className="space-y-1">
          {NAV.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all border-2 text-lg font-semibold
                ${tab===id?"bg-blue-50 text-blue-700 border-blue-300 shadow-sm":"text-slate-600 border-transparent hover:bg-gray-50 hover:border-gray-200"}`}>
              <Icon size={20}/>{label}
            </button>
          ))}
        </div>
      </nav>
      <div className="p-4 border-t-2 border-gray-200 bg-gray-50">
        <p className="text-base font-bold text-slate-700 mb-1">{curWM.label} · {Math.round(getWMProgress()*100)}% 已過</p>
        <ProgBar value={getWMProgress()} color="#2563eb" thick className="mb-2"/>
        <p className="text-sm font-bold text-red-600">結案截止 {toRoc(curWM.close)}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 text-slate-900 font-sans">

      {/* ── 頂部讀取中提示條 ── */}
      {cloudStatus === "loading" && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-1 bg-blue-200 overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse" style={{width:"60%"}}/>
          </div>
          <div className="flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold py-1.5">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            讀取中…正在從雲端載入資料
          </div>
        </div>
      )}
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 md:px-6 py-4 bg-white border-b-2 border-gray-200 shadow-sm">
        <button className="flex w-11 h-11 rounded-xl items-center justify-center text-slate-600 hover:bg-gray-100 hover:text-slate-900 border-2 border-gray-200 transition-all"
          onClick={()=>{ setSideOpen(v=>!v); setDrawerOpen(v=>!v); }} aria-label="開啟/關閉選單">
          <Menu size={22}/>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-2 h-10 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 shrink-0"/>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">郭華益 團隊</h1>
            <p className="text-sm text-gray-500 font-medium leading-none mt-0.5">115 年度業績管理系統</p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-6 ml-auto">
          {[{l:"全團壽險",v:globalL,c:"#2563eb"},{l:"全團產險",v:globalNL,c:"#059669"},{l:"全團總績效",v:globalL+globalNL,c:"#d97706"}].map(s=>(
            <div key={s.l} className="text-right">
              <p className="text-sm text-gray-500 font-medium leading-none">{s.l}</p>
              <p className="text-2xl font-black tabular-nums leading-none mt-0.5" style={{color:s.c}}>{fmt(s.v)}</p>
            </div>
          ))}
        </div>
        <div className="ml-auto lg:ml-3 flex items-center gap-2">
          <CloudBadge/>
          <button className="flex items-center gap-2 text-base font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all"
            onClick={()=>exportCSV(member,perf)}>
            <Download size={18}/><span className="hidden sm:inline">匯出 CSV</span>
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100svh-73px)]">
        {/* Desktop sidebar */}
        <aside className={`hidden md:flex flex-col shrink-0 overflow-hidden transition-all duration-300 border-r-2 border-gray-200 bg-white ${sideOpen?"w-72":"w-0"}`}>
          <div className="w-72 overflow-y-auto h-full"><SideContent/></div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen&&(
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={()=>setDrawerOpen(false)}/>
            <div className="relative z-10 w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col" style={{animation:"slideInLeft 0.25s ease-out"}}>
              <div className="flex items-center justify-between px-4 py-4 border-b-2 border-gray-200">
                <h2 className="text-xl font-black text-slate-900">選單</h2>
                <button onClick={()=>setDrawerOpen(false)} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 border-2 border-gray-200"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto"><SideContent/></div>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-gray-100">
          <div className="px-4 md:px-6 py-5 pb-28 md:pb-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-6 bg-white rounded-2xl border-2 border-gray-200 shadow-sm px-5 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
                style={{background:ROLE_BG[member?.role],color:ROLE_COLOR[member?.role],border:`3px solid ${ROLE_BORDER[member?.role]}`}}>
                {member?.name[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-black text-slate-900">{member?.name}</h2>
                  <Badge role={member?.role}/>
                </div>
                <p className="text-base text-gray-500 font-medium mt-0.5">{ROLES[member?.role]?.label}</p>
              </div>
              <div className="hidden sm:flex md:hidden items-center gap-1">
                {NAV.map(({id,icon:Icon})=>(
                  <button key={id} onClick={()=>setTab(id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${tab===id?"bg-blue-50 text-blue-600 border-blue-300":"text-gray-400 border-transparent hover:border-gray-200"}`}>
                    <Icon size={18}/>
                  </button>
                ))}
              </div>
            </div>
            {page}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-white border-t-2 border-gray-200 shadow-lg"
        style={{paddingBottom:"env(safe-area-inset-bottom,0)"}}>
        {NAV.map(({id,label,icon:Icon})=>{
          const active=tab===id;
          return (
            <button key={id} onClick={()=>setTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
              style={{color:active?"#2563eb":"#6b7280",minHeight:60}}>
              <Icon size={22}/>
              <span className="text-sm font-bold">{label}</span>
              {active&&<div className="w-6 h-1 rounded-full bg-blue-600"/>}
            </button>
          );
        })}
      </nav>

      {/* ── Corner cloud status badge ── */}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
        {/* Toast notification */}
        {toastMsg && (
          <div className={`pointer-events-auto px-4 py-2.5 rounded-xl border-2 shadow-lg text-sm font-semibold
            transition-all animate-fade-in
            ${toastMsg.isError
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-green-50 border-green-300 text-green-700"}`}>
            {toastMsg.text}
          </div>
        )}
        {/* Persistent status pill */}
        <div className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5
          ${cloudStatus==="ok" && !syncing ? "bg-green-50 border-green-300 text-green-700"
          : cloudStatus==="error"          ? "bg-red-50 border-red-200 text-red-500"
          : cloudStatus==="offline"        ? "bg-gray-50 border-gray-200 text-gray-500"
          :                                  "bg-blue-50 border-blue-200 text-blue-600"}`}>
          <span className={`w-2 h-2 rounded-full inline-block ${
            cloudStatus==="ok" && !syncing ? "bg-green-500"
            : cloudStatus==="error"        ? "bg-red-400"
            : cloudStatus==="offline"      ? "bg-gray-400"
            :                               "bg-blue-500 animate-pulse"}`}/>
          {syncing            ? "同步中…"
           : cloudStatus==="ok"      ? "雲端已連線"
           : cloudStatus==="error"   ? "連線失敗"
           : cloudStatus==="offline" ? "本機模式"
           :                          "連線中"}
        </div>
      </div>

      <style>{`
        @keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
