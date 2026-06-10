import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_OPTIONS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

// Identity columns from entry list (text, left-aligned)
const ENTRY_COLS = [
  { key: 'car_number',   label: '#',    isText: true, minWidth: 44 },
  { key: 'organization', label: 'Team', isText: true, minWidth: 150 },
]

// Stat columns (numeric averages)
const STAT_COLS = [
  { key: 'races',            label: 'Races',     decimals: 0 },
  { key: 'avg_start',        label: 'Avg St',    decimals: 1 },
  { key: 'avg_finish',       label: 'Avg Fin',   decimals: 1 },
  { key: 'avg_mid',          label: 'Avg Mid',   decimals: 1 },
  { key: 'avg_rating',       label: 'Drv Rtg',   decimals: 1, highlight: true },
  { key: 'avg_qp',           label: 'Qual Pass', decimals: 1 },
  { key: 'avg_pass_diff',    label: 'Pass Diff', decimals: 1, signed: true },
  { key: 'avg_laps_led_pct', label: 'Laps Led%', decimals: 1, pct: true },
  { key: 'avg_top15_pct',    label: 'Top 15%',   decimals: 1, pct: true },
  { key: 'avg_fastest',      label: 'Fast Laps', decimals: 1 },
  { key: 'avg_stage1',       label: 'Stg 1',     decimals: 1 },
  { key: 'avg_stage2',       label: 'Stg 2',     decimals: 1 },
]

function computeDriverAvg(rows) {
  const n = rows.length
  if (!n) return null
  const sum = (key) => rows.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0)
  return {
    races:            n,
    avg_start:        sum('start_position') / n,
    avg_finish:       sum('finish_position') / n,
    avg_mid:          sum('avg_position') / n,
    avg_rating:       sum('driver_rating') / n,
    avg_qp:           sum('quality_passes') / n,
    avg_pass_diff:    sum('pass_diff') / n,
    avg_laps_led_pct: sum('pct_laps_led') / n,
    avg_top15_pct:    sum('pct_top15_laps') / n,
    avg_fastest:      sum('fastest_laps') / n,
    avg_stage1:       sum('stage1_finish') / n,
    avg_stage2:       sum('stage2_finish') / n,
  }
}

// entryMap: Map<driver_name, {car_number, organization}> | null
// trackYears: int[] for per-year finish columns, null = skip
function groupByDriver(rows, entryMap, trackYears) {
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

      // Per-year finish at this track
      const yearFinishes = {}
      if (trackYears) {
        dRows.forEach(r => {
          const yr = parseInt(r.year)
          if (yr && trackYears.includes(yr)) {
            const fin = parseInt(r.finish_position)
            const existing = yearFinishes['y_' + yr]
            if (fin && (!existing || fin < existing)) yearFinishes['y_' + yr] = fin
          }
        })
      }

      return {
        driver,
        car_number:   entry.car_number   || null,
        organization: entry.organization || null,
        ...stats,
        ...yearFinishes,
      }
    })
    .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
}

function fmtVal(val, col) {
  if (val == null || (typeof val === 'number' && isNaN(val))) return '—'
  if (col.isText || col.isYear) return val != null ? String(val) : '—'
  const v = parseFloat(val)
  if (isNaN(v)) return '—'
  const fixed = v.toFixed(col.decimals)
  if (col.signed && v > 0) return '+' + fixed
  if (col.pct) return fixed + '%'
  return fixed
}

// ─── Styles ────────────────────────────────────
const sectionHead = {
  fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)',
  margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.06em',
}
const trackSubtitle = {
  fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic',
}
const stickyHead = {
  position: 'sticky', top: 0, left: 0, zIndex: 3, background: 'var(--bg-elevated)',
  textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', minWidth: 170, maxWidth: 180,
  overflow: 'hidden', textOverflow: 'ellipsis',
  background: 'var(--bg-base)',
}
const baseHead = {
  position: 'sticky', top: 0, background: 'var(--bg-elevated)',
  padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
  cursor: 'pointer', userSelect: 'none',
}
const stickyCell = {
  position: 'sticky', left: 0, zIndex: 1, padding: '8px 16px',
  fontSize: '0.8125rem', whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border)', minWidth: 170, maxWidth: 180,
  overflow: 'hidden', textOverflow: 'ellipsis',
  background: 'var(--bg-base)',
}
const numCell = {
  padding: '8px 12px', fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
}

// ─── DataTable ──────────────────────────────────
function DataTable({ rows, title, subtitle, loading, yearCols = [] }) {
  const [sortKey, setSortKey] = useState('avg_rating')
  const [sortDir, setSortDir] = useState('desc')

  const allCols = [...ENTRY_COLS, ...yearCols, ...STAT_COLS]

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

  if (loading) return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={sectionHead}>{title}</h3>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
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
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={stickyHead}>Driver</th>
              {allCols.map(col => {
                const isActive = sortKey === col.key
                const isYear   = !!col.isYear
                return (
                  <th key={col.key}
                    style={{
                      ...baseHead,
                      textAlign: col.isText ? 'left' : 'right',
                      minWidth: col.minWidth,
                      color: isActive ? 'var(--accent)' : isYear ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--bg-card)' : isYear ? 'rgba(99,102,241,0.07)' : 'var(--bg-elevated)',
                      borderLeft: isYear ? '1px solid var(--border)' : undefined,
                    }}
                    onClick={() => handleSort(col.key)}
                    title={'Sort by ' + col.label}
                  >
                    {col.label}
                    {isActive && <span style={{ marginLeft: 4, fontSize: '0.65rem' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const bg = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)'
              return (
                <tr key={row.driver} style={{ background: bg }}>
                  <td style={{ ...stickyCell, background: bg, fontWeight: i < 3 ? 600 : 400 }}>
                    <span style={{
                      marginRight: 8, color: 'var(--text-muted)', fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)', minWidth: 18, display: 'inline-block',
                    }}>{i + 1}</span>
                    {row.driver}
                  </td>
                  {allCols.map(col => {
                    const isYear   = !!col.isYear
                    const isActive = sortKey === col.key
                    return (
                      <td key={col.key} style={{
                        ...numCell,
                        textAlign: col.isText ? 'left' : 'right',
                        color: col.highlight ? 'var(--accent)' : isYear ? 'var(--text-primary)' : undefined,
                        fontWeight: col.highlight ? 600 : isYear ? 500 : undefined,
                        borderLeft: isYear ? '1px solid var(--border)' : undefined,
                        background: isActive
                          ? (i % 2 === 0 ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)')
                          : isYear
                          ? (i % 2 === 0 ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.02)')
                          : undefined,
                      }}>
                        {fmtVal(row[col.key], col)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────
export default function LoopData({ isSubscriber }) {
  const [series, setSeries]             = useState('cup')
  const [config, setConfig]             = useState(null)
  const [mainRows, setMainRows]         = useState([])
  const [corrRows, setCorrRows]         = useState([])
  const [corrNames, setCorrNames]       = useState([])
  const [hasEntryList, setHasEntryList] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setConfig(null)
    setMainRows([]); setCorrRows([]); setCorrNames([])
    setHasEntryList(false)

    async function load() {
      try {
        const s = series

        // 1. Featured weekend config
        const { data: cfg, error: cfgErr } = await supabase
          .from('featured_weekend').select('*').eq('series', s).single()
        if (cfgErr) throw new Error('Weekend config not set for this series.')
        if (cancelled) return
        setConfig(cfg)

        // 2. Entry list
        const { data: entryData } = await supabase
          .from('entry_list')
          .select('driver_name, car_number, organization')
          .eq('series', s)
          .eq('race_year', cfg.correlation_year)
          .eq('track_name', cfg.track_name)
            // 2b. Name aliases
        const { data: aliasData } = await supabase.from('driver_aliases').select('alias, canonical_name')
        const aliasLookup = new Map((aliasData || []).map(a => [a.alias, a.canonical_name]))
        const normalize = n => { const clean = n.trim().replace(/\s*\([a-zA-Z]\)\s*$/, ''); return aliasLookup.get(clean) || aliasLookup.get(n) || clean; }
        const entryMap = entryData && entryData.length
          ? new Map(entryData.map(e => { const n = normalize(e.driver_name); return [n, {...e, driver_name: n}] }))
          : null
        if (cancelled) return
        setHasEntryList(!!entryMap)

        // 3. Main track data
        const { data: trackData, error: trackErr } = await supabase
          .from('loop_data')
          .select('driver_name, year, finish_position, start_position, avg_position, driver_rating, quality_passes, pass_diff, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
          .eq('track_name', cfg.track_name).eq('series', s).in('year', cfg.track_years)
        if (trackErr) throw trackErr
        if (cancelled) return
        setMainRows(groupByDriver(trackData || [], entryMap, cfg.track_years))

        // 4. Correlated track names
        const { data: correlated, error: corrTrackErr } = await supabase
          .from('tracks').select('name').eq('correlation_group_label', cfg.correlation_label)
        if (corrTrackErr) throw corrTrackErr
        const corrNameList = (correlated || []).map(t => t.name)
        if (cancelled) return
        setCorrNames(corrNameList)

        // 5. Correlated loop data
        if (corrNameList.length) {
          const { data: cd, error: corrErr } = await supabase
            .from('loop_data')
            .select('driver_name, year, finish_position, start_position, avg_position, driver_rating, quality_passes, pass_diff, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
            .in('track_name', corrNameList).eq('series', s).eq('year', cfg.correlation_year)
          if (corrErr) throw corrErr
          if (!cancelled) setCorrRows(groupByDriver(cd || [], entryMap, null))
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

  const mainTitle = config
    ? config.track_label + ' Averages ' + config.track_years.slice().sort().join('–')
    : 'Track Averages'
  const corrTitle = config
    ? config.correlation_label + ' Averages ' + config.correlation_year
    : 'Correlated Track Averages'
  const corrSubtitle = corrNames.length ? corrNames.slice().sort().join(' • ') : null

  const yearCols = config
    ? [...config.track_years].sort((a, b) => a - b).map(yr => ({
        key: 'y_' + yr, label: String(yr), decimals: 0, isYear: true, minWidth: 52,
      }))
    : []

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1300, margin: '0 auto' }}>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {SERIES_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setSeries(opt.value)} style={{
            padding: '7px 18px', borderRadius: 6, border: '1px solid var(--border)',
            background: series === opt.value ? 'var(--accent)' : 'var(--bg-card)',
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
          Entry list not yet configured — showing all available drivers. Add this week’s entry list in Admin once Jayski publishes it.
        </div>
      )}

      <DataTable rows={mainRows} title={mainTitle} loading={loading} yearCols={yearCols} />

      {!loading && !error && (
        <DataTable rows={corrRows} title={corrTitle} subtitle={corrSubtitle} loading={false} yearCols={[]} />
      )}

    </div>
  )
}
