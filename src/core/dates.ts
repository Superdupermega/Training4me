/**
 * "Today" only has one honest answer once you pick a timezone. Every server
 * route in this app runs on Vercel in UTC — `new Date().toISOString().slice(0, 10)`
 * silently reads UTC's calendar day, which is one day behind local for
 * every evening hour in a timezone east of Greenwich (and one day ahead for
 * every early-morning hour west of it). That misdated "today" is what
 * decided whether `/today` called a session Missed while the athlete was
 * still standing in the gym. See docs/07-PRODUCTION-REVIEW.md #7.
 *
 * Pure, dependency-free (`Intl.DateTimeFormat` is a runtime built-in, not a
 * library) so this lives in src/core alongside the rest of the app's pure
 * logic, not src/server.
 */

// vercel.json pins the arn1 (Stockholm) region specifically to sit next to
// the Supabase project — this app has exactly one athlete, and this is
// their timezone unless t4m_profile.timezone says otherwise.
export const DEFAULT_TIMEZONE = 'Europe/Stockholm';

/** The calendar date (YYYY-MM-DD) a moment falls on in a given IANA timezone. */
export function isoDateInTimeZone(date: Date, timeZone: string): string {
  // en-CA is the one built-in locale whose default date format is YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** Today's date, in the given timezone (or this app's default). */
export function today(timeZone: string = DEFAULT_TIMEZONE): string {
  return isoDateInTimeZone(new Date(), timeZone);
}

/**
 * `offset` calendar days from today, in the given timezone — negative for
 * the past, positive for the future. Anchors on today at noon UTC before
 * shifting, so a whole-day offset can't itself be pushed across a calendar
 * boundary by a timezone's DST transition; the result is re-read back out
 * through `timeZone` regardless.
 */
export function daysFromToday(offset: number, timeZone: string = DEFAULT_TIMEZONE): string {
  const base = new Date(`${today(timeZone)}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return isoDateInTimeZone(base, timeZone);
}
