import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function __parseFinish(txt, board) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(jr|sr|iii|ii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
  const byFull = {}, byCar = {}, lastCount = {}, byLast = {}
  board.forEach(d => {
    const full = norm(d.driver_name)
    byFull[full] = d
    byCar[String(d.car_number)] = d
    const last = full.split(' ').slice(-1)[0]
    lastCount[last] = (lastCount[last] || 0) + 1
    byLast[last] = d
  })
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean)
  const actualMap = {}, matched = [], unmatched = []
  let pos = 0
  lines.forEach(line => {
    const nl = norm(line)
    let d = null
    for (const f in byFull) { if (f && nl.indexOf(f) >= 0) { d = byFull[f]; break } }
    if (!d) { const toks = nl.split(' '); for (const t of toks) { if (lastCount[t] === 1) { d = byLast[t]; break } } }
    if (!d) { const cars = line.match(/\b\d{1,2}\b/g) || []; for (const cc of cars) { if (byCar[cc]) { d = byCar[cc]; break } } }
    if (d) { if (!actualMap[String(d.car_number)]) { pos++; actualMap[String(d.car_number)] = pos; matched.push(d.driver_name) } }
    else unmatched.push(line.slice(0, 40))
  })
  return { actualMap, matched, unmatched }
}

function __gradeRace(board, actualMap) {
  const dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
  const Ncut = { win: 1, t3: 3, t5: 5, t10: 10 }
  const rows = board.map(d => ({ name: d.driver_name, car: String(d.car_number), pf: d.proj_finish, win: d.win_pct, t3: d.top3_pct, t5: d.top5_pct, t10: d.top10_pct, mv: d.mv, act: actualMap[String(d.car_number)] })).filter(d => d.act != null)
  const n = rows.length
  const spearman = (a, b) => { const rk = x => { const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(x.length); idx.forEach((p, i) => r[p[1]] = i + 1); return r }; const ra = rk(a), rb = rk(b); let d2 = 0; for (let i = 0; i < a.length; i++) d2 += (ra[i] - rb[i]) * (ra[i] - rb[i]); return +(1 - 6 * d2 / (a.length * (a.length * a.length - 1))).toFixed(3) }
  const act = rows.map(r => r.act)
  const mae = +(rows.reduce((s, r) => s + Math.abs(r.pf - r.act), 0) / n).toFixed(2)
  const ind = N => rows.map(r => r.act <= N ? 1 : 0)
  const brier = (probs, ii) => +(probs.reduce((s, p, i) => s + (p / 100 - ii[i]) * (p / 100 - ii[i]), 0) / n).toFixed(4)
  const metrics = { n: n, mae: mae, spearman_pf: spearman(rows.map(r => r.pf), act), win_brier: brier(rows.map(r => r.win), ind(1)), top3_brier: brier(rows.map(r => r.t3), ind(3)), top5_brier: brier(rows.map(r => r.t5), ind(5)), top10_brier: brier(rows.map(r => r.t10), ind(10)) }
  const prec = (key, N) => rows.slice().sort((a, b) => b[key] - a[key]).slice(0, N).filter(d => d.act <= N).length
  metrics.prec = { win: prec('win', 1), t3: prec('t3', 3), t5: prec('t5', 5), t10: prec('t10', 10) }
  const evFlags = []
  rows.forEach(r => { if (!r.mv) return; ['win', 't3', 't5', 't10'].forEach(mk => { const m = r.mv[mk]; if (!m || m.ev == null || m.ev <= 0) return; evFlags.push({ driver: r.name, market: mk, price: m.best, book: (m.bb || '').toUpperCase(), ev: m.ev, mev: m.mev, hit: r.act <= Ncut[mk] }) }) })
  const roiOf = fl => { if (!fl.length) return { bets: 0, profit: 0, roi: 0 }; const ret = fl.reduce((s, f) => s + (f.hit ? dec(f.price) : 0), 0); return { bets: fl.length, profit: +(ret - fl.length).toFixed(2), roi: +(((ret - fl.length) / fl.length) * 100).toFixed(1) } }
  const roi = { all: roiOf(evFlags), win: roiOf(evFlags.filter(f => f.market === 'win')), exwin: roiOf(evFlags.filter(f => f.market !== 'win')), consensus: roiOf(evFlags.filter(f => f.mev > 0)) }
  const detail = rows.slice().sort((a, b) => a.act - b.act).map(r => ({ name: r.name, car: r.car, pf: r.pf, act: r.act, win: r.win, flags: evFlags.filter(f => f.driver === r.name).map(f => f.market) }))
  return { metrics: metrics, evFlags: evFlags, roi: roi, detail: detail }
}

const SERIES_TABS = [{ id: 'cup', label: 'Cup Series' }, { id: 'oreilly', label: "O'Reilly Series" }, { id: 'trucks', label: 'Truck Series' }]

export default function GradeCenter() {
  const [series, setSeries] = useState('cup')
  const [gradeTxt, setGradeTxt] = useState('')
  const [raceNum, setRaceNum] = useState('')
  const [prev, setPrev] = useState(null)
  const [msg, setMsg] = useState('')
  const [log, setLog] = useState([])
  const loadLog = () => supabase.from('sim_grades').select('*').order('race_year', { ascending: false }).order('race_number', { ascending: false, nullsFirst: false }).order('graded_at', { ascending: false }).limit(100).then(({ data }) => setLog(data || []))
  useEffect(() => { loadLog() }, [])
  const runGrade = async () => {
    setMsg('Grading...')
    const { data } = await supabase.from('sim_results').select('*').eq('series', series).order('published_at', { ascending: false }).limit(1)
    const row = (data || [])[0]
    if (!row || !row.results) { setPrev(null); setMsg('No published sim found for ' + series + '.'); return }
    if (row.race_number != null) setRaceNum(String(row.race_number))
    const parsed = __parseFinish(gradeTxt, row.results)
    if (Object.keys(parsed.actualMap).length < 3) { setPrev(null); setMsg('Could not read the finishing order - paste one driver per line, winner first.'); return }
    const g = __gradeRace(row.results, parsed.actualMap)
    setPrev({ metrics: g.metrics, evFlags: g.evFlags, roi: g.roi, detail: g.detail, parsed: parsed, simId: row.id, track: row.track_name, year: row.race_year })
    setMsg(parsed.matched.length + ' matched' + (parsed.unmatched.length ? ', ' + parsed.unmatched.length + ' skipped' : '') + '.')
  }
  const saveGrade = async () => {
    if (!prev) return
    setMsg('Saving...')
    const actualArr = Object.keys(prev.parsed.actualMap).map(car => ({ car_number: car, finish: prev.parsed.actualMap[car] }))
    const rn = raceNum ? parseInt(raceNum) : null
    const rowData = { sim_id: prev.simId, series: series, track_name: prev.track, race_year: prev.year, race_number: rn, actual: actualArr, metrics: prev.metrics, ev_flags: prev.evFlags, roi: prev.roi, shade_on: false }
    let existing = []
    if (rn != null) { const q = await supabase.from('sim_grades').select('id').eq('series', series).eq('race_year', prev.year).eq('race_number', rn); existing = q.data || [] }
    const resp = existing.length ? await supabase.from('sim_grades').update(rowData).eq('id', existing[0].id) : await supabase.from('sim_grades').insert(rowData)
    if (resp.error) { setMsg('Save error: ' + resp.error.message); return }
    setMsg(existing.length ? 'Updated R' + rn + '.' : 'Saved.'); setPrev(null); setGradeTxt(''); loadLog()
  }
  const pill = v => ({ color: v >= 0 ? '#2e9e52' : '#dd3355', fontWeight: 700 })
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Sim Grader</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Grade a published sim against the actual finish and log it.</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid rgba(128,128,128,0.25)' }}>
        {SERIES_TABS.map(t => (
          <button key={t.id} onClick={() => { setSeries(t.id); setRaceNum(''); setPrev(null) }} style={{ padding: '8px 14px', border: 'none', background: 'none', borderBottom: series === t.id ? '2px solid #e8b923' : '2px solid transparent', color: series === t.id ? '#e8b923' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>Grades the latest published {series.toUpperCase()} sim. Paste the finishing order, winner first (driver names or car numbers both work).</div>
        <textarea value={gradeTxt} onChange={e => setGradeTxt(e.target.value)} rows={8} placeholder={'1 Chase Briscoe\n2 Christopher Bell\n3 Denny Hamlin\n...'} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: 10, borderRadius: 6, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <input type="number" value={raceNum} onChange={e => setRaceNum(e.target.value)} placeholder="Race #" title="Season round number, e.g. 19" style={{ width: 90, padding: '9px 10px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }} />
          <button onClick={runGrade} style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Grade</button>
          {prev && <button onClick={saveGrade} style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: '#1f7a3d', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save to log</button>}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{msg}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>Race # = season round (Chicagoland Cup 2026 = 19). Re-grading the same race # updates its row instead of duplicating.</div>
      </div>
      {prev && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 10 }}>{prev.track} {prev.year}{raceNum ? ' R' + raceNum : ''} &mdash; preview</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 12, fontSize: '0.9rem' }}>
            <span>MAE <b>{prev.metrics.mae}</b></span>
            <span>Spearman <b>{prev.metrics.spearman_pf}</b></span>
            <span>Win Brier <b>{prev.metrics.win_brier}</b></span>
            <span>Top3 Brier <b>{prev.metrics.top3_brier}</b></span>
            <span>Top5 Brier <b>{prev.metrics.top5_brier}</b></span>
            <span>Top10 Brier <b>{prev.metrics.top10_brier}</b></span>
            <span>Prec 3/5/10 <b>{prev.metrics.prec.t3}/{prev.metrics.prec.t5}/{prev.metrics.prec.t10}</b></span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 16, fontSize: '0.9rem' }}>
            <span>+EV all ({prev.roi.all.bets}) <b style={pill(prev.roi.all.roi)}>{prev.roi.all.roi}%</b></span>
            <span>ex-win ({prev.roi.exwin.bets}) <b style={pill(prev.roi.exwin.roi)}>{prev.roi.exwin.roi}%</b></span>
            <span>win-only ({prev.roi.win.bets}) <b style={pill(prev.roi.win.roi)}>{prev.roi.win.roi}%</b></span>
            <span>consensus ({prev.roi.consensus.bets}) <b style={pill(prev.roi.consensus.roi)}>{prev.roi.consensus.roi}%</b></span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 380px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>Full field (proj vs actual)</div>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '3px 6px' }}>Fin</th><th>Driver</th><th>Proj</th><th>Delta</th><th>Win%</th></tr></thead>
                <tbody>
                  {prev.detail.map(d => (
                    <tr key={d.car} style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                      <td style={{ padding: '3px 6px' }}>{d.act}</td>
                      <td>{d.name}{d.flags.length ? ' *' : ''}</td>
                      <td>{d.pf}</td>
                      <td style={{ color: (d.pf - d.act) >= 0 ? '#2e9e52' : '#dd3355' }}>{(d.pf - d.act) > 0 ? '+' : ''}{(d.pf - d.act).toFixed(1)}</td>
                      <td>{d.win}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: '1 1 380px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>+EV flags ({prev.evFlags.length})</div>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '3px 6px' }}>Mkt</th><th>Driver</th><th>Price</th><th>EV</th><th>Res</th></tr></thead>
                <tbody>
                  {prev.evFlags.map((f, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                      <td style={{ padding: '3px 6px', textTransform: 'uppercase' }}>{f.market}</td>
                      <td>{f.driver.split(' ').slice(-1)[0]}</td>
                      <td>{f.price > 0 ? '+' : ''}{f.price} {f.book}</td>
                      <td>+{f.ev}{f.mev > 0 ? ' c+' + f.mev : ''}</td>
                      <td style={{ color: f.hit ? '#2e9e52' : '#dd3355', fontWeight: 600 }}>{f.hit ? 'HIT' : 'miss'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 10 }}>Season log ({log.length})</h3>
        {log.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No graded races yet.</div>}
        {log.length > 0 && (
          <table style={{ width: '100%', fontSize: '0.83rem', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '4px 8px' }}>R#</th><th>Race</th><th>MAE</th><th>Spear</th><th>WinBr</th><th>+EV</th><th>ex-win</th><th>win</th><th>cons</th></tr></thead>
            <tbody>
              {log.map(g => (
                <tr key={g.id} style={{ borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 600 }}>{g.race_number != null ? 'R' + g.race_number : '-'}</td>
                  <td>{(g.track_name || '').replace(' Speedway', '')} {g.race_year} <span style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{g.series}</span></td>
                  <td>{g.metrics && g.metrics.mae}</td>
                  <td>{g.metrics && g.metrics.spearman_pf}</td>
                  <td>{g.metrics && g.metrics.win_brier}</td>
                  <td style={pill(g.roi && g.roi.all ? g.roi.all.roi : 0)}>{g.roi && g.roi.all && g.roi.all.roi}%</td>
                  <td style={pill(g.roi && g.roi.exwin ? g.roi.exwin.roi : 0)}>{g.roi && g.roi.exwin && g.roi.exwin.roi}%</td>
                  <td style={pill(g.roi && g.roi.win ? g.roi.win.roi : 0)}>{g.roi && g.roi.win && g.roi.win.roi}%</td>
                  <td style={pill(g.roi && g.roi.consensus ? g.roi.consensus.roi : 0)}>{g.roi && g.roi.consensus && g.roi.consensus.roi}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
