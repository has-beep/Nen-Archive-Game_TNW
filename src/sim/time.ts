/**
 * The calendar. One tick is one day. Day 0 is the world's start date, which
 * the era preset chooses (the default is 1 December 1998, five weeks before
 * the 287th Hunter Exam). Dates use the ordinary Gregorian calendar, which is
 * what the series uses.
 *
 * Date.UTC is pure arithmetic and safe in a deterministic simulation; only
 * Date.now() would not be.
 */
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))
const DAY_MS = 86400000

export interface CalDate {
  y: number
  m: number // 0-11
  d: number // 1-31
  dow: number // 0 = Sunday
}

export function epochOf(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m, d) / DAY_MS)
}

export function dateOf(epoch: number, t: number): CalDate {
  const dt = new Date((epoch + t) * DAY_MS)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() }
}

export function dateStr(epoch: number, t: number): string {
  const c = dateOf(epoch, t)
  return `${c.d} ${MONTHS[c.m]} ${c.y}`
}

export function shortDate(epoch: number, t: number): string {
  const c = dateOf(epoch, t)
  return `${c.d} ${MONTHS_SHORT[c.m]} ${c.y}`
}

/** The tick on which a calendar date falls, relative to the world epoch. */
export function tickOf(epoch: number, y: number, m: number, d: number): number {
  return epochOf(y, m, d) - epoch
}

export function ageAt(born: number, t: number): number {
  return Math.floor((t - born) / 365.25)
}

export const YEAR = 365
export const MONTH = 30
export const WEEK = 7
