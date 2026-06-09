import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getSupportedTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }

  return [
    "UTC",
    "Europe/Berlin",
    "Europe/Sofia",
    "Europe/London",
    "America/New_York",
    "Asia/Ho_Chi_Minh",
  ];
}

export function zonedWallTimeToUtcIso(date: string, time: string, timeZone: string): string {
  return fromZonedTime(`${date}T${time}:00`, timeZone).toISOString();
}

export function utcIsoToZonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const zoned = toZonedTime(iso, timeZone);
  const year = zoned.getFullYear();
  const month = String(zoned.getMonth() + 1).padStart(2, "0");
  const day = String(zoned.getDate()).padStart(2, "0");
  const hours = String(zoned.getHours()).padStart(2, "0");
  const minutes = String(zoned.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function formatDateTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
