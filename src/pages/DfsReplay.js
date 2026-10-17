import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { optimize, bestLineup, makeEmaxSelector, topUpLineups, enforceMinExposure, dfsCapFor, projectOwnership, DFS_ROSTER, DFS_CAP } from './DFSPage'
import { buildPortfolio, portfolioRulesDefault, classifyPortfolioPool, OPERATOR_PRESET, PORTFOLIO_RULES } from '../lib/dfsPortfolio'
import { runReplay, saveReplay, one, two, money, SERIES, card, lbl } from '../lib/dfsReplayRun'

function LineupCard({ title, lu, tone }) {
  if (!lu) return null
  return (
    <div style={{ flex: '1 1 340px', minWidth: 320, border: '1px solid var(--border, #22252b)', borderRadius: 9, padding: 12, background: 'var(--bg, #0e0f13)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <strong style={{ color: tone || 'var(--text-primary, #e8eaed)', fontSize: 14 }}>{title}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary, #9aa0aa)' }}>
          proj {one(lu.proj)}{lu.ceil != null ? ' · p90 ' + one(lu.ceil) : ''} · {money(lu.salary)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 22, color: 'var(--accent, #e11d2a)' }}>{two(lu.actual)}</strong>
        <span style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13 }}>
          {lu.rank ? '~' + lu.rank.toLocaleString() + (lu.entries ? ' / ' + lu.entries.toLocaleString() : '') : ''}
          {lu.pct != null ? '  (' + (100 - lu.pct).toFixed(1) + '% from top)' : ''}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <tbody>
          {lu.drivers.slice().sort((a, b) => (b.actual || 0) - (a.actual || 0)).map((d, i) => (
            <tr key={d.name} style={{ borderTop: i ? '1px solid var(--border, #1c1f25)' : 'none' }}>
              <td style={{ padding: '3px 4px', color: 'var(--text-primary, #e8eaed)' }}>{d.name}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>{money(d.sal)}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>{one(d.projDK)}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>{d.own != null ? one(d.own) + '%' : '—'}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                {d.start != null ? 'P' + d.start : '—'}{'→'}{d.fin != null ? 'P' + d.fin : '—'}
              </td>
              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>{two(d.actual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ ...lbl, marginTop: 6 }}>name · salary · proj · own · start→fin · actual</div>
    </div>
  )
}

export default function DfsReplay() {
  const [races, setRaces] = useState([])
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState('')
  const [msg, setMsg] = useState('')
  const [res, setRes] = useState(null)
  const [ledger, setLedger] = useState([])
  const [saved, setSaved] = useState(false)
  // GPP is a SET objective as of 2026-08-30, so the replay has to grade a SET. Grading one lineup
  // against a product that delivers 20-150 was measuring the wrong thing.
  const [entries, setEntries] = useState(20)

  // 2026-09-18: the 09-14 columns (operator_*, dfs_contests.scores_top) exist only after
  // sql/dfs_operator_entries.sql has been run. Until then every read that names them 400s, which
  // emptied the ledger, dropped the contest ladder from the replay and made Save fail. Each read now
  // retries in the legacy shape when Postgres says the column is missing (42703).
  const __missingCol = (error) => !!error && (error.code === '42703' || /does not exist|schema cache/i.test(error.message || ''))
  const LEDGER_COLS = 'series,race_year,race_number,track_name,cash_actual,cash_rank,gpp_actual,gpp_rank,perfect_actual,contest_entries,contest_median,rho_model,rho_salary,rho_own,verdict,engine_era,created_at,portfolio_prize,portfolio_base_prize,portfolio_legs'
  const loadLedger = async () => {
    const q = (cols) => supabase.from('dfs_replays').select(cols)
      .order('race_year', { ascending: false }).order('race_number', { ascending: false, nullsFirst: false }).limit(50)
    let { data, error } = await q(LEDGER_COLS + ',operator_prize,operator_entries,operator_json')
    if (__missingCol(error)) ({ data } = await q(LEDGER_COLS))
    setLedger(data || [])
  }

  useEffect(() => {
    supabase.from('dfs_sim_samples').select('series,race_year,race_number,track_name,created_at').eq('stage', 'post')   // 2026-09-05: post-board draws only
      .order('race_year', { ascending: false }).order('race_number', { ascending: false, nullsFirst: false })
      .limit(60)
      .then(({ data }) => {
        const rs = data || []
        setRaces(rs)
        if (rs.length) setPick(rs[0].series + '|' + rs[0].race_year + '|' + (rs[0].race_number == null ? '' : rs[0].race_number))
      })
    loadLedger()
  }, [])

  const run = async () => {
    setBusy(true); setRes(null); setSaved(false); setMsg(''); setProg('Loading…')
    try {
      const [sr, yr, rn] = pick.split('|')
      const r = await runReplay({ series: sr, year: +yr, race: rn === '' ? null : +rn, entries, onProgress: setProg })
      setRes(r); setProg(''); setMsg(r.summary)
    } catch (e) {
      setMsg('Replay failed: ' + (e.message || e))
      setProg('')
    }
    setBusy(false)
  }

  const save = async () => {
    if (!res) return
    try { const { legacy } = await saveReplay(res); setSaved(true); setMsg('Saved to the replay ledger.' + (legacy ? ' (Operator columns not saved - run sql/dfs_operator_entries.sql, then re-save.)' : '')); loadLedger(); loadCoverage() }
    catch (e) { setMsg(e.message) }
  }


  const tally = ledger.reduce((a, r) => { if (r.verdict) a[r.verdict] = (a[r.verdict] || 0) + 1; return a }, {})

  // POST-RACE COVERAGE (2026-10-17, operator: "there's no log so I can see what replays are missing that I
  // need to upload a contest file for"). One line per published post board this season: salary file,
  // loop data, contests uploaded (every DK contest id), replay saved - and what is still owed.
  const [cov, setCov] = useState(null)
  const loadCoverage = async () => {
    const yr = new Date().getFullYear()
    const key = r => r.series + '|' + r.race_year + '|' + (r.race_number == null ? '' : r.race_number)
    const [b, sal, ld, con, rep] = await Promise.all([
      supabase.from('dfs_sim_samples').select('series,race_year,race_number,track_name,created_at').eq('stage', 'post').eq('race_year', yr),
      supabase.from('dfs_salaries').select('series,race_year,race_number'),
      supabase.from('loop_data').select('series,race_number').eq('year', yr),
      supabase.from('dfs_contests').select('series,race_year,race_number,contest_id,contest_type,entries,contest_name').eq('race_year', yr),
      supabase.from('dfs_replays').select('series,race_year,race_number,contest_entries,gpp_rank,created_at').eq('race_year', yr),
    ])
    const salS = new Set((sal.data || []).map(key))
    const ldS = new Set((ld.data || []).map(r => r.series + '|' + yr + '|' + r.race_number))
    const conBy = {}; (con.data || []).forEach(c => { (conBy[key(c)] = conBy[key(c)] || []).push(c) })
    const repBy = {}; (rep.data || []).forEach(r => { repBy[key(r)] = r })
    const seen = new Set()
    const rows = (b.data || []).filter(r => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b2) => (b2.race_number || 0) - (a.race_number || 0) || a.series.localeCompare(b2.series))
      .map(r => {
        const k = key(r), cons = (conBy[k] || []).sort((a, b2) => (b2.entries || 0) - (a.entries || 0)), rp = repBy[k]
        const miss = []
        if (!salS.has(k)) miss.push('salary file')
        if (!ldS.has(k)) miss.push('loop data')
        if (!cons.length) miss.push('contest upload')
        else if (!rp) miss.push('replay')
        else if (rp.contest_entries == null) miss.push('replay ran without a contest - re-run')
        return { ...r, k, sal: salS.has(k), loop: ldS.has(k), cons, rep: rp, miss }
      })
    setCov(rows)
  }
  useEffect(() => { loadCoverage() }, [])

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, color: 'var(--text-primary, #e8eaed)' }}>DFS Replay</h2>
      <p style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13, marginTop: 0 }}>
        Rebuilds both DFS Center modes from the pre-lock sim draws, scores them against the real
        finish and places them in the contest you uploaded. Needs: a published board with samples,
        the DK salary file, loop data loaded, and the contest + ownership upload.
      </p>

      <h3 style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 15, margin: '4px 0 6px' }}>
        Post-race coverage {cov ? <span style={{ ...lbl, fontWeight: 400 }}>— {cov.filter(r => r.miss.length).length} of {cov.length} boards still owed something</span> : null}
      </h3>
      {cov && (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['Race', 'Salaries', 'Loop data', 'Contests uploaded', 'Replay', 'Still needed'].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? 'left' : 'center', padding: '6px 8px', color: 'var(--text-secondary, #9aa0aa)', fontWeight: 500, borderBottom: '1px solid var(--border, #22252b)' }}>{h}</th>)}</tr></thead>
            <tbody>{cov.map(r => {
              const s = SERIES.find(x => x.v === r.series)
              const ok = v => <span style={{ color: v ? '#3fb950' : '#f85149' }}>{v ? '\u2713' : '\u2717'}</span>
              return <tr key={r.k} style={{ borderBottom: '1px solid var(--border, #22252b)', background: r.miss.length ? 'rgba(248,81,73,0.06)' : 'transparent' }}>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{(s ? s.label : r.series) + ' R' + r.race_number + ' \u00b7 ' + (r.track_name || '?')}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ok(r.sal)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ok(r.loop)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary, #9aa0aa)' }}>{r.cons.length ? r.cons.map(c => <div key={c.contest_id} title={c.contest_name || c.contest_id}>{(c.contest_type || '').toUpperCase()} {c.contest_id}{' · '}{(c.entries || 0).toLocaleString()} entries</div>) : ok(false)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary, #9aa0aa)' }}>{r.rep ? (r.rep.contest_entries != null ? <span>{ok(true)} #{r.rep.gpp_rank} of {(+r.rep.contest_entries).toLocaleString()}</span> : <span style={{ color: '#e8b923' }}>no contest</span>) : ok(false)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: r.miss.length ? '#f85149' : '#3fb950', whiteSpace: 'nowrap' }}>{r.miss.length ? r.miss.join(', ') : 'complete'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={pick} onChange={e => { setPick(e.target.value); setRes(null); setMsg('') }}
          style={{ padding: '7px 9px', borderRadius: 6, background: 'var(--bg, #0e0f13)', color: 'var(--text-primary, #e8eaed)', border: '1px solid var(--border, #22252b)', minWidth: 340 }}>
          {races.map(r => {
            const v = r.series + '|' + r.race_year + '|' + (r.race_number == null ? '' : r.race_number)
            const s = SERIES.find(x => x.v === r.series)
            return <option key={v + r.created_at} value={v}>{(s ? s.label : r.series) + ' ' + r.race_year + (r.race_number != null ? ' R' + r.race_number : '') + ' — ' + (r.track_name || '?')}</option>
          })}
        </select>
        <label style={{ fontSize: 13, color: 'var(--text-secondary, #9aa0aa)' }}>
          Entries{' '}
          <input type="number" min={1} max={150} value={entries}
            onChange={e => setEntries(Math.max(1, Math.min(150, +e.target.value || 1)))}
            style={{ width: 64, padding: '6px 7px', borderRadius: 6, background: 'var(--bg, #0e0f13)', color: 'var(--text-primary, #e8eaed)', border: '1px solid var(--border, #22252b)' }} />
        </label>
        <button onClick={run} disabled={busy || !pick}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', fontWeight: 700, cursor: busy ? 'default' : 'pointer', background: busy ? '#444' : 'var(--accent, #e11d2a)', color: '#fff' }}>
          {busy ? 'Running…' : 'Run replay'}
        </button>
        {res && !saved && <button onClick={save} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border, #22252b)', background: 'transparent', color: 'var(--text-primary, #e8eaed)', cursor: 'pointer' }}>Save to ledger</button>}
      </div>
      {prog && <div style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 12.5, marginBottom: 8 }}>{prog}</div>}
      {msg && <div style={{ color: saved ? '#4ade80' : 'var(--text-secondary, #9aa0aa)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}

      {res && (
        <div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 12 }}>
            <span><span style={lbl}>leak check </span>samples {new Date(res.samplesAt).toLocaleString()}{res.boardAt ? ' · board ' + res.stage + ' ' + new Date(res.boardAt).toLocaleString() : ''}</span>
            <span><span style={lbl}>pool </span>{res.nPool} priced &amp; finished</span>
            <span><span style={lbl}>draws </span>{res.nDraws.toLocaleString()}</span>
            <span><span style={lbl}>candidates </span>{res.nCands.toLocaleString()} @ {res.nScoreDraws.toLocaleString()} draws</span>
            <span><span style={lbl}>gpp set </span>{res.setN} lineups · {res.setUniq} unique drivers · E[max] {one(res.setEmax)}</span>
          </div>
          {!!res.unmatched.length && (
            <div style={{ background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, color: '#f5a623', marginBottom: 12 }}>
              {res.unmatched.length} priced driver{res.unmatched.length === 1 ? '' : 's'} had no matching finish and {res.unmatched.length === 1 ? 'was' : 'were'} left out of the pool: {res.unmatched.join(', ')}.
              {' '}Expected for a withdrawal or a late substitute DK never priced — otherwise it is a name-join miss worth fixing.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <LineupCard title="Cash (mean-optimal)" lu={res.cash} />
            <LineupCard title={'GPP best of ' + res.setN + (res.same ? ' — the cash lineup' : '')} lu={res.gpp} tone={res.same ? undefined : 'var(--series-oreilly, #f5a623)'} />
            <LineupCard title="Perfect (hindsight)" lu={res.perfect} tone="#4ade80" />
          </div>

          {!!res.alt.length && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 12 }}>
              {res.alt.map((a, i) => <div key={i}>GPP #{i + 2}: p90 {one(a.ceil)} → actual {two(a.actual)} ({a.names.join(', ')})</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13, marginBottom: 10 }}>
            <div><div style={lbl}>verdict</div><strong style={{ color: res.verdict === 'gpp' ? '#4ade80' : res.verdict === 'cash' ? '#f5a623' : 'var(--text-primary, #e8eaed)' }}>
              {res.verdict === 'tie' ? 'TIE' : res.verdict.toUpperCase() + ' wins by ' + two(Math.abs(res.gpp.actual - res.cash.actual))}
            </strong></div>
            {res.contest && <div><div style={lbl}>contest</div>{res.contest.entries ? res.contest.entries.toLocaleString() + ' entries · ' : ''}median {two(res.contest.median_score)} · winner {two(res.contest.winner_score)}</div>}
            <div><div style={lbl}>ρ model</div>{res.cal.model == null ? '—' : res.cal.model.toFixed(3)}</div>
            <div><div style={lbl}>ρ DK salary</div>{res.cal.salary == null ? '—' : res.cal.salary.toFixed(3)}</div>
            <div><div style={lbl}>ρ ownership</div>{res.cal.own == null ? '— (no upload)' : res.cal.own.toFixed(3) + ' (n=' + res.cal.nOwn + ')'}</div>
          </div>
          {res.portfolio && !res.portfolio.error && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 12, padding: '8px 10px', border: '1px solid var(--border, #1c1f25)', borderRadius: 8 }}>
              <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>Portfolio</strong> {res.portfolio.legs} legs x {res.portfolio.n}, rules {res.portfolio.rulesOn ? 'ON' : 'OFF (trucks default)'}: realised prize <strong style={{ color: res.portfolio.prize > res.portfolio.basePrize ? '#4ade80' : res.portfolio.prize < res.portfolio.basePrize ? '#f5a623' : 'inherit' }}>{res.portfolio.prize.toFixed(1)}</strong> vs {res.portfolio.basePrize.toFixed(1)} for {res.portfolio.legs} x the E[max] set (entry-fee units, DK-like curve) · best entry pctile {res.portfolio.bestPct.toFixed(1)}{res.portfolio.legSizes ? ' · legs ' + res.portfolio.legSizes : ''}{res.portfolio.filled ? ' · ' + res.portfolio.filled + ' slot' + (res.portfolio.filled > 1 ? 's' : '') + ' filled past the rules, worth ' + res.portfolio.fillPrize.toFixed(1) : ''}
              <div>Chalk: {res.portfolio.chalk.join(', ') || 'none'} · tier-two: {res.portfolio.t2.join(', ') || 'none'} · exposure: {res.portfolio.exposure.map(e => e.name.split(' ').pop() + ' ' + e.pct + '%').join(', ')}</div>
            </div>
          )}
          {res.portfolio && res.portfolio.error && <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 10 }}>Portfolio row failed: {res.portfolio.error}</div>}
          {res.operator && !res.operator.error && (() => { const o = res.operator; return (
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 10, padding: '6px 10px', border: '1px solid #e8b923', borderRadius: 6 }}>
              <strong style={{ color: '#e8b923' }}>Operator</strong> {o.entries} entries in {o.contests} contest{o.contests === 1 ? '' : 's'} · best {o.bestRank} of {o.bestOf} ({o.bestPoints}) · mean p{o.meanPct} · {o.aboveMedian}/{o.entries} above median · prize <b>{o.prize}</b>
              {' · '}per entry: operator <b>{o.perEntry}</b>{o.pfPer != null ? ' vs portfolio ' + o.pfPer : ''}{o.basePer != null ? ' vs E[max] ' + o.basePer : ''}
              {o.atN && !o.atN.error && <div style={{ color: 'var(--text-primary, #e8eaed)' }}>AT THE OPERATOR'S N ({o.atN.wants.join(' / ')}): operator <b>{o.atN.opPer}</b> per entry ({o.atN.opPrize} on {o.atN.opEntries}) vs Portfolio <b>{o.atN.pfPer}</b> ({o.atN.pfPrize} on {o.atN.pfEntries}, legs {o.atN.pfLegs}) vs E[max] set <b>{o.atN.emaxPer}</b> ({o.atN.emaxPrize} on {o.atN.emaxEntries}) - same ladder, same sizes; this is the like-for-like number.</div>}
              {o.atN && o.atN.error && <div style={{ color: '#f5a623' }}>at-N build failed: {o.atN.error}</div>}
              <div>Exposure: {o.exposure.map(e => e.name + ' ' + e.pct).join(', ')}</div>
              {o.byContest.length > 1 && <div>{o.byContest.map(c => '#' + c.id + ' ' + c.type + ' ' + c.entries + '/' + c.of + ' best ' + c.best + ' p' + c.meanPct + ' prize ' + c.prize).join(' · ')}</div>}
            </div>) })()}
          {res.operator && res.operator.error && <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 10 }}>Operator row failed: {res.operator.error}</div>}
          {!res.operator && <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7078)', marginBottom: 10 }}>No operator entries stored for this race (upload the contest-standings file on DFS Salary Admin - entries under atmmstrs2 are captured automatically).</div>}
          {res.portfolio && res.portfolio.operator && !res.portfolio.operator.error && (() => { const o = res.portfolio.operator; return (
            <div id="operator-arm" style={{ fontSize: 12, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 10, padding: '6px 10px', border: '1px dashed var(--border, #2a2d34)', borderRadius: 6 }}>
              <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>Operator preset arm</strong> (report only, not saved) · REF rules-on prize <b>{o.ref.prize.toFixed(2)}</b> ({o.ref.legs.join('/')}, best p{Math.round(o.ref.bestPct)}, punt slots {o.ref.punt.slots} avg {o.ref.punt.mean != null ? o.ref.punt.mean.toFixed(1) : '-'} pts)
              {' · '}PRESET prize <b>{o.preset.prize.toFixed(2)}</b> ({o.preset.legs.join('/')}, best p{Math.round(o.preset.bestPct)}, punt slots {o.preset.punt.slots} avg {o.preset.punt.mean != null ? o.preset.punt.mean.toFixed(1) : '-'} pts)
              {' · '}NULL mean <b>{o.nullMean.toFixed(2)}</b> [{o.nullPrizes.join(', ')}] · eligible punts {o.eligiblePunts.length} of {o.midPunts.length} mid ({o.eligiblePunts.join(', ') || 'none'}); floor {o.floor.join(', ') || 'none'}
              {o.preset.why.length ? ' · preset short: ' + o.preset.why.join(' | ') : ''}
            </div>) })()}
          {res.portfolio && res.portfolio.operator && res.portfolio.operator.error && <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 10 }}>Operator arm failed: {res.portfolio.operator.error}</div>}
          {res.saturation && !res.saturation.error && (() => { const b = res.saturation.byN; return (
            <div id="saturation-arm" style={{ fontSize: 12, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 10, padding: '6px 10px', border: '1px dashed var(--border, #22252b)', borderRadius: 6 }}>
              <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>Saturation arm</strong> (report only, not saved) ·
              {[70, 100].map(N => { const r = b[N]; return r ? <span key={N}> N={N}: A {r.aDelivered} lineups prize <b>{r.aPrize}</b> (dup-filled {r.aDupPrize}) · B {r.bDelivered} lineups prize <b>{r.bPrize}</b> (finished at level {r.bLevel}, picks by level {r.bLevelPicks.join('/')}) ·</span> : null })}
            </div>) })()}
          {res.saturation && res.saturation.error && <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 10 }}>Saturation arm failed: {res.saturation.error}</div>}
          {res.ownership && !res.ownership.error && (() => { const b = res.ownership.byN; return (
            <div id="ownership-arm" style={{ fontSize: 12, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 10, padding: '6px 10px', border: '1px dashed var(--border, #22252b)', borderRadius: 6 }}>
              <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>Ownership arm</strong> (report only, not saved) ·
              {[20, 70].map(N => { const r = b[N]; return r ? <span key={N}> N={N}: A prize <b>{r.aPrize}</b> best {r.aBest} own {r.aOwn}% [{r.aExpo}] · B prize <b>{r.bPrize}</b> best {r.bBest} own {r.bOwn}% [{r.bExpo}] ({r.bDelivered} lineups) ·</span> : null })}
            </div>) })()}
          {res.ownership && res.ownership.error && <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 10 }}>Ownership arm failed: {res.ownership.error}</div>}
          <div style={{ ...lbl, marginBottom: 14 }}>ρ = Spearman of each ranking against actual DK points. Ownership above the model means the crowd out-ranked us.</div>
        </div>
      )}

      <h3 style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 15, marginBottom: 6 }}>
        Replay ledger {ledger.length ? <span style={{ ...lbl, fontWeight: 400 }}>— GPP {tally.gpp || 0} · cash {tally.cash || 0} · tie {tally.tie || 0}</span> : null}
      </h3>
      {!!ledger.length && (
        <div style={{ ...lbl, marginBottom: 6, textTransform: 'none', letterSpacing: 0 }}>
          Rows marked <strong>old</strong> were built from draws stored before the 2026-08-29 calibration
          (SS dominator tilt, SHORT/INT wreck survival) — they are a record, not evidence about the
          engine running today. Only <strong>current</strong> rows test what ships now.
        </div>
      )}
      {!ledger.length && <div style={{ color: 'var(--text-muted, #6b7078)', fontSize: 13 }}>No saved replays yet.</div>}
      {!!ledger.length && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted, #6b7078)', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '5px 6px' }}>Race</th>
                <th style={{ padding: '5px 6px' }}>Cash</th><th style={{ padding: '5px 6px' }}>GPP</th>
                <th style={{ padding: '5px 6px' }}>Median</th><th style={{ padding: '5px 6px' }}>Perfect</th>
                <th style={{ padding: '5px 6px' }}>ρ model</th><th style={{ padding: '5px 6px' }}>ρ sal</th><th style={{ padding: '5px 6px' }}>ρ own</th>
                <th style={{ padding: '5px 6px' }} title="Portfolio realised prize vs legs x E[max] set (entry-fee units, DK-like curve)">Portfolio</th>
                <th style={{ padding: '5px 6px' }} title="The operator's real entries: prize per entry (entry-fee units, same curve) vs the Portfolio row per entry; entries in brackets">Operator</th>
                <th style={{ padding: '5px 6px' }}>Engine</th>
                <th style={{ padding: '5px 6px' }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border, #1c1f25)', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                  <td style={{ textAlign: 'left', padding: '5px 6px', color: 'var(--text-primary, #e8eaed)' }}>
                    {r.series} {r.race_year}{r.race_number != null ? ' R' + r.race_number : ''} · {r.track_name}
                  </td>
                  <td style={{ padding: '5px 6px' }}>{two(r.cash_actual)}{r.cash_rank ? <span style={{ color: 'var(--text-muted, #6b7078)' }}> ({r.cash_rank.toLocaleString()})</span> : null}</td>
                  <td style={{ padding: '5px 6px' }}>{two(r.gpp_actual)}{r.gpp_rank ? <span style={{ color: 'var(--text-muted, #6b7078)' }}> ({r.gpp_rank.toLocaleString()})</span> : null}</td>
                  <td style={{ padding: '5px 6px' }}>{two(r.contest_median)}</td>
                  <td style={{ padding: '5px 6px' }}>{two(r.perfect_actual)}</td>
                  <td style={{ padding: '5px 6px' }}>{r.rho_model == null ? '—' : (+r.rho_model).toFixed(3)}</td>
                  <td style={{ padding: '5px 6px' }}>{r.rho_salary == null ? '—' : (+r.rho_salary).toFixed(3)}</td>
                  <td style={{ padding: '5px 6px' }}>{r.rho_own == null ? '—' : (+r.rho_own).toFixed(3)}</td>
                  <td style={{ padding: '5px 6px', color: r.portfolio_prize == null ? 'var(--text-muted, #6b7078)' : +r.portfolio_prize > +r.portfolio_base_prize ? '#4ade80' : +r.portfolio_prize < +r.portfolio_base_prize ? '#f5a623' : 'inherit' }}>{r.portfolio_prize == null ? '—' : (+r.portfolio_prize).toFixed(1) + ' / ' + (+r.portfolio_base_prize).toFixed(1)}</td>
                  <td style={{ padding: '5px 6px', color: r.operator_prize == null ? 'var(--text-muted, #6b7078)' : (() => { const j = r.operator_json; const a = j && j.atN && j.atN.opPer != null ? j.atN : j; if (!a) return 'inherit'; const op = a === j ? j.perEntry : a.opPer, pf = a.pfPer; return pf == null || op == null ? 'inherit' : op > pf ? '#4ade80' : op < pf ? '#f5a623' : 'inherit' })() }}>{r.operator_prize == null ? '—' : (r.operator_json && r.operator_json.atN && r.operator_json.atN.opPer != null ? r.operator_json.atN.opPer.toFixed(2) + ' v ' + (r.operator_json.atN.pfPer != null ? r.operator_json.atN.pfPer.toFixed(2) : '-') : (r.operator_json && r.operator_json.perEntry != null ? r.operator_json.perEntry.toFixed(2) : two(r.operator_prize)) + (r.operator_json && r.operator_json.pfPer != null ? ' v ' + r.operator_json.pfPer.toFixed(2) : '')) + ' [' + r.operator_entries + ']'}</td>
                  <td style={{ padding: '5px 6px', color: r.engine_era === 'post-0829' ? 'var(--text-primary, #e8eaed)' : 'var(--text-muted, #6b7078)' }}>{r.engine_era === 'post-0829' ? 'current' : r.engine_era ? 'old' : '—'}</td>
                  <td style={{ padding: '5px 6px', fontWeight: 700, color: r.verdict === 'gpp' ? '#4ade80' : r.verdict === 'cash' ? '#f5a623' : 'var(--text-secondary, #9aa0aa)' }}>{(r.verdict || '').toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
