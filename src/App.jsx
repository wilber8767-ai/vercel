/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  郭華益 團隊業績管理系統  ─  React + Tailwind CSS + Recharts ║
 * ║  115 年度 (2026)  ·  官方校對工作月日期                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ── 雲端對接預留區 ────────────────────────────────────────────
 * 目前使用 localStorage；串接雲端時只需替換下方兩個函式：
 *
 *   const API_ENDPOINT = "https://your-api.example.com/v1";
 *
 *   async function cloudGet(key) {
 *     const res = await fetch(`${API_ENDPOINT}/${key}`, {
 *       headers: { Authorization: `Bearer ${import.meta.env.VITE_API_TOKEN}` },
 *     });
 *     return res.ok ? res.json() : null;
 *   }
 *
 *   async function cloudSet(key, data) {
 *     await fetch(`${API_ENDPOINT}/${key}`, {
 *       method: "PUT",
 *       headers: { "Content-Type": "application/json",
 *                  Authorization: `Bearer ${import.meta.env.VITE_API_TOKEN}` },
 *       body: JSON.stringify(data),
 *     });
 *   }
 *
 *   // 然後把 lsGet / lsSet 的呼叫改成 await cloudGet / cloudSet
 * ──────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ComposedChart,
} from "recharts";
import {
  LayoutDashboard, TrendingUp, Award, Target,
  ChevronDown, ChevronUp, Download, Settings,
  X, Plus, CheckCircle2, AlertCircle, Clock, Zap, Medal,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cx = (...a) => twMerge(clsx(...a));

// ═══════════════════════════════════════════════════════════════
// §1  CONSTANTS — 115 年度官方工作月（已校對）
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

const ROLE_COLOR = {
  "CA":"#38bdf8", "SP-A":"#a78bfa", "AM-A":"#34d399", "UM-A":"#fbbf24",
};

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
const sumArr = (a) => a.reduce((s, v) => s + v, 0);
const emptyPerf = () => Array(12).fill(null).map(() => [0, 0]);

function fmt(n, compact = true) {
  if (n === 0) return "–";
  if (compact && n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString("zh-TW");
}

function toRoc(iso) {
  const [y, m, d] = iso.split("-");
  return `${+y - 1911}/${m}/${d}`;
}

function getCurrentWM() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const wm of WORK_MONTHS) {
    const s = new Date(wm.start), e = new Date(wm.end); e.setHours(23, 59, 59);
    if (today >= s && today <= e) return wm;
  }
  return today < new Date(WORK_MONTHS[0].start) ? WORK_MONTHS[0] : WORK_MONTHS.at(-1);
}

function getWMProgress() {
  const wm = getCurrentWM();
  const s = new Date(wm.start).getTime();
  const e = new Date(wm.end).getTime() + 86399999;
  return Math.min(1, Math.max(0, (Date.now() - s) / (e - s)));
}

// ── Bonus engine ─────────────────────────────────────────────────
function activityBonus(monthly, role) {
  if (role === "CA") return monthly >= 20000 ? 2000 : monthly >= 10000 ? 1000 : 0;
  return monthly >= 20000 ? 1000 : 0;
}

function calcBaseSalary(dgm, role) {
  const tiers = BASE_SALARY[role]; if (!tiers) return { salary: 0, pct: 0 };
  const t = ROLES[role].target, ach = t ? dgm / t : 0;
  for (const [minR, amt, rate] of tiers) {
    if (ach >= minR) return { salary: rate ? Math.round(dgm * rate) : amt, pct: Math.round(ach * 100) };
  }
  return { salary: 0, pct: 0 };
}

function calcOverriding(ftm, role) {
  const cfg = ROLES[role];
  if (!cfg.overriding || !cfg.target) return 0;
  return ftm > cfg.target ? Math.round((ftm - cfg.target) * cfg.overriding) : 0;
}

function getFycTier(total, newcomer = false) {
  const eff = newcomer ? total * 2 : total;
  return FYC_TIERS.find(([m]) => eff >= m) ?? FYC_TIERS.at(-1);
}

function getQTier(qt) { return Q_TIERS.find(([m]) => qt >= m) ?? Q_TIERS.at(-1); }

// ── localStorage ─────────────────────────────────────────────────
function lsGet(key, fb) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; }
  catch { return fb; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ═══════════════════════════════════════════════════════════════
// §3  SHARED UI ATOMS
// ═══════════════════════════════════════════════════════════════

function Card({ className, children, ...p }) {
  return (
    <div className={cx("bg-surface-1 rounded-card border border-border shadow-card", className)} {...p}>
      {children}
    </div>
  );
}

function Badge({ role }) {
  const c = ROLE_COLOR[role] || "#8b949e";
  return (
    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-pill"
      style={{ background:`${c}22`, color:c, border:`1px solid ${c}44` }}>
      {role}
    </span>
  );
}

function ProgressBar({ value, max = 1, color = "#3b82f6", thick = false, className = "" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className={cx("w-full rounded-pill overflow-hidden bg-surface-3", thick ? "h-3" : "h-1.5", className)}>
      <div className="h-full rounded-pill transition-all duration-700"
        style={{ width:`${pct}%`, background:color }} />
    </div>
  );
}

function NumInput({ value, onChange, color = "#3b82f6" }) {
  const [draft, setDraft] = useState(String(value || ""));
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => { if (!focused) setDraft(String(value || "")); }, [value, focused]);

  const commit = () => {
    const n = Math.max(0, Number(draft) || 0);
    setDraft(String(n || "")); onChange(n);
  };

  return (
    <input
      ref={ref} type="number" inputMode="decimal" min="0"
      value={draft} placeholder="0"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => { if (e.key === "Enter") ref.current?.blur(); }}
      className="w-full bg-transparent rounded-lg text-right font-mono tabular-nums outline-none transition-all py-2 px-2 border"
      style={{
        color: draft && Number(draft) > 0 ? color : "#8b949e",
        borderColor: focused ? color : "#30363d",
        boxShadow: focused ? `0 0 0 3px ${color}18` : "none",
        background: focused ? "#1c2128" : "transparent",
        fontSize: 16,
        WebkitAppearance: "none",
      }}
    />
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-xl px-3 py-2 shadow-card-hover text-xs">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="font-mono font-bold ml-auto tabular-nums" style={{ color: p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
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
  const total   = life + nonLife;
  const ab      = activityBonus(total, role);

  return (
    <div className={cx(
      "rounded-card border transition-all duration-200",
      isCurrent ? "border-life/40 bg-surface-2 shadow-glow" : "border-border bg-surface-1",
    )}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(v => !v)}>
        <div className="shrink-0 w-16">
          <div className={cx("text-xs font-bold font-mono", isCurrent ? "text-life" : "text-muted")}>
            {wm.label}
            {isCurrent && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-life animate-pulse-dot" />}
          </div>
          <div className="text-[10px] text-muted/60 font-mono">{toRoc(wm.start).slice(3)}</div>
        </div>
        <div className="flex-1 min-w-0">
          {total > 0 ? (
            <>
              <div className="flex h-2 rounded-pill overflow-hidden bg-surface-3 mb-1">
                {life > 0    && <div style={{ width:`${Math.round(life/total*100)}%`,    background:"#3b82f6" }} />}
                {nonLife > 0 && <div style={{ width:`${Math.round(nonLife/total*100)}%`, background:"#10b981" }} />}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-ink-2 tabular-nums">{fmt(total)}</span>
                <span className="text-muted/60 text-[10px]">壽{fmt(life)} 產{fmt(nonLife)}</span>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted/50">未輸入</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ab > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-pill font-mono font-bold bg-nonlife/15 text-nonlife">
              +{ab / 1000}K
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 py-3 animate-fade-in">
          <div className="text-[10px] text-muted/60 mb-2 font-mono">
            受理 {toRoc(wm.start)}–{toRoc(wm.end)}
            <span className="text-danger/80 ml-2">結案截止 {toRoc(wm.close)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color:"#3b82f6" }}>壽險</label>
              <NumInput value={life}    color="#3b82f6" onChange={v => onUpdate(wm.mi, 0, v)} />
            </div>
            <div>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color:"#10b981" }}>產險</label>
              <NumInput value={nonLife} color="#10b981" onChange={v => onUpdate(wm.mi, 1, v)} />
            </div>
          </div>
          {total > 0 && (
            <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-xl bg-surface-3">
              <span className="text-xs text-muted">合計</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-ink tabular-nums">{fmt(total)}</span>
                {ab > 0 && <span className="text-nonlife">實動 +{ab.toLocaleString()}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §5  PAGE: PERFORMANCE INPUT
// ═══════════════════════════════════════════════════════════════

function PagePerf({ member, perf, onUpdate, meta }) {
  const curWM   = getCurrentWM();
  const prog    = getWMProgress();
  const yearL   = sumArr(perf.map(r => safe(r[0])));
  const yearNL  = sumArr(perf.map(r => safe(r[1])));
  const yearT   = yearL + yearNL;
  const monthlyTarget = (meta.lifeTarget || 0) + (meta.nlTarget || 0);
  const curTotal      = safe(perf[curWM.mi]?.[0]) + safe(perf[curWM.mi]?.[1]);
  const shouldHave    = monthlyTarget * prog;

  const chartData = WORK_MONTHS.map(wm => ({
    name:  wm.short,
    壽險:  safe(perf[wm.mi]?.[0]),
    產險:  safe(perf[wm.mi]?.[1]),
  }));

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"壽險",   val:yearL,  color:"#3b82f6" },
          { label:"產險",   val:yearNL, color:"#10b981" },
          { label:"年度總績效", val:yearT, color:"#f59e0b" },
        ].map(k => (
          <Card key={k.label} className="px-3 py-3">
            <p className="text-[10px] text-muted mb-1">{k.label}</p>
            <p className="text-base font-mono font-bold tabular-nums" style={{ color:k.color }}>{fmt(k.val)}</p>
          </Card>
        ))}
      </div>

      {/* Current WM progress */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-life" />
          <span className="text-xs font-semibold text-ink-2">{curWM.label} 工作月進度</span>
          <span className="ml-auto text-[10px] text-muted font-mono">{Math.round(prog*100)}% 已過</span>
        </div>
        {/* Progress track with time cursor */}
        <div className="relative mb-3 h-3">
          <div className="h-full w-full rounded-pill overflow-hidden bg-surface-3">
            <div className="h-full rounded-pill bg-life/30 transition-all duration-700" style={{ width:`${prog*100}%` }} />
          </div>
          <div className="absolute top-0 h-full w-0.5 bg-bonus rounded-pill pointer-events-none"
            style={{ left:`${prog*100}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted/60 text-[10px]">受理區間</p>
            <p className="font-mono text-ink-2">{toRoc(curWM.start)}</p>
            <p className="font-mono text-ink-2">{toRoc(curWM.end)}</p>
          </div>
          <div>
            <p className="text-muted/60 text-[10px]">結案截止</p>
            <p className="font-mono text-danger">{toRoc(curWM.close)}</p>
          </div>
          {monthlyTarget > 0 && (
            <div>
              <p className="text-muted/60 text-[10px]">本月進度</p>
              <p className="font-mono font-bold" style={{ color: curTotal >= shouldHave ? "#10b981" : "#ef4444" }}>
                {fmt(curTotal)}
              </p>
              <p className="text-[10px] text-muted/60">應達 {fmt(shouldHave)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Stacked bar chart */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-semibold text-ink-2">115 年度月度業績</p>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-life inline-block" />壽險</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-nonlife inline-block" />產險</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={chartData} margin={{ top:4, right:4, left:-20, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:"#8b949e" }} />
            <YAxis tick={{ fontSize:10, fill:"#8b949e" }} tickFormatter={v => v>=10000?`${v/10000}萬`:v} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="壽險" stackId="a" fill="#3b82f6" />
            <Bar dataKey="產險" stackId="a" fill="#10b981" radius={[3,3,0,0]} />
            {monthlyTarget > 0 && (
              <ReferenceLine y={monthlyTarget} stroke="#f59e0b" strokeDasharray="4 4"
                label={{ value:"月均目標", position:"right", fontSize:9, fill:"#f59e0b" }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly WM cards */}
      <div className="space-y-2">
        {WORK_MONTHS.map(wm => (
          <WMCard key={wm.wm} wm={wm} perf={perf} onUpdate={onUpdate}
            role={member.role} isCurrent={wm.wm === curWM.wm} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §6  PAGE: TARGETS
// ═══════════════════════════════════════════════════════════════

function PageTargets({ member, perf, meta, onMetaUpdate }) {
  const yearL  = sumArr(perf.map(r => safe(r[0])));
  const yearNL = sumArr(perf.map(r => safe(r[1])));
  const yearT  = yearL + yearNL;
  const isNew  = meta.isNewcomer || false;
  const [fycRate, fycLabel] = getFycTier(yearT, isNew);
  const fycBonus  = Math.round(yearT * fycRate);
  const monthlyT  = (meta.lifeTarget || 0) + (meta.nlTarget || 0);
  const filled    = perf.filter(r => safe(r[0]) + safe(r[1]) > 0).length;
  const avgAct    = filled > 0 ? yearT / filled : 0;
  const recruitT  = meta.recruitTarget || 0;
  const recruits  = meta.recruits || [];
  const nextTier  = FYC_TIERS.find(([m]) => (isNew ? yearT * 2 : yearT) < m && m > 0);

  const fycChartData = FYC_TIERS.slice(0,-1).map(([m, r, lbl]) => ({
    name: lbl, 門檻: m, passed: (isNew ? yearT*2 : yearT) >= m,
  }));

  return (
    <div className="space-y-4">
      {/* Target settings */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-bonus" />
          <span className="text-xs font-semibold text-ink-2">115 年度個人目標</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { label:"月均壽險目標", key:"lifeTarget",    color:"#3b82f6" },
            { label:"月均產險目標", key:"nlTarget",      color:"#10b981" },
            { label:"增員目標(人)", key:"recruitTarget", color:"#a78bfa" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] mb-1 block font-semibold" style={{ color:f.color }}>{f.label}</label>
              <NumInput value={meta[f.key]||0} color={f.color}
                onChange={v => onMetaUpdate({ ...meta, [f.key]: v })} />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input type="checkbox" checked={isNew}
            onChange={e => onMetaUpdate({ ...meta, isNewcomer: e.target.checked })}
            className="accent-life" />
          未滿一年新人（FYC 門檻減半）
        </label>
      </Card>

      {/* Indicator 1: monthly avg */}
      <Card className="p-4">
        <p className="text-[10px] text-muted/70 uppercase tracking-wider mb-3">指標一：個人月均業績</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-muted/60">目標月均</p>
            <p className="text-lg font-mono font-bold text-life tabular-nums">{fmt(monthlyT)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted/60">實際月均</p>
            <p className={cx("text-lg font-mono font-bold tabular-nums",
              avgAct >= monthlyT ? "text-nonlife" : "text-danger")}>{fmt(avgAct)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted/60">達成率</p>
            <p className={cx("text-lg font-mono font-bold tabular-nums",
              monthlyT>0&&avgAct>=monthlyT?"text-nonlife":"text-ink")}>
              {monthlyT > 0 ? `${Math.round(avgAct/monthlyT*100)}%` : "–"}
            </p>
          </div>
        </div>
        {monthlyT > 0 && (
          <ProgressBar value={avgAct} max={monthlyT}
            color={avgAct >= monthlyT ? "#10b981" : "#3b82f6"} thick />
        )}
      </Card>

      {/* Indicator 2: FYC */}
      <Card className="p-4">
        <p className="text-[10px] text-muted/70 uppercase tracking-wider mb-3">指標二：年度累計 FYC</p>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-2xl font-mono font-bold text-ink tabular-nums">{fmt(yearT)}</p>
            <p className="text-xs text-muted mt-0.5">
              壽 <span className="text-life">{fmt(yearL)}</span>
              　產 <span className="text-nonlife">{fmt(yearNL)}</span>
            </p>
          </div>
          {fycRate > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted/60">FYC 年終加成</p>
              <p className="text-xl font-mono font-bold text-bonus">{(fycRate*100).toFixed(1)}%</p>
              <p className="text-xs text-nonlife">${fycBonus.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Stacked progress bar with tier ticks */}
        <div className="relative mb-5">
          <div className="h-3 rounded-pill overflow-hidden bg-surface-3">
            <div className="h-full flex">
              <div style={{ width:`${Math.min(100,yearL/9000)}%`, background:"#3b82f6" }} />
              <div style={{ width:`${Math.min(100-yearL/9000,yearNL/9000)}%`, background:"#10b981" }} />
            </div>
          </div>
          {FYC_TIERS.slice(0,-1).map(([m,,lbl]) => {
            const x = m / 900000 * 100;
            const passed = (isNew ? yearT*2 : yearT) >= m;
            return (
              <div key={m} className="absolute top-0 flex flex-col items-center pointer-events-none"
                style={{ left:`${x}%`, transform:"translateX(-50%)" }}>
                <div className="w-px h-3" style={{ background: passed ? "#a78bfa" : "#21262d" }} />
                <span className="text-[7px] mt-0.5 font-mono whitespace-nowrap"
                  style={{ color: passed ? "#a78bfa" : "#30363d" }}>{lbl}</span>
              </div>
            );
          })}
        </div>

        {/* FYC tier bar */}
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={fycChartData} margin={{ top:0, right:4, left:-28, bottom:0 }}>
            <XAxis dataKey="name" tick={{ fontSize:8, fill:"#8b949e" }} />
            <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
              <div className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-[10px] font-mono">
                {payload[0].payload.name}: {fmt(payload[0].payload.門檻)}
              </div>
            ) : null} />
            <Bar dataKey="門檻" radius={[3,3,0,0]}>
              {fycChartData.map((d,i) => <Cell key={i} fill={d.passed ? "#10b981" : "#21262d"} />)}
            </Bar>
            <ReferenceLine y={isNew ? yearT*2 : yearT} stroke="#3b82f6" strokeWidth={2}
              label={{ value:"目前", fontSize:8, fill:"#3b82f6" }} />
          </BarChart>
        </ResponsiveContainer>

        {nextTier && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-surface-3 text-xs flex items-center gap-2">
            <Zap size={12} className="text-bonus shrink-0" />
            <span className="text-muted">距 <span className="text-bonus font-bold">{nextTier[2]}({(nextTier[1]*100).toFixed(1)}%)</span> 還差</span>
            <span className="font-mono font-bold text-bonus ml-auto tabular-nums">
              {fmt(isNew?(nextTier[0]-yearT*2)/2:nextTier[0]-yearT)}
            </span>
          </div>
        )}
      </Card>

      {/* Indicator 3: Recruits */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-muted/70 uppercase tracking-wider">指標三：年度增員</p>
          <button className="flex items-center gap-1 text-xs text-nonlife"
            onClick={() => {
              const name  = prompt("增員姓名："); if (!name?.trim()) return;
              const month = Math.max(0, Math.min(11, (parseInt(prompt("增員月份(1-12)：")||"1") - 1)));
              onMetaUpdate({ ...meta, recruits:[...(meta.recruits||[]),
                { name:name.trim(), month, role:"CA", id:Date.now() }] });
            }}>
            <Plus size={12} />新增
          </button>
        </div>
        <div className="flex items-end gap-4 mb-3">
          <div>
            <p className="text-3xl font-mono font-bold text-ink tabular-nums">{recruits.length}</p>
            <p className="text-[10px] text-muted">已增員</p>
          </div>
          <div className="text-muted/40 text-2xl mb-1">/</div>
          <div>
            <p className="text-3xl font-mono font-bold text-muted/50 tabular-nums">{recruitT||"?"}</p>
            <p className="text-[10px] text-muted">目標</p>
          </div>
        </div>
        {recruitT > 0 && (
          <ProgressBar value={recruits.length} max={recruitT}
            color={recruits.length>=recruitT?"#10b981":"#3b82f6"} thick className="mb-3" />
        )}
        {recruits.length > 0 && (
          <div className="space-y-1.5">
            {recruits.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-3 text-xs">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background:ROLE_COLOR[r.role]+"22", color:ROLE_COLOR[r.role] }}>
                  {r.name[0]}
                </div>
                <span className="text-ink-2 font-semibold">{r.name}</span>
                <span className="text-muted ml-auto">{WORK_MONTHS[r.month]?.label}</span>
                <button onClick={() => onMetaUpdate({ ...meta, recruits:recruits.filter(x=>x.id!==r.id) })}
                  className="text-muted/40 hover:text-danger transition-colors"><X size={12} /></button>
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
  const yearT = sumArr(perf.map(r => safe(r[0])+safe(r[1])));
  const isNew = meta.isNewcomer||false;

  const quarters = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]].map((mis,qi) => {
    const qt  = sumArr(mis.map(mi => safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
    const [,rate,lbl] = getQTier(qt);
    return { label:`Q${qi+1}`, total:qt, rate, tierLabel:lbl, bonus:Math.round(qt*rate) };
  });

  const actBonus   = sumArr(perf.map(r => activityBonus(safe(r[0])+safe(r[1]), role)));
  const qBonus     = sumArr(quarters.map(q => q.bonus));
  const yearEnd    = Math.round(actBonus*0.18);
  const [fycR, fycLbl] = getFycTier(yearT, isNew);
  const fycBonus   = Math.round(yearT * fycR);
  const persTotal  = actBonus + qBonus + yearEnd + fycBonus;

  const isManager  = ROLES[role]?.isManager;
  let bsYear=0, ovYear=0;
  if (isManager) {
    const caCut = members.filter(m => m.parentId===member.id && m.role==="CA");
    bsYear = sumArr(Array(12).fill(0).map((_,mi)=>{
      const dgm = sumArr([member.id,...caCut.map(c=>c.id)].map(id=>
        safe(allPerf[id]?.[mi]?.[0])+safe(allPerf[id]?.[mi]?.[1])));
      return calcBaseSalary(dgm, role).salary;
    }));
    ovYear = sumArr(Array(12).fill(0).map((_,mi)=>{
      const ftm = sumArr(members.map(m2=>safe(allPerf[m2.id]?.[mi]?.[0])+safe(allPerf[m2.id]?.[mi]?.[1])));
      return calcOverriding(ftm, role);
    }));
  }

  const grand = persTotal + bsYear + ovYear;

  return (
    <div className="space-y-4">
      {/* Q cards */}
      <div className="grid grid-cols-2 gap-3 xs:grid-cols-4">
        {quarters.map(q => (
          <Card key={q.label} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted">{q.label}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-pill font-bold"
                style={{ background:"#f59e0b22", color:"#f59e0b", border:"1px solid #f59e0b33" }}>
                {q.tierLabel}
              </span>
            </div>
            <p className="text-sm font-mono font-bold text-ink tabular-nums mb-1">{fmt(q.total)}</p>
            <ProgressBar value={q.total} max={150000} color="#f59e0b" className="mb-1" />
            <div className="flex justify-between text-[10px]">
              <span className="text-muted">季獎</span>
              <span className="font-mono font-bold tabular-nums text-bonus">{q.bonus.toLocaleString()}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Personal bonuses */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 rounded-full bg-life shrink-0" />
          <p className="text-xs font-semibold text-ink-2">個人部分</p>
        </div>
        <div className="space-y-2">
          {[
            { label:"實動津貼",       val:actBonus,  sub:"10K→1K / 20K→2K",       color:"#10b981" },
            { label:"季獎金合計",     val:qBonus,    sub:"四季累計 5%–18%",         color:"#a78bfa" },
            { label:"個人年終(×18%)", val:yearEnd,   sub:"以年度實動金為基準",       color:"#38bdf8" },
            { label:`FYC年終(${fycLbl})`, val:fycBonus, sub:`${(fycR*100).toFixed(1)}%加成`, color:"#f59e0b" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background:`${item.color}08`, border:`1px solid ${item.color}20` }}>
              <div>
                <p className="text-xs font-semibold text-ink-2">{item.label}</p>
                <p className="text-[10px] text-muted/70">{item.sub}</p>
              </div>
              <p className="font-mono font-bold text-sm tabular-nums" style={{ color:item.color }}>
                ${item.val.toLocaleString()}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-life/10 border border-life/20">
            <span className="text-xs font-bold text-life">個人部分小計</span>
            <span className="font-mono font-bold text-life tabular-nums">${persTotal.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {isManager && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full bg-bonus shrink-0" />
            <p className="text-xs font-semibold text-ink-2">團隊部分</p>
          </div>
          <div className="space-y-2">
            {[
              { label:"年度基本薪",   val:bsYear, color:"#fbbf24" },
              { label:"年度超額獎金", val:ovYear, color:"#f97316" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background:`${item.color}08`, border:`1px solid ${item.color}20` }}>
                <p className="text-xs font-semibold text-ink-2">{item.label}</p>
                <p className="font-mono font-bold text-sm tabular-nums" style={{ color:item.color }}>
                  ${item.val.toLocaleString()}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-bonus/10 border border-bonus/20">
              <span className="text-xs font-bold text-bonus">團隊部分小計</span>
              <span className="font-mono font-bold text-bonus tabular-nums">${(bsYear+ovYear).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Grand total */}
      <Card className="p-5" style={{ background:"linear-gradient(135deg,#1c2128,#161b22)", borderColor:"#f59e0b44" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted mb-0.5">年度預估總收入</p>
            <p className="text-[10px] text-muted/60">
              個人 ${persTotal.toLocaleString()}
              {isManager && ` ＋ 團隊 $${(bsYear+ovYear).toLocaleString()}`}
            </p>
          </div>
          <p className="text-3xl font-mono font-black text-bonus tabular-nums">${grand.toLocaleString()}</p>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §8  PAGE: ASSESSMENT
// ═══════════════════════════════════════════════════════════════

function PageAssess({ member, perf, meta, onMetaUpdate }) {
  const role   = member.role;
  const isCA   = role === "CA";
  const isMgr  = ["SP-A","AM-A","UM-A"].includes(role);

  // CA quarterly
  const cycleQ    = meta.cycleQ ?? 0;
  const cases     = meta.caseCount ?? 0;
  const mis       = [cycleQ*3, cycleQ*3+1, cycleQ*3+2];
  const cycleT    = sumArr(mis.map(mi => safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
  const maxM      = Math.max(...mis.map(mi => safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
  const perfOK    = maxM>=10000||cycleT>=45000;
  const casesOK   = cases>=1;
  const caPass    = perfOK && casesOK;

  // Manager six-month
  const ASSESS_THRESHOLDS = { "SP-A":[160000,9], "AM-A":[220000,15], "UM-A":[280000,21] };
  const [perfThr=0, fteThr=0] = ASSESS_THRESHOLDS[role]??[];
  const cycleStart = meta.cycleStart ?? 0;
  const mgrMis     = Array.from({length:6},(_,i)=>cycleStart+i).filter(i=>i<12);
  const mgrCycleT  = sumArr(mgrMis.map(mi=>safe(perf[mi]?.[0])+safe(perf[mi]?.[1])));
  const fte        = meta.fteCount ?? 0;
  const mgrPass    = mgrCycleT>=perfThr && fte>=fteThr;

  return (
    <div className="space-y-4">
      {isCA && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full bg-life shrink-0" />
            <p className="text-xs font-semibold text-ink-2">三個月考核追蹤</p>
            {caPass ? <CheckCircle2 size={14} className="text-nonlife ml-auto" />
                    : <AlertCircle  size={14} className="text-danger ml-auto" />}
          </div>
          <div className="flex gap-1.5 mb-4">
            {["Q1","Q2","Q3","Q4"].map((q,i) => (
              <button key={q} onClick={() => onMetaUpdate({ ...meta, cycleQ:i })}
                className={cx("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  cycleQ===i?"bg-life/20 text-life border-life/30":"text-muted border-border")}>
                {q}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">三月累計</span>
                <span className={cx("font-mono font-bold tabular-nums", cycleT>=45000?"text-nonlife":"text-ink")}>
                  {fmt(cycleT)} / 4.5萬
                  {cycleT<45000 && <span className="text-danger ml-1">差{fmt(45000-cycleT)}</span>}
                </span>
              </div>
              <ProgressBar value={cycleT} max={45000} color={cycleT>=45000?"#10b981":"#3b82f6"} thick />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">單月最高</span>
                <span className={cx("font-mono font-bold", maxM>=10000?"text-nonlife":"text-muted")}>{fmt(maxM)} / 1萬</span>
              </div>
              <ProgressBar value={maxM} max={10000} color={maxM>=10000?"#10b981":"#f59e0b"} />
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-3">
              <span className="text-xs text-muted">累計件數</span>
              <div className="flex items-center gap-3">
                <button onClick={() => onMetaUpdate({ ...meta, caseCount:Math.max(0,cases-1) })}
                  className="w-7 h-7 rounded-lg bg-surface-4 text-muted hover:text-ink flex items-center justify-center font-bold">−</button>
                <span className={cx("text-lg font-mono font-bold w-8 text-center tabular-nums",
                  casesOK?"text-nonlife":"text-ink")}>{cases}</span>
                <button onClick={() => onMetaUpdate({ ...meta, caseCount:cases+1 })}
                  className="w-7 h-7 rounded-lg bg-surface-4 text-muted hover:text-ink flex items-center justify-center font-bold">+</button>
                <span className="text-xs text-muted">/ 1件</span>
              </div>
            </div>
          </div>
          <div className={cx("mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-center",
            caPass?"bg-nonlife/15 text-nonlife border border-nonlife/20":"bg-danger/10 text-danger border border-danger/20")}>
            {caPass ? "✓ 本週期考核達標" : `✗ 未達標：${!perfOK?"業績條件 ":""}${!casesOK?"件數條件":""}`}
          </div>
        </Card>
      )}

      {isMgr && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full bg-bonus shrink-0" />
            <p className="text-xs font-semibold text-ink-2">六個月主管考核</p>
            {mgrPass ? <CheckCircle2 size={14} className="text-nonlife ml-auto" />
                     : <AlertCircle  size={14} className="text-danger ml-auto" />}
          </div>
          <div className="flex gap-1.5 mb-4">
            {[{l:"前半年",v:0},{l:"後半年",v:6}].map(({l,v}) => (
              <button key={l} onClick={() => onMetaUpdate({ ...meta, cycleStart:v })}
                className={cx("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  cycleStart===v?"bg-bonus/20 text-bonus border-bonus/30":"text-muted border-border")}>
                {l}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">直轄組六月累計</span>
                <span className={cx("font-mono font-bold tabular-nums",
                  mgrCycleT>=perfThr?"text-nonlife":"text-ink")}>
                  {fmt(mgrCycleT)} / {fmt(perfThr)}
                  {mgrCycleT<perfThr && <span className="text-danger ml-1">差{fmt(perfThr-mgrCycleT)}</span>}
                </span>
              </div>
              <ProgressBar value={mgrCycleT} max={perfThr} color={mgrCycleT>=perfThr?"#10b981":"#3b82f6"} thick />
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-3">
              <span className="text-xs text-muted">專職人數</span>
              <div className="flex items-center gap-3">
                <button onClick={() => onMetaUpdate({ ...meta, fteCount:Math.max(0,fte-1) })}
                  className="w-7 h-7 rounded-lg bg-surface-4 text-muted hover:text-ink flex items-center justify-center font-bold">−</button>
                <span className={cx("text-lg font-mono font-bold w-10 text-center tabular-nums",
                  fte>=fteThr?"text-nonlife":"text-ink")}>{fte}</span>
                <button onClick={() => onMetaUpdate({ ...meta, fteCount:fte+1 })}
                  className="w-7 h-7 rounded-lg bg-surface-4 text-muted hover:text-ink flex items-center justify-center font-bold">+</button>
                <span className="text-xs text-muted">/ {fteThr}人</span>
              </div>
            </div>
          </div>
          <div className={cx("mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-center",
            mgrPass?"bg-nonlife/15 text-nonlife border border-nonlife/20":"bg-surface-3 text-muted border border-border")}>
            {mgrPass ? "✓ 六個月考核達標" : "❌ 考核條件未達標"}
          </div>
        </Card>
      )}

      {isCA && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Medal size={14} className="text-bonus" />
            <p className="text-xs font-semibold text-ink-2">晉升業務主任追蹤</p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">6個月累計 FYC（含增員）</span>
                <span className="font-mono font-bold tabular-nums"
                  style={{ color:(meta.promo_fyc||0)>=240000?"#10b981":"#e6edf3" }}>
                  {fmt(meta.promo_fyc||0)} / 24萬
                </span>
              </div>
              <NumInput value={meta.promo_fyc||0} color="#f59e0b"
                onChange={v => onMetaUpdate({ ...meta, promo_fyc:v })} />
              <ProgressBar value={meta.promo_fyc||0} max={240000}
                color={(meta.promo_fyc||0)>=240000?"#10b981":"#f59e0b"} className="mt-1" />
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-3">
              <span className="text-xs text-muted">6個月累計件數</span>
              <div className="flex items-center gap-2">
                <button onClick={() => onMetaUpdate({ ...meta, promo_cases:Math.max(0,(meta.promo_cases||0)-1) })}
                  className="w-7 h-7 rounded-lg bg-surface-4 text-muted hover:text-ink flex items-center justify-center font-bold">−</button>
                <span className="font-mono font-bold w-8 text-center tabular-nums">{meta.promo_cases||0}</span>
                <button onClick={() => onMetaUpdate({ ...meta, promo_cases:(meta.promo_cases||0)+1 })}
                  className="w-7 h-7 rounded-lg bg-surface-4 text-muted hover:text-ink flex items-center justify-center font-bold">+</button>
                <span className="text-xs text-muted">/ 18件</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted px-1 cursor-pointer">
              <input type="checkbox" checked={meta.promo_recruited||false}
                onChange={e => onMetaUpdate({ ...meta, promo_recruited:e.target.checked })}
                className="accent-nonlife" />
              上月已完成增員晉升 1 人
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
  const rows = ["工作月,受理起日,受理迄日,結案截止,壽險,產險,總業績"];
  WORK_MONTHS.forEach(wm => {
    const l = safe(perf[wm.mi]?.[0]), nl = safe(perf[wm.mi]?.[1]);
    rows.push(`${wm.label},${toRoc(wm.start)},${toRoc(wm.end)},${toRoc(wm.close)},${l},${nl},${l+nl}`);
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF"+rows.join("\n")], { type:"text/csv;charset=utf-8" }));
  a.download = `業績_${member.name}_115年.csv`;
  a.click(); URL.revokeObjectURL(a.href);
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
  const [members,    setMembers]    = useState(() => lsGet(LS.MEMBERS, DEFAULT_MEMBERS));
  const [allPerf,    setAllPerf]    = useState(() => lsGet(LS.PERF, {}));
  const [allMeta,    setAllMeta]    = useState(() => lsGet(LS.META, {}));
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? "");
  const [tab,        setTab]        = useState("perf");
  const [sideOpen,   setSideOpen]   = useState(true);

  const member = members.find(m => m.id === selectedId) ?? members[0];
  const perf   = allPerf[selectedId]  ?? emptyPerf();
  const meta   = allMeta[selectedId]  ?? {};
  const curWM  = getCurrentWM();

  const updatePerf = useCallback((mi, col, val) => {
    setAllPerf(prev => {
      const next = { ...prev };
      const row  = (next[selectedId] ?? emptyPerf()).map(r => [...r]);
      row[mi][col] = val; next[selectedId] = row;
      lsSet(LS.PERF, next); return next;
    });
  }, [selectedId]);

  const updateMeta = useCallback(newMeta => {
    setAllMeta(prev => {
      const next = { ...prev, [selectedId]: newMeta };
      lsSet(LS.META, next); return next;
    });
  }, [selectedId]);

  const globalL  = members.reduce((s,m) => s + sumArr((allPerf[m.id]??emptyPerf()).map(r=>safe(r[0]))), 0);
  const globalNL = members.reduce((s,m) => s + sumArr((allPerf[m.id]??emptyPerf()).map(r=>safe(r[1]))), 0);

  const pageProps = { member, perf, meta, onMetaUpdate:updateMeta, members, allPerf };
  const page = useMemo(() => {
    if (tab==="perf")   return <PagePerf   {...pageProps} onUpdate={updatePerf} />;
    if (tab==="target") return <PageTargets {...pageProps} />;
    if (tab==="bonus")  return <PageBonus   {...pageProps} />;
    if (tab==="assess") return <PageAssess  {...pageProps} />;
    return null;
  }, [tab, selectedId, perf, meta, allPerf]);

  return (
    <div className="min-h-screen bg-surface text-ink font-sans">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-1/90 backdrop-blur-glass">
        <button className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-muted hover:text-ink hover:bg-surface-3 transition-all"
          onClick={() => setSideOpen(v=>!v)}>
          <Settings size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-8 rounded-full bg-gradient-to-b from-bonus to-orange-700" />
          <div>
            <h1 className="text-sm font-bold leading-none">郭華益 團隊</h1>
            <p className="text-[10px] text-muted font-mono leading-none mt-0.5">115 年度業績系統</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 ml-auto">
          {[
            { l:"全團壽險",   v:globalL,       c:"#3b82f6" },
            { l:"全團產險",   v:globalNL,      c:"#10b981" },
            { l:"全團總績效", v:globalL+globalNL, c:"#f59e0b" },
          ].map(s => (
            <div key={s.l} className="text-right">
              <p className="text-[9px] text-muted leading-none">{s.l}</p>
              <p className="text-sm font-mono font-bold tabular-nums leading-none mt-0.5" style={{ color:s.c }}>{fmt(s.v)}</p>
            </div>
          ))}
        </div>
        <button
          className="ml-auto md:ml-2 flex items-center gap-1.5 text-xs text-muted hover:text-ink px-3 py-1.5 rounded-lg border border-border transition-all"
          onClick={() => exportCSV(member, perf)}>
          <Download size={12} />
          <span className="hidden sm:inline">匯出</span>
        </button>
      </header>

      <div className="flex h-[calc(100svh-49px)]">
        {/* ── Desktop sidebar ── */}
        <aside className={cx(
          "hidden md:flex flex-col shrink-0 overflow-hidden transition-all duration-300 border-r border-border bg-surface-1",
          sideOpen ? "w-56" : "w-0",
        )}>
          <div className="w-56 flex flex-col h-full overflow-hidden">
            {/* Members */}
            <div className="p-3 border-b border-border">
              <p className="text-[9px] text-muted uppercase tracking-wider font-semibold px-1 mb-2">成員</p>
              {members.map(m => {
                const mt  = sumArr((allPerf[m.id]??emptyPerf()).map(r=>safe(r[0])+safe(r[1])));
                const sel = m.id === selectedId;
                return (
                  <button key={m.id} onClick={() => setSelectedId(m.id)}
                    className={cx("w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-all mb-0.5 border",
                      sel ? "bg-life/15 border-life/20" : "hover:bg-surface-3 border-transparent")}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background:`${ROLE_COLOR[m.role]}22`, color:ROLE_COLOR[m.role] }}>{m.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className={cx("text-xs font-semibold truncate", sel?"text-ink":"text-ink-2")}>{m.name}</p>
                      <p className="text-[9px] font-mono" style={{ color:ROLE_COLOR[m.role] }}>{ROLES[m.role]?.label}</p>
                    </div>
                    {mt > 0 && (
                      <span className="text-[9px] font-mono tabular-nums shrink-0" style={{ color:ROLE_COLOR[m.role] }}>{fmt(mt)}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Nav */}
            <nav className="p-3 flex-1">
              <p className="text-[9px] text-muted uppercase tracking-wider font-semibold px-1 mb-2">功能</p>
              {NAV.map(({ id, label, icon:Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={cx("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all mb-0.5 text-xs font-semibold border",
                    tab===id ? "bg-life/15 text-life border-life/20" : "text-muted hover:bg-surface-3 hover:text-ink border-transparent")}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </nav>
            {/* WM mini */}
            <div className="p-3 border-t border-border">
              <p className="text-[9px] text-muted mb-1.5 font-mono">{curWM.label} · {Math.round(getWMProgress()*100)}%</p>
              <ProgressBar value={getWMProgress()} color="#3b82f6" />
              <p className="text-[9px] text-danger/80 mt-1.5 font-mono">截止 {toRoc(curWM.close)}</p>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* Mobile member chips */}
          <div className="md:hidden flex gap-2 px-4 py-2 border-b border-border overflow-x-auto no-scrollbar">
            {members.map(m => (
              <button key={m.id} onClick={() => setSelectedId(m.id)}
                className={cx("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold transition-all border",
                  m.id===selectedId ? "border-life/40 text-life" : "border-border text-muted")}
                style={m.id===selectedId ? { background:`${ROLE_COLOR[m.role]}15` } : {}}>
                <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold"
                  style={{ background:`${ROLE_COLOR[m.role]}22`, color:ROLE_COLOR[m.role] }}>{m.name[0]}</div>
                {m.name}
              </button>
            ))}
          </div>

          {/* Page */}
          <div className="px-4 py-4 pb-24 md:pb-6 max-w-2xl xl:max-w-3xl mx-auto animate-fade-in">
            {/* Member header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-card flex items-center justify-center text-base font-black"
                style={{ background:`${ROLE_COLOR[member?.role]}22`, color:ROLE_COLOR[member?.role] }}>
                {member?.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">{member?.name}</h2>
                  <Badge role={member?.role} />
                </div>
                <p className="text-[10px] text-muted">{ROLES[member?.role]?.label}</p>
              </div>
            </div>
            {page}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-surface-1/95 backdrop-blur-glass"
        style={{ paddingBottom:"env(safe-area-inset-bottom,0)" }}>
        {NAV.map(({ id, label, icon:Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color:active?"#3b82f6":"#8b949e", minHeight:52 }}>
              <Icon size={20} />
              <span className="text-[10px] font-semibold">{label}</span>
              {active && <div className="w-4 h-0.5 rounded-full bg-life" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
