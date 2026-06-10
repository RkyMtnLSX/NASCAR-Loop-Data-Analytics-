import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parsePracticeExcel } from '../lib/excelParser'
import { gradePracticeSession } from '../lib/practiceGrader'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD

const SERIES_OPTIONS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'xfinity', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export default function Admin() {
  const [authed, setAuthed]         = useState(false)
  const [password, setPassword]     = useState('')
  const [authError, setAuthError]   = useState('')

  // Upload state
  const [series, setSeries]         = useState('cup')
  const [trackName, setTrackName]   = useState('')
  const [year, setYear]             = useState(new Date().getFullYear())
  const [sessionNum, setSessionNum] = useState(1)
  const [file, setFile]             = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [preview, setPreview]       = useState(null)

  function handleLogin(e) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('Incorrect password')
    }
  }

  async function handleFileSelect(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setUploadStatus(null)

    try {
      const parsed = await parsePracticeExcel(f, series)
      const graded = gradePracticeSession(parsed.drivers)
      setPreview({ parsed, graded })
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
      setPreview(null)
    }
  }

  async function handleUpload() {
    if (!file || !trackName || !preview) return
    setUploading(true)
    setUploadStatus(null)

    try {
      // Get or create race record
      let raceId = null
      const { data: existingRace } = await supabase
        .from('races')
        .select('id')
        .eq('track_name', trackName)
        .eq('year', year)
        .eq('series', series)
        .single()

      if (existingRace) {
        raceId = existingRace.id
      } else {
        const { data: newRace, error: raceError } = await supabase
          .from('races')
          .insert({
            race_name: `${trackName} ${year}`,
            series,
            year,
            track_name: trackName,
          })
          .select('id')
          .single()

        if (raceError) throw raceError
        raceId = newRace.id
      }

      // Delete existing practice session data for this race/series/session
      await supabase
        .from('practice_sessions')
        .delete()
        .eq('race_id', raceId)
        .eq('series', series)
        .eq('session_number', sessionNum)

      // Insert graded rows
      const rows = preview.graded.map(d => ({
        race_id: raceId,
        driver_name: d.driver,
        series,
        year,
        track_name: trackName,
        session_number: sessionNum,
        qualifying_position: d.start,
        total_laps: d.totalLaps,
        best_lap: d.bestLap,
        overall_avg: d.overallAvg,
        late_run_avg: d.lateRunAvg,
        trend_slope: d.trendSlope,
        num_stints: d.stints,
        longest_stint: d.longestStint,
        practice_score: d.composite,
        practice_grade: d.grade,
        notes: d.notes || null,
      }))

      const { error: insertError } = await supabase
        .from('practice_sessions')
        .insert(rows)

      if (insertError) throw insertError

      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded ${rows.length} drivers for ${trackName} ${year} — ${series} Session ${sessionNum}`,
      })
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
    } finally {
      setUploading(false)
    }
  }

  // Login screen
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}>
        <div className="card" style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>
            Admin Access
          </h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
            {authError && (
              <p style={{ color: '#E74C3C', fontSize: '0.75rem', marginBottom: 12 }}>
                {authError}
              </p>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Upload and manage practice session data</p>
      </div>

      {/* Upload form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 20 }}>
          Upload Practice Session
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {/* Series */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Series
            </label>
            <select
              value={series}
              onChange={e => setSeries(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
              }}
            >
              {SERIES_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Track */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Track Name
            </label>
            <input
              type="text"
              placeholder="e.g. Pocono Raceway"
              value={trackName}
              onChange={e => setTrackName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Year */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Session number */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Session #
            </label>
            <select
              value={sessionNum}
              onChange={e => setSessionNum(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
              }}
            >
              <option value={1}>Session 1</option>
              <option value={2}>Session 2</option>
            </select>
          </div>
        </div>

        {/* File upload */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            Practice Excel File (cleaned, outliers removed)
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Status message */}
        {uploadStatus && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            fontSize: '0.8125rem',
            background: uploadStatus.type === 'success' ? '#145A3220' : '#922B2120',
            border: `1px solid ${uploadStatus.type === 'success' ? '#145A3240' : '#922B2140'}`,
            color: uploadStatus.type === 'success' ? '#27AE60' : '#E74C3C',
          }}>
            {uploadStatus.message}
          </div>
        )}

        {/* Preview and upload button */}
        {preview && (
          <div>
            <div style={{
              padding: '10px 14px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
            }}>
              Parsed {preview.parsed.totalDrivers} drivers from sheet "{preview.parsed.sheetName}" —
              ready to grade and upload
            </div>

            {/* Preview table - top 5 */}
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="left">Driver</th>
                    <th>Laps</th>
                    <th>Avg Lap</th>
                    <th>Late Run</th>
                    <th>Best Lap</th>
                    <th>Score</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.graded.slice(0, 10).map((d, i) => {
                    const gc = d.grade ? { bg: '#1A5276', text: '#fff' } : { bg: '#333', text: '#fff' }
                    return (
                      <tr key={d.driver}>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {i + 1}
                        </td>
                        <td className="left" style={{ fontWeight: i < 3 ? 600 : 400 }}>{d.driver}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.totalLaps}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.overallAvg?.toFixed(3) || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.lateRunAvg?.toFixed(3) || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{d.bestLap?.toFixed(3) || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.composite?.toFixed(1) || '—'}</td>
                        <td>
                          <span className="grade-pill" style={{ background: gc.bg, color: gc.text }}>
                            {d.grade || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading || !trackName}
              style={{ minWidth: 160 }}
            >
              {uploading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Uploading...
                </>
              ) : (
                `Upload ${preview.graded.length} drivers`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
