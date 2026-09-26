import { buildFastestLapRows } from './NascarFeedAdmin'
import { makeResolver } from '../lib/nascarFeedMap'

const laps = (times, poss) => times.map((t, i) => ({ lap: i + 1, time: t, speed: t ? +(3600 * 0.533 / t).toFixed(3) : null, pos: poss ? poss[i] : 3 }))

test('archive rows: junk laps dropped, fastest is the real lap, P50 over flying laps, names resolve', () => {
  const payload = {
    drivers: [
      { number: '5', name: 'Kyle Larson (C)', driver_id: 4050, laps: laps([15.6, 15.337, 15.9, 2.1, 16.2, 40.0], [2, 1, 1, 1, 1, 1]) },
      { number: '22', name: 'Joey Logano', driver_id: 4030, laps: laps([15.7, 15.65, 15.8, 15.9, 16.0, 39.0]) },
    ],
    results: [{ driver_id: 4050, name: 'Kyle Larson', number: '5', start: 2, finish: 3, status: 'Running' }],
  }
  const resolve = makeResolver([{ driver_name: 'Kyle Larson', nascar_driver_id: 4050 }, { driver_name: 'Joey Logano', nascar_driver_id: 4030 }])
  const { rows, skipped } = buildFastestLapRows(payload, resolve)
  expect(skipped).toEqual([])
  expect(rows[0].driver).toBe('Kyle Larson')          // (C) stripped, resolved by id
  expect(rows[0].rank).toBe(1)
  expect(rows[0].fastest_lap_num).toBe(2)               // 15.337, not the 2.1s glitch on lap 4
  expect(rows[0].fastest_time).toBe('15.337')
  expect(rows[0].__junk).toBe(1)
  expect(rows[0].start_pos).toBe(2); expect(rows[0].finish_pos).toBe(3)
  expect(rows[0].arp).toBeCloseTo(1.17, 2)
  // P50 over flying laps only: the 40s caution lap is outside 1.2x median and must not enter
  expect(rows[0].p50_time).toBeLessThan(16.5)
  expect(rows[1].driver).toBe('Joey Logano'); expect(rows[1].rank).toBe(2); expect(rows[1].start_pos).toBeNull()
  expect(rows[0].p50_speed).toBeGreaterThan(rows[0].p95_speed)
})

test('Lap Raptor-compatible rule drops laps numbered inside caution windows; raw mode keeps them', () => {
  const payload = {
    cautions: [{ start_lap: 72, end_lap: 79 }],
    drivers: [{ number: '16', name: 'A.J. Allmendinger', driver_id: 1, laps: [
      { lap: 77, time: 66.9, speed: 40, pos: 36 }, { lap: 78, time: 26.1, speed: 100, pos: 36 },
      { lap: 79, time: 22.759, speed: 118.6, pos: 36 }, { lap: 80, time: 23.059, speed: 117, pos: 36 }, { lap: 81, time: 23.3, speed: 116, pos: 36 },
    ] }],
    results: [],
  }
  const resolve = makeResolver([{ driver_name: 'A.J. Allmendinger', nascar_driver_id: 1 }])
  const lr = buildFastestLapRows(payload, resolve, { lapRaptorRule: true }).rows[0]
  expect(lr.fastest_lap_num).toBe(80); expect(lr.fastest_time).toBe('23.059'); expect(lr.__caution).toBe(3)
  const raw = buildFastestLapRows(payload, resolve, { lapRaptorRule: false }).rows[0]
  expect(raw.fastest_lap_num).toBe(79); expect(raw.fastest_time).toBe('22.759'); expect(raw.__caution).toBe(0)
})
