// Dates and times as the factory floor reads them: Sri Lanka Standard Time
// (Asia/Colombo, UTC+05:30) on a 12-hour clock, e.g. "8 Oct 2026, 07:07 AM".
//
// The database and the API keep timestamps in UTC; this is display only.
// The zone is fixed rather than taken from the viewer's device, so a
// timestamp reads the same for everyone and the server-rendered text always
// equals the browser-rendered text.

const FACTORY_TIME_ZONE = "Asia/Colombo";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Only numbers are taken from Intl. Month names and AM/PM are written here,
// because their spelling differs between JavaScript engines ("Sep" or "Sept",
// "am" or "AM"), which would make server and browser output disagree.
const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: FACTORY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function factoryParts(iso: string) {
  const parts = Object.fromEntries(
    partsFormat
      .formatToParts(new Date(iso))
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    day: parts.day,
    month: MONTHS[parts.month - 1],
    year: parts.year,
    hour: parts.hour,
    minute: parts.minute,
  };
}

// "8 Oct 2026"
export function formatDate(iso: string): string {
  const { day, month, year } = factoryParts(iso);
  return `${day} ${month} ${year}`;
}

// "8 Oct 2026, 07:07 AM"
export function formatDateTime(iso: string): string {
  const { hour, minute } = factoryParts(iso);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${formatDate(iso)}, ${pad(hour12)}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
}
