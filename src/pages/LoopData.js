import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_OPTIONS = [
{ value: 'cup', label: 'Cup Series' },
{ value: 'oreilly', label: "O'Reilly Series" },
{ value: 'trucks', label: 'Truck Series' },
]

const TRACK_ABBR = {
'Las Vegas Motor Speedway': 'LV',
'Homestead-Miami Speedway': 'HOM',
'Texas Motor Speedway': 'TEX',
'Charlotte Motor Speedway': 'CLT',
'Pocono Raceway': 'POC',
'Indianapolis Motor Speedway': 'IND',
'Indianapolis Grand Prix Circuit': 'Indy GP',
'Kansas Speedway': 'KAN',
'Nashville Superspeedway': 'NSS',
'New Hampshire Motor Speedway': 'NH',
'Bristol Motor Speedway': 'BRI',
'Talladega Superspeedway': 'TAL',
'Daytona International Speedway': 'DAY',
'Phoenix Raceway': 'PHX',
'Martinsville Speedway': 'MAR',
'Atlanta Motor Speedway': 'ATL',
'Dover Motor Speedway': 'DOV',
'Richmond Raceway': 'RIC',
'Watkins Glen International': 'WGI',
'Circuit of the Americas': 'COTA',
'Chicago Street Course': 'CHI',
'Sonoma Raceway': 'SON',
'Michigan International Speedway': 'MIS',
'Darlington Raceway': 'DAR',
'Auto Club Speedway': 'FON',
'World Wide Technology Raceway': 'WWT',
'Iowa Speedway': 'IOWA',
'Lime Rock Park': 'LRP',
'Mid-Ohio Sports Car Course': 'MID',
'Streets of St. Petersburg': 'St.Pt',
'Portland International Raceway': 'POR',
'Road America': 'RA',
'Naval Base Coronado': 'NBC',
'Autodromo Hermanos Rodriguez': 'AMR',
}

function trackLabel(name, year) {
const abbr = TRACK_ABBR[name] || name.replace(/[aeiou\s\-]/gi, '').substring(0, 3).toUpperCase()
return abbr + " '" + String(year).slice(2)
}

function sanitizeKey(name) {
return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}

const ENTRY_COLS = []

const STAT_COLS = [
{ key: 'races', label: 'Races', decimals: 0, noHeat: true },
{ key: 'avg_start', label: 'Avg St', decimals: 2, lowerIsBetter: true },
{ key: 'avg_finish', label: 'Avg Fin', decimals: 2, lowerIsBetter: true },
{ key: 'avg_mid', label: 'ARP', decimals: 2, lowerIsBetter: true },
{ key: 'avg_rating', label: 'Driver Rating', decimals: 1, highlight: true },
{ key: 'avg_dk_pts', label: 'Avg DK Pts', decimals: 2 },
{ key: 'avg_qp', label: 'Qual Pass', decimals: 2 },
{ key: 'avg_pass_diff', label: 'Pass Diff', decimals: 2, signed: true },
{ key: 'avg_top15_pct', label: 'Top 15%', decimals: 1, pct: true },
{ key: 'avg_fastest', label: 'Fast Laps', decimals: 2 },
{ key: 'avg_laps_led', label: 'Avg Laps Led', decimals: 2 },
]

const COUNT_COLS = [
{ key: 'wins', label: 'W', decimals: 0, isCount: true, isWin: true },
{ key: 'top3', label: 'T3', decimals: 0, isCount: true },
{ key: 'top5', label: 'T5', decimals: 0, isCount: true },
{ key: 'top10', label: 'T10', decimals: 0, isCount: true },
{ key: 'top15', label: 'T15', decimals: 0, isCount: true },
{ key: 'top20', label: 'T20', decimals: 0, isCount: true },
]

function dkFinishPts(pos) {
if (pos <= 0 || isNaN(pos)) return 0
const table = [0,45,42,41,40,39,38,37,36,35,34,32,31,30,29,28,27,26,25,24,23,21,20,19,18,17,16,15,14,13,12,10,9,8,7,6,5,4,3,2,1]
return pos <= 40 ? table[pos] : 0
}

function computeDriverAvg(rows) {
const n = rows.length
if (!n) return null
const sum = (key) => rows.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0)
const cnt = (thresh) => rows.filter(r => { const f = parseInt(r.finish_position); return f > 0 && f <= thresh }).length
return {
races: n,
avg_start: sum('start_position') / n,
avg_finish: sum('finish_position') / n,
avg_mid: sum('avg_position') / n,
avg_rating: sum('driver_rating') / n,
avg_qp: sum('quality_passes') / n,
avg_pass_diff: sum('pass_diff') / n,
avg_top15_pct: sum('pct_top15_laps') / n,
avg_laps_led: sum('laps_led') / n,
avg_fastest: sum('fastest_laps') / n,
avg_dk_pts: rows.reduce((s, r) => {
const fin = parseInt(r.finish_position) || 0
const st = parseInt(r.start_position) || 0
const fl = parseFloat(r.fastest_laps) || 0
const ll = parseFloat(r.laps_led) || 0
return s + dkFinishPts(fin) + (st - fin) + (fl * 0.45) + (ll * 0.25)
}, 0) / n,
wins: cnt(1),
top3: cnt(3),
top5: cnt(5),
top10: cnt(10),
top15: cnt(15),
top20: cnt(20),
}
}

// raceDefs: array of { key, year, track_name } for per-race finish columns
// trackYears: array of years for main track year-finish columns
function groupByDriver(rows, entryMap, trackYears, raceDefs) {
const map = {}
rows.forEach(row => {
const name = row.driver_name
if (!map[name]) map[name] = []
map[name].push(row)
})

const entries = entryMap
? [...entryMap.keys()].map(d => [d, map[d] || []])
: Object.entries(map)

return entries
.map(([driver, dRows]) => {
const entry = entryMap ? (entryMap.get(driver) || {}) : {}
const stats = computeDriverAvg(dRows)

const yearFinishes = {}
if (trackYears) {
dRows.forEach(r => {
const yr = parseInt(r.year)
if (yr && trackYears.includes(yr)) {
const fin = parseInt(r.finish_position)
const existing = yearFinishes['y_' + yr]
if (fin && fin > 0 && (!existing || fin < existing)) yearFinishes['y_' + yr] = fin
}
})
}

const raceFinishes = {}
if (raceDefs) {
raceDefs.forEach(rd => {
const matchRow = dRows.find(r => parseInt(r.year) === rd.year && r.track_name === rd.track_name)
if (matchRow) {
const fin = parseInt(matchRow.finish_position)
if (fin > 0) raceFinishes[rd.key] = fin
}
})
}

return {
driver,
car_number: entry.car_number || null,
organization: entry.organization || null,
rawRaces: dRows,
...stats,
...yearFinishes,
...raceFinishes,
}
})
.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
}

// Rank-based heat: rank 1 = best (green), rank N = worst (red)
function heatBg(rank, total) {
if (!total || total < 2 || rank == null) return null
const t = 1 - (rank - 1) / (total - 1)
const r = t > 0.5 ? Math.round(255 * 2 * (1 - t)) : 255
const g = t < 0.5 ? Math.round(200 * 2 * t) : 200
return 'rgba(' + r + ',' + g + ',0,0.38)'
}

// Position-based heat for finish columns: P1=green, P5=lime, P10=yellow, P20=orange, P21+=red
function posHeat(pos) {
if (!pos || pos <= 0 || isNaN(pos)) return null
if (pos === 1) return 'rgba(34,197,94,0.45)'
if (pos <= 5) return 'rgba(34,197,94,0.30)'
if (pos <= 10) return 'rgba(132,204,22,0.28)'
if (pos <= 15) return 'rgba(234,179,8,0.26)'
if (pos <= 20) return 'rgba(249,115,22,0.26)'
return 'rgba(239,68,68,0.28)'
}

// Finish position cell color for driver card table
function finishCellColor(pos) {
const p = parseInt(pos)
if (!p || p <= 0) return undefined
if (p === 1) return 'rgba(34,197,94,0.55)'
if (p <= 5) return 'rgba(34,197,94,0.35)'
if (p <= 10) return 'rgba(132,204,22,0.32)'
if (p <= 15) return 'rgba(234,179,8,0.30)'
return undefined
}

function fmtVal(val, col) {
if (val == null) return '-'
if (col.isCount) {
const v = parseInt(val)
return isNaN(v) ? '-' : String(v)
}
if (col.isText || col.isYear) return val != null ? String(val) : '-'
const v = parseFloat(val)
if (isNaN(v)) return '-'
const fixed = v.toFixed(col.decimals)
if (col.signed && v > 0) return '+' + fixed
if (col.pct) return fixed + '%'
return fixed
}

// Formats a raw supabase race row field value
function fmtRaw(val, decimals) {
if (val == null || val === '') return '-'
const v = parseFloat(val)
if (isNaN(v)) return '-'
return v.toFixed(decimals || 0)
}

function YearPicker({ label, availableYears, selectedYears, onToggle }) {
if (!availableYears.length) return null
return (
<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10,
padding: '7px 14px', background: 'var(--bg-surface)',
borderRadius: 7, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
<span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)',
textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
{availableYears.map(yr => (
<label key={yr} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
fontSize: '0.83rem',
color: selectedYears.includes(yr) ? 'var(--text-primary)' : 'var(--text-muted)',
fontWeight: selectedYears.includes(yr) ? 600 : 400 }}>
<input type="checkbox" checked={selectedYears.includes(yr)}
onChange={() => onToggle(yr)}
style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
{yr}
</label>
))}
</div>
)
}

// DriverCard modal — shows per-race stats for a selected driver with optional comparison
function DriverCard({ cardDriver, compareDriver, mainRows, onClose, onSetCompare }) {
useEffect(function(){
var _bg=document.createElement(String.fromCharCode(100,105,118));
_bg.style.position=String.fromCharCode(102,105,120,101,100);
_bg.style.top=String.fromCharCode(48);
_bg.style.left=String.fromCharCode(48);
_bg.style.width=String.fromCharCode(49,48,48,37);
_bg.style.height=String.fromCharCode(49,48,48,37);
_bg.style.zIndex=String.fromCharCode(57,57,57,55);
_bg.style.background=String.fromCharCode(114,103,98,97,40,48,44,48,44,48,44,48,46,54,53,41);
_bg.onclick=function(ev){if(ev.target===_bg)onClose();};
document.body.appendChild(_bg);
return function(){if(_bg.parentNode)_bg.parentNode.removeChild(_bg);};
},[onClose]);

const CARD_COLS = [
{ key: 'finish_position', label: 'Finish', decimals: 0 },
{ key: 'start_position', label: 'Start', decimals: 0 },
{ key: 'avg_position', label: 'Avg Pos', decimals: 2 },
{ key: 'driver_rating', label: 'Rating', decimals: 1 },
{ key: 'quality_passes', label: 'Q.Passes', decimals: 0 },
{ key: 'pass_diff', label: 'Pass Diff', decimals: 0 },
{ key: 'laps_led', label: 'Laps Led', decimals: 0 },
{ key: 'pct_top15_laps', label: '% Top15', decimals: 1 },
{ key: 'fastest_laps', label: 'Fastest', decimals: 0 },
{ key: 'stage1_finish', label: 'S1', decimals: 0 },
{ key: 'stage2_finish', label: 'S2', decimals: 0 },
]

const primaryRaces = (cardDriver.rawRaces || []).slice().sort((a, b) => parseInt(a.year) - parseInt(b.year))
const compareRaces = compareDriver ? (compareDriver.rawRaces || []).slice().sort((a, b) => parseInt(a.year) - parseInt(b.year)) : []

// All years from primary driver
const years = [...new Set(primaryRaces.map(r => parseInt(r.year)))].filter(Boolean).sort((a, b) => a - b)

const otherDrivers = mainRows.filter(r => r.driver !== cardDriver.driver).map(r => r.driver).sort()

const cellBase = {
padding: '6px 10px',
fontSize: '0.78rem',
fontFamily: 'var(--font-mono)',
textAlign: 'right',
borderBottom: '1px solid var(--border)',
whiteSpace: 'nowrap',
}

return (
<div
onClick={e => e.stopPropagation()}
style={{
maxWidth: 900, width: '90%', maxHeight: '80vh', overflowY: 'auto',
background: 'var(--bg-card)', borderRadius: 12, padding: 24,
position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
}}
>
{/* Header */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
<div>
<div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent)' }}>
{cardDriver.car_number && (
<span style={{ marginRight: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>#{cardDriver.car_number}</span>
)}
{cardDriver.driver}
</div>
{cardDriver.organization && (
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{cardDriver.organization}</div>
)}
</div>
<button
onClick={onClose}
style={{
background: 'none', border: '1px solid var(--border)', borderRadius: 6,
padding: '4px 10px', cursor: 'pointer', color: 'var(--text-muted)',
fontSize: '0.85rem',
}}
>X</button>
</div>

{/* Compare dropdown */}
<div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
<label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
Compare to:
</label>
<select
value={compareDriver ? compareDriver.driver : ''}
onChange={e => {
const val = e.target.value
onSetCompare(mainRows.find(r => r.driver === val) || null)
}}
style={{
background: 'var(--bg-surface)', border: '1px solid var(--border)',
borderRadius: 6, padding: '5px 10px', color: 'var(--text)',
fontSize: '0.82rem', cursor: 'pointer',
}}
>
<option value="">-- select a driver --</option>
{otherDrivers.map(d => (
<option key={d} value={d}>{d}</option>
))}
</select>
{compareDriver && (
<span style={{ fontSize: '0.78rem', color: '#c9a227', fontWeight: 600 }}>
vs {compareDriver.driver}
</span>
)}
</div>

{/* Stats table */}
{years.length === 0 ? (
<div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '12px 0' }}>
No data at this track.
</div>
) : (
<div style={{ overflowX: 'auto' }}>
<table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 520 }}>
<thead>
<tr>
<th style={{
...cellBase, textAlign: 'left', fontWeight: 700, fontSize: '0.75rem',
color: 'var(--text-secondary)', position: 'sticky', left: 0,
background: 'var(--bg-card)', zIndex: 2, borderBottom: '2px solid var(--border)',
}}>Stat</th>
{years.map(yr => (
<th key={yr} style={{
...cellBase, fontWeight: 700, fontSize: '0.75rem',
color: 'var(--text-secondary)', borderBottom: '2px solid var(--border)',
}}>
{yr}
</th>
))}
</tr>
</thead>
<tbody>
{CARD_COLS.map(col => {
return (
<tr key={col.key}>
<td style={{
...cellBase, textAlign: 'left', fontWeight: 600,
color: 'var(--text-secondary)', position: 'sticky', left: 0,
background: 'var(--bg-card)', zIndex: 1, fontSize: '0.75rem',
}}>
{col.label}
</td>
{years.map(yr => {
const pRace = primaryRaces.find(r => parseInt(r.year) === yr)
const cRace = compareDriver ? compareRaces.find(r => parseInt(r.year) === yr) : null
const pVal = pRace ? pRace[col.key] : null
const cVal = cRace ? cRace[col.key] : null
const finBg = col.key === 'finish_position' ? finishCellColor(pVal) : undefined
return (
<td key={yr} style={{
...cellBase,
background: finBg,
verticalAlign: 'top',
}}>
<div style={{ color: 'var(--accent)', fontWeight: 500 }}>
{fmtRaw(pVal, col.decimals)}
</div>
{compareDriver && (
<div style={{ color: '#c9a227', fontSize: '0.72rem', marginTop: 2 }}>
{fmtRaw(cVal, col.decimals)}
</div>
)}
</td>
)
})}
</tr>
)
})}
</tbody>
</table>
</div>
)}

{compareDriver && (
<div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: '0.75rem' }}>
<span style={{ color: 'var(--accent)', fontWeight: 600 }}>{cardDriver.driver} (primary)</span>
<span style={{ color: '#c9a227', fontWeight: 600 }}>{compareDriver.driver} (compare)</span>
</div>
)}
</div>
</div>
)
}

const sectionHead = {
fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)',
margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.06em',
}
const trackSubtitle = {
fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic',
}
const stickyHead = {
position: 'sticky', top: 0, left: 0, zIndex: 3,
textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600,
color: 'var(--text-secondary)', whiteSpace: 'nowrap',
borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', minWidth: 220,
background: 'var(--bg-base)',
}
const baseHead = {
position: 'sticky', top: 0, zIndex: 2,
padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600,
color: 'var(--text-secondary)', whiteSpace: 'nowrap',
borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
cursor: 'pointer', userSelect: 'none',
}
const stickyCell = {
position: 'sticky', left: 0, zIndex: 1, padding: '8px 16px',
fontSize: '0.8125rem',
borderRight: '1px solid var(--border)', minWidth: 220,
background: 'var(--bg-base)',
}
const numCell = {
padding: '8px 12px', fontSize: '0.8125rem',
fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
}

function DataTable({ rows, title, subtitle, loading, yearCols = [], raceCols = [], onDriverClick }) {
const [sortKey, setSortKey] = useState('avg_rating')
const [sortDir, setSortDir] = useState('desc')

const allCols = [...ENTRY_COLS, ...STAT_COLS, ...COUNT_COLS, ...yearCols, ...raceCols]

const handleSort = (key) => {
if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
else { setSortKey(key); setSortDir('desc') }
}

const sortedRows = [...rows].sort((a, b) => {
const col = allCols.find(c => c.key === sortKey)
if (col && col.isText) {
const av = (a[sortKey] || '').toString()
const bv = (b[sortKey] || '').toString()
return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
}
const av = parseFloat(a[sortKey]) || 0
const bv = parseFloat(b[sortKey]) || 0
return sortDir === 'desc' ? bv - av : av - bv
})

// Rank-based heat only for non-year stat/count cols
const colRanks = {}
allCols.forEach(col => {
if (col.isText || col.noHeat || col.isYear) return
const pairs = sortedRows
.map((r, i) => ({ i, v: parseFloat(r[col.key]) }))
.filter(p => !isNaN(p.v))
if (pairs.length < 2) return
const ranked = [...pairs].sort((a, b) => col.lowerIsBetter ? a.v - b.v : b.v - a.v)
const ranks = {}
let rank = 1
ranked.forEach((p, ri) => {
if (ri > 0 && p.v !== ranked[ri - 1].v) rank = ri + 1
ranks[p.i] = rank
})
colRanks[col.key] = { ranks, total: pairs.length }
})

if (loading) return (
<div style={{ marginBottom: 32 }}>
<h3 style={sectionHead}>{title}</h3>
<div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</div>
</div>
)
if (!rows.length) return (
<div style={{ marginBottom: 32 }}>
<h3 style={sectionHead}>{title}</h3>
<div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data available.</div>
</div>
)

return (
<div style={{ marginBottom: 40 }}>
<h3 style={sectionHead}>{title}</h3>
{subtitle && <div style={trackSubtitle}>{subtitle}</div>}
<div style={{ overflow: 'auto', maxHeight: '72vh', borderRadius: 8, border: '1px solid var(--border)' }}>
<table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
<thead>
<tr>
<th style={stickyHead}>Driver</th>
{allCols.map((col) => {
const isActive = sortKey === col.key
const isYear = !!col.isYear
const isCount = !!col.isCount
const isWin = !!col.isWin
const isFirst = isCount && col.key === 'wins'
return (
<th key={col.key}
style={{
...baseHead,
textAlign: col.isText ? 'left' : 'right',
minWidth: isCount ? 36 : col.minWidth,
padding: isCount ? '10px 8px' : undefined,
color: isActive ? 'var(--accent)'
: isWin ? '#f59e0b'
: isYear ? 'var(--text-primary)'
: 'var(--text-secondary)',
background: isActive ? 'var(--bg-surface)' : 'var(--bg-elevated)',
borderLeft: (isFirst || isYear) ? '1px solid var(--border)' : undefined,
}}
onClick={() => handleSort(col.key)}
title={'Sort by ' + col.label}
>
{isYear
? <><div style={{ fontSize: '0.6rem', opacity: 0.6, letterSpacing: '0.06em', marginBottom: 1 }}>FIN</div>{col.label}</>
: col.label}
{isActive && <span style={{ marginLeft: 4, fontSize: '0.65rem' }}>{sortDir === 'desc' ? 'v' : '^'}</span>}
</th>
)
})}
</tr>
</thead>
<tbody>
{sortedRows.map((row, i) => {
const bg = i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)'
return (
<tr key={row.driver} style={{ background: bg }}>
<td style={{ ...stickyCell, background: bg }}>
<div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
<span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', minWidth: 18, paddingTop: 2 }}>{i + 1}</span>
<div>
<div style={{ fontWeight: i < 3 ? 600 : 400, whiteSpace: 'nowrap' }}>
{row.car_number && <span style={{ marginRight: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{row.car_number}</span>}
<span
style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
onClick={() => onDriverClick && onDriverClick(row)}
>
{row.driver}
</span>
</div>
{row.organization && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{row.organization}</div>}
</div>
</div>
</td>
{allCols.map(col => {
const isYear = !!col.isYear
const isCount = !!col.isCount
const isWin = !!col.isWin
const isFirst = isCount && col.key === 'wins'
const isActive = sortKey === col.key
const rawVal = row[col.key]
const hasWin = isWin && parseInt(rawVal) > 0
const cr = colRanks[col.key]
const heat = cr ? heatBg(cr.ranks[i], cr.total) : null
// Finish position columns use position-based color; stat cols use rank-based
const finPos = isYear ? posHeat(parseInt(rawVal)) : null
return (
<td key={col.key} style={{
...numCell,
textAlign: col.isText ? 'left' : 'right',
padding: isCount ? '8px 8px' : undefined,
color: col.highlight ? 'var(--accent)'
: hasWin ? '#f59e0b'
: isYear ? 'var(--text-primary)'
: undefined,
fontWeight: col.highlight ? 600 : (isYear || hasWin) ? 500 : undefined,
borderLeft: (isFirst || isYear) ? '1px solid var(--border)' : undefined,
background: isActive
? (i % 2 === 0 ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)')
: finPos || heat || undefined,
}}>
{fmtVal(rawVal, col)}
</td>
)
})}
</tr>
)
})}
</tbody>
</table>
</div>
)
}

export default function LoopData({ isSubscriber }) {
const [series, setSeries] = useState('cup')
const [config, setConfig] = useState(null)
const [mainRows, setMainRows] = useState([])
const [allCorrData, setAllCorrData] = useState([])
const [corrAvailableYears, setCorrAvailableYears] = useState([])
const [corrSelectedYears, setCorrSelectedYears] = useState([])
const [corrNames, setCorrNames] = useState([])
const [hasEntryList, setHasEntryList] = useState(false)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const entryMapRef = useRef(null)
const [cardDriver, setCardDriver] = useState(null)
const [compareDriver, setCompareDriver] = useState(null)

useEffect(() => {
const handleKeyDown = (e) => {
if (e.key === 'Escape') setCardDriver(null)
}
window.addEventListener('keydown', handleKeyDown)
return () => window.removeEventListener('keydown', handleKeyDown)
}, [])

useEffect(() => {
let cancelled = false
setLoading(true); setError(null); setConfig(null)
setMainRows([]); setAllCorrData([]); setCorrAvailableYears([])
setCorrSelectedYears([]); setCorrNames([]); setHasEntryList(false)
entryMapRef.current = null

async function load() {
try {
const s = series

const { data: cfg, error: cfgErr } = await supabase
.from('featured_weekend').select('*').eq('series', s).single()
if (cfgErr) throw new Error('Weekend config not set for this series.')
if (cancelled) return
setConfig(cfg)

const { data: entryData } = await supabase
.from('entry_list')
.select('driver_name, car_number, organization')
.eq('series', s)
.eq('race_year', cfg.correlation_year)
.eq('track_name', cfg.track_name)
const { data: aliasData } = await supabase.from('driver_aliases').select('alias, canonical_name')
const aliasLookup = new Map((aliasData || []).map(a => [a.alias, a.canonical_name]))
const normalize = n => {
const clean = n.trim().replace(/\s*\([a-zA-Z]\)\s*$/, '')
return aliasLookup.get(clean) || aliasLookup.get(n) || clean
}
const entryMap = entryData && entryData.length
? new Map(entryData.map(e => { const n = normalize(e.driver_name); return [n, { ...e, driver_name: n }] }))
: null
if (cancelled) return
entryMapRef.current = entryMap
setHasEntryList(!!entryMap)

const { data: trackData, error: trackErr } = await supabase
.from('loop_data')
.select('driver_name, year, finish_position, start_position, avg_position, driver_rating, quality_passes, pass_diff, laps_led, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
.eq('track_name', cfg.track_name).eq('series', s).in('year', cfg.track_years)
if (trackErr) throw trackErr
if (cancelled) return
setMainRows(groupByDriver(trackData || [], entryMap, cfg.track_years, null))

const { data: correlated, error: corrTrackErr } = await supabase
.from('tracks').select('name').eq('correlation_group_label', cfg.correlation_label)
if (corrTrackErr) throw corrTrackErr
const corrNameList = (correlated || []).map(t => t.name)
if (cancelled) return
setCorrNames(corrNameList)

if (corrNameList.length) {
const { data: cd, error: corrErr } = await supabase
.from('loop_data')
.select('driver_name, year, track_name, finish_position, start_position, avg_position, driver_rating, quality_passes, pass_diff, laps_led, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
.in('track_name', corrNameList).eq('series', s)
if (corrErr) throw corrErr
if (cancelled) return

const allCd = cd || []
setAllCorrData(allCd)
const yrs = [...new Set(allCd.map(r => parseInt(r.year)))].filter(Boolean).sort((a, b) => a - b)
setCorrAvailableYears(yrs)
const defaultYr = cfg.correlation_year
setCorrSelectedYears(yrs.includes(defaultYr) ? [defaultYr] : yrs.slice(-1))
}
} catch (e) {
if (!cancelled) setError(e.message)
} finally {
if (!cancelled) setLoading(false)
}
}

load()
return () => { cancelled = true }
}, [series])

// Compute corr race defs + rows dynamically whenever selected years change
const filteredCorrData = allCorrData.filter(r => corrSelectedYears.includes(parseInt(r.year)))

const corrRaceDefs = []
corrSelectedYears.slice().sort((a, b) => a - b).forEach(yr => {
const yearTracks = [...new Set(
allCorrData.filter(r => parseInt(r.year) === yr).map(r => r.track_name)
)].sort()
yearTracks.forEach(tn => {
corrRaceDefs.push({
key: 'rc_' + yr + '_' + sanitizeKey(tn),
year: yr,
track_name: tn,
label: trackLabel(tn, yr),
decimals: 0, isYear: true, minWidth: 52, lowerIsBetter: true,
})
})
})

const corrRows = corrSelectedYears.length > 0
? groupByDriver(filteredCorrData, entryMapRef.current, null, corrRaceDefs)
: []

const mainTitle = config
? config.track_label + ' Averages ' + config.track_years.slice().sort().join('-')
: 'Track Averages'
const corrTitle = config ? config.correlation_label + ' Averages' : 'Correlated Track Averages'
const corrSubtitle = corrNames.length ? corrNames.slice().sort().join(' / ') : null

const yearCols = config
? [...config.track_years].sort((a, b) => a - b).map(yr => ({
key: 'y_' + yr, label: String(yr), decimals: 0, isYear: true, minWidth: 52, lowerIsBetter: true,
}))
: []

const handleCorrYearToggle = (yr) => {
setCorrSelectedYears(prev =>
prev.includes(yr) ? prev.filter(y => y !== yr) : [...prev, yr]
)
}

const handleDriverClick = (row) => {
setCardDriver(row)
setCompareDriver(null)
}

return (
<>
<div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>

<div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
{SERIES_OPTIONS.map(opt => (
<button key={opt.value} onClick={() => setSeries(opt.value)} style={{
padding: '7px 18px', borderRadius: 6, border: '1px solid var(--border)',
background: series === opt.value ? 'var(--accent)' : 'var(--bg-surface)',
color: series === opt.value ? '#fff' : 'var(--text-secondary)',
fontWeight: series === opt.value ? 600 : 400, cursor: 'pointer',
fontSize: '0.85rem', transition: 'all 0.15s',
}}>{opt.label}</button>
))}
</div>

{error && (
<div style={{
padding: '12px 16px', background: 'rgba(239,68,68,0.1)',
border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: 24,
}}>{error}</div>
)}

{!loading && !error && !hasEntryList && (
<div style={{
padding: '9px 14px', background: 'rgba(234,179,8,0.07)',
border: '1px solid rgba(234,179,8,0.22)', borderRadius: 7,
color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 20,
}}>
Entry list not yet configured - showing all available drivers. Add this week's entry list in Admin once Jayski publishes it.
</div>
)}

{loading || mainRows.some(r => r.races > 0)
? <DataTable rows={mainRows} title={mainTitle} loading={loading} yearCols={yearCols} onDriverClick={handleDriverClick} />
: !error && config && (
<div style={{
padding: '9px 14px', background: 'rgba(99,102,241,0.07)',
border: '1px solid rgba(99,102,241,0.22)', borderRadius: 7,
color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 20,
}}>
No loop data history for {config.track_label} - showing correlated track data only.
</div>
)
}

{!loading && !error && (
<>
<YearPicker
label="Race Years"
availableYears={corrAvailableYears}
selectedYears={corrSelectedYears}
onToggle={handleCorrYearToggle}
/>
{corrSelectedYears.length === 0
? <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
Select at least one year to view correlated track data.
</div>
: <DataTable rows={corrRows} title={corrTitle} subtitle={corrSubtitle} loading={false} raceCols={corrRaceDefs} onDriverClick={handleDriverClick} />
}
</>
)}



</div>
{cardDriver && (
<DriverCard
cardDriver={cardDriver}
compareDriver={compareDriver}
mainRows={mainRows}
onClose={() => setCardDriver(null)}
onSetCompare={setCompareDriver}
/>
)}
</>)
}
