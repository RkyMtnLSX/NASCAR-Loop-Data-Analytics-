import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'truck',   label: 'Truck Series' },
]

// Values stored as percentages (e.g. 60.9), not decimals
const fmt    = (n, dec = 1) => n == null ? '-' : (+n).toFixed(dec) + '%'
const fmtDK  = (n)          => n == null ? '' : (+n).toFixed(2)
const fmtNum = (n, dec = 1) => n == null ? '' : (+n).toFixed(dec)

export default function SimResults() {
  const [series, setSeries]       = useState('cup')
  const [mvMkt, setMvMkt] = useState('Win')
  const [mvUnits, setMvUnits] = useState('odds')
  const [mvSort, setMvSort] = useState('edge')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [sortAsc, setSortAsc]     = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    supabase
      .from('sim_results')
      .select('*')
      .eq('series', series)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: row, error: err }) => {
        if (err && err.code !== 'PGRST116') setError('No published results yet.')
        else if (row) setData(row)
        else setError('No published results yet.')
        setLoading(false)
      })
  }, [series])

  const results = data?.results || []

  const sorted = [...results].sort((a, b) => {
    const aVal = a.proj_finish ?? 99
    const bVal = b.proj_finish ?? 99
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  const tabStyle = (s) => ({
    padding: '8px 18px', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.875rem',
    background: series === s ? 'var(--accent)' : 'var(--bg-surface)',
    color: series === s ? '#111' : 'var(--text-secondary)',
  })

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem',
    fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle = {
    padding: '10px 12px', fontSize: '0.85rem',
    borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
  }
  const pctStyle = (v, hi) => ({
    ...tdStyle,
    color: v >= hi ? '#4ade80' : v >= hi * 0.5 ? 'var(--text-primary)' : 'var(--text-muted)',
    fontWeight: v >= hi ? 700 : 400,
  })

  const sortableThStyle = {
    ...thStyle,
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} style={tabStyle(t.value)} onClick={() => setSeries(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {data && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.track_name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Published {new Date(data.published_at).toLocaleString()}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{results.length} drivers</span>
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading</div>}
      {error   && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>{error}</div>}

      {!loading && !error && sorted.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Driver</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Start</th>
                <th
                  style={sortableThStyle}
                  onClick={() => setSortAsc(v => !v)}
                  title="Click to flip sort order"
                >
                  Proj Finish {sortAsc ? '' : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Proj DK</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Win%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 3%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 5%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 10%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Laps Led</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Fast Laps</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>DNF%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.driver_name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', width: 32 }}>{i + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      {(series === 'cup' || series === 'oreilly' || series === 'trucks') && d.car_number ? (
                        <img
                          src={series === 'cup' ? `/car-numbers/${d.car_number}.png` : series === 'oreilly' ? `/car-numbers-oreilly/${d.car_number}.png` : `/car-numbers-trucks/${d.car_number}.png`}
                          alt={`#${d.car_number}`}
                          style={{ height: 28, width: 'auto', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none'
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline'
                          }}
                        />
                      ) : null}
                      {(series === 'cup' || series === 'oreilly') && d.car_number ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'none' }}>
                          #{d.car_number}
                        </span>
                      ) : d.car_number ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          #{d.car_number}
                        </span>
                      ) : null}
                      {d.driver_name}
                    </div>
                    {d.organization && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {d.organization}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.start_pos ?? ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{d.proj_finish != null ? (+d.proj_finish).toFixed(1) : ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{fmtDK(d.proj_dk)}</td>
                  <td style={{ ...pctStyle(d.win_pct, 5), textAlign: 'center' }}>{fmt(d.win_pct)}</td>
                  <td style={{ ...pctStyle(d.top3_pct, 10), textAlign: 'center' }}>{fmt(d.top3_pct)}</td>
                  <td style={{ ...pctStyle(d.top5_pct, 15), textAlign: 'center' }}>{fmt(d.top5_pct)}</td>
                  <td style={{ ...pctStyle(d.top10_pct, 25), textAlign: 'center' }}>{fmt(d.top10_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmtNum(d.laps_led)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmtNum(d.fast_laps)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmt(d.dnf_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        {(() => {
  var withMv = (sorted || []).filter(function (d) { return d && d.mv; });
  if (!withMv.length) return null;
  var MK = { Win: { sf: 'win_pct', o: 'owin', ev: 'evwin', dv: 'dvwin' }, 'Top 3': { sf: 'top3_pct', o: 'ot3', ev: 'evt3', dv: 'dvt3' }, 'Top 5': { sf: 'top5_pct', o: 'ot5', ev: 'evt5', dv: 'dvt5' }, 'Top 10': { sf: 'top10_pct', o: 'ot10', ev: 'evt10', dv: 'dvt10' } };
  var conf = MK[mvMkt] || MK.Win;
  var fairOdds = function (p) { if (p <= 0) return null; if (p >= 1) return -100000; return p >= 0.5 ? Math.round(-100 * p / (1 - p)) : Math.round(100 * (1 - p) / p); };
  var fo = function (a) { return a == null ? '-' : (a > 0 ? '+' + a : '' + a); };
  var rows = withMv.map(function (d) { var p = (d[conf.sf] || 0) / 100; return { name: d.driver_name, price: d.mv[conf.o], mktPct: d.mv[conf.dv], modelPct: d[conf.sf] || 0, fair: fairOdds(p), ev: d.mv[conf.ev] }; }).filter(function (r) { return r.price != null; });
  rows.sort(function (a, b) { return mvSort === 'edge' ? (b.ev - a.ev) : mvSort === 'model' ? (b.modelPct - a.modelPct) : (b.mktPct - a.mktPct); });
  var odds = mvUnits === 'odds';
  var thc = { padding: '7px 8px', color: '#8a8a8a', fontSize: 11, fontWeight: 500, borderBottom: '0.5px solid #333' };
  var seg = function (cur, set, val, label) { return <button onClick={function () { set(val); }} style={{ padding: '5px 10px', fontSize: 12, border: 'none', background: cur === val ? '#262626' : 'transparent', color: cur === val ? '#fff' : '#9a9a9a', cursor: 'pointer' }}>{label}</button>; };
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Market value - model vs DraftKings</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Fair is the model projection as an American price. Green edge = positive EV at DK's number.</div>
      <div style={{ marginBottom: 10 }}>{['Win', 'Top 3', 'Top 5', 'Top 10'].map(function (k) { return <button key={k} onClick={function () { setMvMkt(k); }} style={{ padding: '6px 14px', borderRadius: 999, border: '0.5px solid ' + (mvMkt === k ? '#e8c766' : '#333'), background: mvMkt === k ? '#262626' : 'transparent', color: mvMkt === k ? '#f5c518' : '#9a9a9a', fontSize: 13, cursor: 'pointer', marginRight: 4 }}>{k}</button>; })}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: '#888', marginBottom: 10 }}>
        <span>units <span style={{ border: '0.5px solid #333', borderRadius: 6, overflow: 'hidden', display: 'inline-flex' }}>{seg(mvUnits, setMvUnits, 'odds', 'Odds')}{seg(mvUnits, setMvUnits, 'pct', '%')}</span></span>
        <span>sort <span style={{ border: '0.5px solid #333', borderRadius: 6, overflow: 'hidden', display: 'inline-flex' }}>{seg(mvSort, setMvSort, 'edge', 'Edge')}{seg(mvSort, setMvSort, 'model', 'Model')}{seg(mvSort, setMvSort, 'mkt', 'Favorite')}</span></span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>
          <th style={{ ...thc, textAlign: 'left' }}>#</th>
          <th style={{ ...thc, textAlign: 'left' }}>Driver</th>
          <th style={{ ...thc, textAlign: 'right' }}>{odds ? 'DK price' : 'DK implied'}</th>
          <th style={{ ...thc, textAlign: 'right' }}>{odds ? 'Fair (model)' : 'Model %'}</th>
          <th style={{ ...thc, textAlign: 'right' }}>Edge</th>
        </tr></thead>
        <tbody>
          {rows.map(function (r, i) {
            var mkt = odds ? fo(r.price) : (r.mktPct != null ? r.mktPct.toFixed(1) + '%' : '-');
            var mod = odds ? fo(r.fair) : (r.modelPct.toFixed(1) + '%');
            return <tr key={i}>
              <td style={{ padding: '7px 8px', textAlign: 'left', color: '#8a8a8a' }}>{i + 1}</td>
              <td style={{ padding: '7px 8px', textAlign: 'left' }}>{r.name}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{mkt}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{mod}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{r.ev > 0 ? <span style={{ background: '#123d24', color: '#3fb950', padding: '2px 7px', borderRadius: 999, fontWeight: 500 }}>+{Math.round(r.ev)}%</span> : <span style={{ color: '#8a8a8a' }}>{Math.round(r.ev)}%</span>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
})()}
</div>
      )}
    </div>
  )
}