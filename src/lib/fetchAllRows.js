// Paginated Supabase read. Use this for ANY query whose result set can grow past a few thousand
// rows (added 2026-09-02).
//
// WHY THIS EXISTS: PostgREST silently caps every response at 5,000 rows. Not an error, not a
// warning, no flag on the response — the query just returns 5,000 and the code downstream has no
// way to know more existed. Verified live on 2026-09-02: `loop_data` for cup returns 5,000 of
// 6,348, `qualifying_results` for cup returns 5,000 of 5,943.
//
// The failure mode is nastier than a plain cutoff. Rows come back in heap order (roughly insertion
// order) unless something forces otherwise, so the rows that get dropped are THE MOST RECENT ONES.
// A model reading a truncated history therefore loses this season first, while keeping the oldest
// season intact — and every page in this app weights recent races most heavily.
//
// The `orderColumn` MUST be unique. `.range()` issues one request per page and Postgres guarantees
// no row order without a total ORDER BY, so ordering by a non-unique column lets rows tied on it
// reshuffle between requests: the same row can arrive twice while another never arrives at all.
// That is a separate bug from the cap, and it bit PitCrewRankings on 2026-09-02 (stop counts off by
// up to 2x in both directions). One helper prevents both.
//
// `build` must be a FUNCTION returning a fresh query builder — supabase builders are single-use
// thenables, so the same object cannot be re-ranged for a second page.
//
//   const { data, error } = await fetchAllRows(() =>
//     supabase.from('loop_data').select('...').eq('series', s))
//
export async function fetchAllRows(build, opts) {
  const o = opts || {}
  const orderColumn = o.orderColumn || 'id'
  const pageSize = o.pageSize || 1000
  const maxPages = o.maxPages || 60           // 60k rows; a runaway loop stops rather than hangs
  let out = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize
    const { data, error } = await build()
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error: error }
    const batch = data || []
    out = out.concat(batch)
    if (batch.length < pageSize) return { data: out, error: null }
  }
  // Hitting this means the result set is larger than maxPages*pageSize. Returning what we have
  // WITH an error is deliberate: a caller that ignores `error` still degrades to the old truncating
  // behaviour rather than crashing, and one that checks it finds out instead of guessing.
  return { data: out, error: new Error('fetchAllRows: exceeded ' + maxPages * pageSize + ' rows; raise maxPages or filter harder') }
}

export default fetchAllRows
