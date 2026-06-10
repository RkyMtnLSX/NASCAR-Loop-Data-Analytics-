import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_OPTIONS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

// Columns to display in both tables
const COLS = [
  { key: 'races',             label: 'Races',      decimals: 0 },
  { key: 'avg_start',         label: 'Avg St',     decimals: 1 },
  { key: 'avg_finish',        label: 'Avg Fin',    decimals: 1 },
  { key: 'avg_mid',           label: 'Avg Mid',    decimals: 1 },
  { key: 'avg_rating',        label: 'Drv Rtg',    decimals: 1, highlight: true },
  { key: 'avg_qp',            label: 'Qual Pass',  decimals: 1 },
  { key: 'avg_pass_diff',     label: 'Pass Diff',  decimals: 1, signed: true },
  { key: 'avg_laps_led_pct',  label: 'Laps Led%',  decimals: 1, pct: true },
  { key: 'avg_top15_pct',     label: 'Top 15%',    decimals: 1, pct: true },
  { key: 'avg_fastest',       label: 'Fast Laps',  decimals: 1 },
  { key: 'avg_stage1',        label: 'Stg 1',      decimals: 1 },
  { key: 'avg_stage2',        label: 'Stg 2',      decimals: 1 },
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
    avg_stage1:       rows.filter(r => r.stage1_finish != null).length
                        ? rows.filter(r => r.stage1_finish != null).reduce((s,r) => s + r.stage1_finish, 0)
                          / rows.filter(r => r.stage1_finish != null).length
                        : null,
    avg_stage2:       rows.filter(r => r.stage2_finish != null).length
                        ? rows.filter(r => r.stage2_finish != null).reduce((s,r) => s + r.stage2_finish, 0)
                          / rows.filter(r => r.stage2_finish != null).length
                        : null,
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

function DataTable({ rows, title, loading }) {
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
    <div style={{ marginBottom: 36 }}>
      <h3 style={sectionHead}>{title}</h3>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900, width: '100%' }}>
          <thead>
            <tr>
              <th style={stickyHead}>Driver</th>
              {COLS.map(c => (
                <th key={c.key} style={{ ...numHead, color: c.highlight ? 'var(--accent)' : undefined }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.driver} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)' }}>
                <td style={{ ...stickyCell, background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)', fontWeight: i < 3 ? 600 : 400 }}>
                  <span style={{ marginRight: 8, color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', minWidth: 20, display: 'inline-block' }}>{i + 1}</span>
                  {row.driver}
                </td>
                {COLS.map(c => (
                  <td key={c.key} style={{
                    ...numCell,
                    color: c.highlight ? 'var(--accent)' : undefined,
                    fontWeight: c.highlight ? 600 : undefined,
                  }}>
                    {fmtVal(row[c.key], c)}
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

// ─── Styles ───────────────────────────────────────────────────
const sectionHead = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
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
// ──────────────────────────────────────────────────────────────

export default function LoopData({ isSubscriber }) {
  const [series, setSeries]       = useState('cup')
  const [config, setConfig]       = useState(null)
  const [trackRows, setTrackRows] = useState([])
  const [corrRows, setCorrRows]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => { loadData(series) }, [series]) // eslint-disable-line

  async function loadData(s) {
    setLoading(true)
    setError(null)
    setTrackRows([])
    setCorrRows([])
    try {
      // 1. Weekend config for this series
      const { data: cfg, error: cfgErr } = await supabase
        .from('featured_weekend')
        .select('*')
        .eq('series', s)
        .single()
      if (cfgErr) throw new Error('Weekend config not set for this series.')
      setConfig(cfg)

      // 2. Track-specific averages
      const { data: trackData, error: trackErr } = await supabase
        .from('loop_data')
        .select('driver_name, start_position, finish_position, avg_position, driver_rating, quality_passes, pass_diff, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
        .eq('track_name', cfg.track_name)
        .eq('series', s)
        .in('year', cfg.track_years)
      if (trackErr) throw trackErr

      // 3. Get correlated track names
      const { data: correlated, error: corrTrackErr } = await supabase
        .from('tracks')
        .select('name')
        .eq('correlation_group_label', cfg.correlation_label)
      if (corrTrackErr) throw corrTrackErr
      const corrNames = correlated.map(t => t.name)

      // 4. Correlated tracks for the selected year
      let corrData = []
      if (corrNames.length) {
        const { data: cd, error: corrErr } = await supabase
          .from('loop_data')
          .select('driver_name, start_position, finish_position, avg_position, driver_rating, quality_passes, pass_diff, pct_laps_led, pct_top15_laps, fastest_laps, stage1_finish, stage2_finish')
          .in('track_name', corrNames)
          .eq('series', s)
          .eq('year', cfg.correlation_year)
        if (corrErr) throw corrErr
        corrData = cd
      }

      setTrackRows(groupByDriver(trackData || []))
      setCorrRows(groupByDriver(corrData))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const trackTitle = config
    ? `${config.track_label} Averages ${config.track_years.slice().sort().join('–')}`
    : 'Track Averages'
  const corrTitle = config
    ? `${config.correlation_label} Averages ${config.correlation_year}`
    : 'Correlated Track Averages'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Loop Data</h1>
        <p className="page-subtitle">
          {config ? `${config.track_label} — ${config.correlation_label}` : 'Race averages by track and correlation group'}
        </p>
      </div>

      {/* Series tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {SERIES_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSeries(opt.value)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid ' + (series === opt.value ? 'var(--accent)' : 'var(--border)'),
              background: series === opt.value ? 'var(--accent)' : 'transparent',
              color: series === opt.value ? '#000' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: series === opt.value ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#922B2120', border: '1px solid #922B2140', borderRadius: 'var(--radius-md)', color: '#E74C3C', fontSize: '0.8125rem', marginBottom: 24 }}>
          {error}
        </div>
      )}

      {!error && (
        <>
          <DataTable rows={trackRows} title={trackTitle} loading={loading} />
          <DataTable rows={corrRows}  title={corrTitle}  loading={loading} />
        </>
      )}
    </div>
  )
}
