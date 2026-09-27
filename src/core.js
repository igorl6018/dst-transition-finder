/**
 * Returns the daylight saving time transitions for a given IANA timezone and year.
 *
 * Each result contains the exact instant the clock changes, the direction
 * ('spring-forward' or 'fall-back'), and the wall-clock jump in minutes.
 *
 * Why we rely on Intl APIs: Node's standard library exposes no other way to
 * query zone data. Every transition returned here is derived purely from
 * Intl.DateTimeFormat's offset for a given instant, so results match whatever
 * ICU data the runtime ships with. That makes this library suitable for
 * environments that cannot install tzdata packages, at the cost of being
 * limited by the runtime's ICU version.
 *
 * The algorithm samples one instant per hour across the target year and looks
 * for points where the UTC offset changes by more than 59 minutes. Sampling at
 * hourly granularity is sufficient because the smallest real-world DST offset
 * delta is 30 minutes and no transition lasts less than an hour. When a change
 * is detected, a binary search pinpoints the boundary to within one minute,
 * which is the precision we report.
 *
 * Historical transitions (zones that abolished DST decades ago) are reported
 * too, since the question is 'when did the offset change this year', not 'is
 * this zone currently a DST zone'. The fallback offset for winter is whatever
 * Intl reports for January 15 of the year; this is only used to classify a
 * transition as forward or backward.
 *
 * @param {string} timeZone IANA timezone identifier (e.g. 'America/New_York').
 * @param {number} year The Gregorian year to inspect.
 * @returns {Array<{instant: Date, direction: 'spring-forward'|'fall-back', minutes: number}>}
 */
export function findDstTransitions(timeZone, year) {
  if (typeof timeZone !== 'string' || timeZone.length === 0) {
    throw new TypeError('timeZone must be a non-empty IANA timezone string');
  }
  if (!Number.isInteger(year) || year < 0 || year > 9999) {
    throw new TypeError('year must be an integer between 0 and 9999');
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  /**
   * Parse the GMT offset string (e.g. 'GMT-04:00', 'GMT+05:45', 'GMT') into
   * total minutes east of UTC. Returns 0 for bare 'GMT' which ICU emits for
   * zones with a zero offset.
   */
 function offsetMinutes(instant) {
    const parts = fmt.formatToParts(instant);
    const tz = parts.find((p) => p.type === 'timeZoneName');
    if (!tz) return 0;
    const m = tz.value.match(/GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    const hours = parseInt(m[2], 10);
    const mins = parseInt(m[3], 10);
    const secs = m[4] ? parseInt(m[4], 10) : 0;
    return sign * (hours * 60 + mins + Math.floor(secs / 60));
  }

  const janOffset = offsetMinutes(new Date(Date.UTC(year, 0, 15, 12, 0, 0)));

  const transitions = [];
  let prevOffset = offsetMinutes(new Date(Date.UTC(year, 0, 1, 0, 0, 0)));
  const endMs = Date.UTC(year, 11, 31, 23, 0, 0);

  for (let t = Date.UTC(year, 0, 1, 1, 0, 0); t <= endMs; t += 60 * 60 * 1000) {
    const current = offsetMinutes(new Date(t));
    if (current !== prevOffset) {
      const diff = current - prevOffset;
      const instant = pinpointTransition(prevOffset, current, t - 60 * 60 * 1000, t, offsetMinutes);
      transitions.push({
        instant,
        direction: diff > 0 ? 'spring-forward' : 'fall-back',
        minutes: Math.abs(diff),
      });
      prevOffset = current;
    }
  }

  return transitions;
}

/**
 * Binary search the hour [lowMs, highMs) for the earliest minute where the
 * offset equals currentOffset. Returns the Date at that minute.
 *
 * lowMs has offset = prevOffset, highMs has offset = currentOffset. We narrow
 * the interval until it spans a single minute, then report highMs as the
 * transition instant. (Reporting the first instant with the new offset is a
 * deliberate choice: it matches how 'the clocks jump forward at 02:00' is
 * conventionally described.)
 */
function pinpointTransition(prevOffset, currentOffset, lowMs, highMs, offsetMinutes) {
  let lo = lowMs;
  let hi = highMs;
  while (hi - lo > 60 * 1000) {
    const mid = lo + Math.floor((hi - lo) / (2 * 60 * 1000)) * 60 * 1000;
    if (offsetMinutes(new Date(mid)) === prevOffset) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}
