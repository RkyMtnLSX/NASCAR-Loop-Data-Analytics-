import React from 'react'

// Racing-stripe corner accents (2026-07-11): static top-left + bottom-right, matching the
// RkyMtnBets graphic - segmented yellow dashes, then SOLID red / magenta / blue bars.
const SEGS = [
  { c: '#f5c518', w: 16 }, { c: '#f5c518', w: 16 }, { c: '#f5c518', w: 16 },
  { c: '#e10600', w: 56 },
  { c: '#c2179b', w: 36 },
  { c: '#1d6fd1', w: 36 },
]

function Row({ corner }) {
  const pos = corner === 'tl' ? { top: 0, left: 0 } : { bottom: 0, right: 0 }
  return (
    <div style={{
      position: 'fixed', zIndex: 3000, pointerEvents: 'none',
      display: 'flex', gap: 6, padding: '0 12px',
      transform: corner === 'br' ? 'scale(-1, -1)' : 'none',
      ...pos,
    }}>
      {SEGS.map((s, i) => (
        <span key={i} style={{ width: s.w, height: 7, background: s.c, transform: 'skewX(-32deg)' }} />
      ))}
    </div>
  )
}

export default function RacingStripes() {
  return (<><Row corner="br" /></>)
}
