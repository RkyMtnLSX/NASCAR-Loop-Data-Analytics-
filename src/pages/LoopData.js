import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_OPTIONS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

const COLS = [
  { key: 'races',            label: 'Races',      decimals: 0 },
  { key: 'avg_start',        label: 'Avg St',     decimals: 1 },
  { key: 'avg_finish',       label: 'Avg Fin',    decimals: 1 },
  { key: 'avg_mid',          label: 'Avg Mid',    decimals: 1 },
  { key: 'avg_rating',       label: 'Drv Rtg',    decimals: 1, highlight: true },
  { key: 'avg_qp',           label: 'Qual Pass',  decimals: 1 },
  { key: 'avg_pass_diff',    label: 'Pass Diff',  decimals: 1, signed: true },
  { key: 'avg_laps_led_pct', label: 'Laps Led%',  decimals: 1, pct: true },
  { key: 'avg_top15_pct',    label: 'Top 15%',    decimals: 1, pct: true },
  { key: 'avg_fastest',      label: 'Fast Laps',  decimals: 1 },
  { key: 'avg_stage1',       label: 'Stg 1',      decimals: 1 },
  { key: 'avg_stage2',       label: 'Stg 2',      decimals: 1 },
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

function groupByDriver(rows) {
  const map = {}
  rows.forEach(row => {
    const name = row.driver_name
    if (!map[name]) map[name] = []
    map[name].push(row)
  })
  return Object.entries(map)
    .map(([driver, dRows]) => ({ driver, ...computeDriverAvg(dRows) }))
    .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
}

function fmtVal(val, col) {
  if (val == null || (typeof val === 'number' && isNaN(val))) return '—'
  const v = parseFloat(val)
  if (isNaN(v)) return '—'
  const fixed = v.toFixed(col.decimals)
  if (col.signed && v > 0) return '+' + fixed
  if (col.pct) return fixed + '%'
  return fixed
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const sectionHead = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: '0 0 4px 0',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}
const trackSubtitle = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  marginBottom: 10,
  fontStyle: 'italic',
}
const stickyHead = {
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: 'var(--bg-elevated)',
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  minWidth: 180,
}
const numHead = {
  padding: '10px 12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
  userSelect: 'none',
}
const stickyCell = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  padding: '8px 16px',
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border)',
  minWidth: 180,
}
const numCell = {
  padding: '8px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

// ─────────────────────────────────────────────
// DataTable component
// ─────────────────────────────────────────────
function DataTable({ rows, title, subtitle, loading }) {
  const [sortKey, setSortKey] = useState('avg_rating')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
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
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800 }}>
          <thead>
            <tr>
              <th style={stickyHead}>Driver</th>
              {COLS.map(col => {
                const isActive = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    style={{
                      ...numHead,
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--bg-card)' : 'var(--bg-elevated)',
                    }}
                    onClick={() => handleSort(col.key)}
                    title={`Sort by ${col.label}`}
                  >
                    {col.label}
                    {isActive && (
                      <span style={{ marginLeft: 4, fontSize: '0.65rem' }}>
                        {sortDir === 'desc' ? '▼' : '▲'}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row.driver} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)' }}>
                <td style={{
                  ...stickyCell,
                  background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)',
                  fontWeight: i < 3 ? 600 : 400,
                }}>
                  <span style={{
                    marginRight: 8,
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    minWidth: 20,
                    display: 'inline-block',
                  }}>{i + 1}</span>
                  {row.driver}
                </td>
                {COLS.map(col => (
                  <td key={col.key} style={{
                    ...numCell,
                    color: col.highlight ? 'var(--accent)' : undefined,
                    fontWeight: col.highlight ? 600 : undefined,
                    background: sortKey === col.key
                      ? (i % 2 === 0 ? 'rgba(var(--accent-rgb,99,102,241),0.06)' : 'rgba(var(--accent-rgb,99,102,241),0.04)')
                      : undefined,
                  }}>
                    {fmtVal(row[col.key], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main LoopData page
// ─────────────────────────────────────────────
export default function LoopData({ isSubscriber }) {
  const [series, setSeries]       = useState('cup')
  const [config, setConfig]       = useState(null)
  const [mainRows, setMainRows]   = useState([])
  const [corrRows, setCorrRows]   = useState([])
  const [corrNames, setCorrNames] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setConfig(null)
    setMainRows([])
    setCorrRows([])
    setCorrNames([])

    async function load() {
      try {
        const s = series

        // 1. Featured weekend config
        const { data: cfg, error: cfgErr } = await supabase
          .from('featured_weekend')
          .select('*')
          .eq('series', s)
          .single()
        if (cfgErr) throw new Error('Weekend config not set for this series.')
        if (cancelled) return
        setConfig(cfg)

        // 2. Track-specific averages
        const { data: trackData, error: trackErr } = await supabase
          .from('loop_data')
          .select('driver_name, start_position, finish_position, avg_position, driver_rating, quality_passes, pass_diff, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
          .eq('track_name', cfg.track_name)
          .eq('series', s)
          .in('year', cfg.track_years)
        if (trackErr) throw trackErr
        if (cancelled) return
        setMainRows(groupByDriver(trackData || []))

        // 3. Get correlated track names (all tracks in the same group)
        const { data: correlated, error: corrTrackErr } = await supabase
          .from('tracks')
          .select('name')
          .eq('correlation_group_label', cfg.correlation_label)
        if (corrTrackErr) throw corrTrackErr
        const corrNameList = (correlated || []).map(t => t.name)
        if (cancelled) return
        setCorrNames(corrNameList)

        // 4. Correlated tracks for the selected year
        let corrData = []
        if (corrNameList.length) {
          const { data: cd, error: corrErr } = await supabase
            .from('loop_data')
            .select('driver_name, start_position, finish_position, avg_position, driver_rating, quality_passes, pass_diff, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
            .in('track_name', corrNameList)
            .eq('series', s)
            .eq('year', cfg.correlation_year)
          if (corrErr) throw corrErr
          corrData = cd || []
        }
        if (cancelled) return
        setCorrRows(groupByDriver(corrData))
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
    ? `${config.track_label} Averages ${config.track_years.slice().sort().join('–')}`
    : 'Track Averages'

  const corrTitle = config
    ? `${config.correlation_label} Averages ${config.correlation_year}`
    : 'Correlated Track Averages'

  const corrSubtitle = corrNames.length
    ? corrNames.slice().sort().join(' • ')
    : null

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Series tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {SERIES_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSeries(opt.value)}
            style={{
              padding: '7px 18px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: series === opt.value ? 'var(--accent)' : 'var(--bg-card)',
              color: series === opt.value ? '#fff' : 'var(--text-secondary)',
              fontWeight: series === opt.value ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {/* Main track table */}
      <DataTable
        rows={mainRows}
        title={mainTitle}
        loading={loading}
      />

      {/* Correlated tracks table */}
      {!loading && !error && (
        <DataTable
          rows={corrRows}
          title={corrTitle}
          subtitle={corrSubtitle}
          loading={false}
        />
      )}
    </div>
  )
}
