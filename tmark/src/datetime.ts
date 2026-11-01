/** Format a date in a source timezone. Invalid zones throw a RangeError. */
export function formatDateTime(date: Date, timezone: string): string {
  timezone ||= "UTC";
  if (timezone === "UTC" || timezone === "GMT" || timezone === "Z") {
    return date.toLocaleString(undefined, { timeZone: "UTC" });
  }

  const offset = /^(?:([+-])(\d{2}):(\d{2})|UTC([+-])(\d{1,2})(?::(\d{2}))?)$/.exec(timezone);
  if (offset && offset[0] === timezone) {
    const sign = offset[1] ?? offset[4];
    const hours = Number(offset[2] ?? offset[5]);
    const minutes = Number(offset[3] ?? offset[6] ?? 0);
    if (hours > 23 || minutes > 59) throw new RangeError("Invalid timezone offset");
    const offsetMinutes = (hours * 60 + minutes) * (sign === "+" ? 1 : -1);
    return new Date(date.getTime() + offsetMinutes * 60_000).toLocaleString(undefined, { timeZone: "UTC" });
  }

  // Intl also accepts offsets, platform-specific names, and non-IANA abbreviations.
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(timezone)
    || /\s/.test(timezone)
    || /^(?:local|localtime|posixrules|utc|gmt|z)$/i.test(timezone)
    || /^(?:posix|right)\//i.test(timezone)
    || (/^[A-Za-z]{2,4}$/.test(timezone) && !/^(?:CET|Cuba|EET|EST|Eire|GB|GMT|HST|Iran|MET|MST|NZ|PRC|ROC|ROK|UCT|UTC|WET|Zulu)$/.test(timezone))
    || (/^(?:UTC|GMT)[+-]/i.test(timezone))) {
    throw new RangeError("Invalid timezone name");
  }
  return date.toLocaleString(undefined, { timeZone: timezone });
}
