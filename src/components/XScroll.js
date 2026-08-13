// XScroll (2026-08-12): horizontal scroll container that shows a synced
// scrollbar ABOVE the content as well as the native one below, so users can
// tell a wide table scrolls without scrolling to its bottom first.
// Top bar renders only when content actually overflows.
import React, { useRef, useEffect, useState } from 'react'

export default function XScroll({ children, style }) {
  const topRef = useRef(null)
  const bodyRef = useRef(null)
  const [w, setW] = useState(0)
  const [need, setNeed] = useState(false)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const upd = () => {
      setW(el.scrollWidth)
      setNeed(el.scrollWidth > el.clientWidth + 2)
    }
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    window.addEventListener('resize', upd)
    return () => { ro.disconnect(); window.removeEventListener('resize', upd) }
  })

  const sync = (a, b) => () => {
    if (a.current && b.current && b.current.scrollLeft !== a.current.scrollLeft) {
      b.current.scrollLeft = a.current.scrollLeft
    }
  }

  return (
    <div>
      {need && (
        <div
          ref={topRef}
          onScroll={sync(topRef, bodyRef)}
          style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 2 }}
        >
          <div style={{ width: w, height: 1 }} />
        </div>
      )}
      <div ref={bodyRef} onScroll={sync(bodyRef, topRef)} style={{ overflowX: 'auto', ...style }}>
        {children}
      </div>
    </div>
  )
}
