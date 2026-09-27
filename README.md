# DST Transition Finder

Given an IANA timezone and a Gregorian year, returns the exact instants when daylight saving time starts and ends, the direction of each change, and the wall-clock jump in minutes.

```js
import { findDstTransitions } from 'dst-transition-finder';

const t = findDstTransitions('America/New_York', 2024);
// [
//   { instant: 2024-03-10T07:00:00.000Z, direction: 'spring-forward', minutes: 60 },
//   { instant: 2024-11-03T06:00:00.000Z, direction: 'fall-back', minutes: 60 }
// ]
```

`instant` is a `Date` representing the first UTC moment with the new offset. `direction` is `'spring-forward'` or `'fall-back'`. `minutes` is the absolute size of the offset change.

## Why this exists

The standard library has no function that answers 'when does DST change this year'. The only portable way to derive it from Node alone is to sample `Intl.DateTimeFormat` offsets over the year and find where they jump. This library does exactly that, with a binary search to pin each boundary to the minute.

The trade-off: results depend entirely on the ICU data bundled with your Node runtime. If your runtime's tzdata is stale, the transitions will be too. There is no bundled tzdata and no network fetch. If you need guaranteed-current zone data, use a library that ships its own.

## Edge cases

- Zones with no DST transitions in the year (UTC, Asia/Tokyo) return an empty array.
- Historical transitions are reported even for zones that later abolished DST (e.g. Europe/Moscow in 2010).
- Southern-hemisphere zones return fall-back first, then spring-forward, because their DST wraps the calendar year.
- 30-minute DST offsets (Australia/Lord_Howe) are reported correctly.
- Zones whose offset changed mid-year for non-DST reasons (e.g. Antarctica/Casey) are included: this library reports every offset discontinuity, not only those labelled 'DST' in zone metadata.
