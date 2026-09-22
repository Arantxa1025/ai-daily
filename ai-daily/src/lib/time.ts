const TZ = "Asia/Shanghai";

export function formatShanghaiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}

export function shanghaiMinutesSinceMidnight(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  return utc.toISOString().slice(0, 10);
}

export function getRecommendedSlot(now = new Date()) {
  const date = formatShanghaiDate(now);
  const minutes = shanghaiMinutesSinceMidnight(now);
  const yesterday = addDays(date, -1);
  const morningAt = 7 * 60 + 30;
  const afternoonAt = 17 * 60 + 30;

  if (minutes < morningAt) {
    return {
      date,
      primary: null,
      secondary: null,
      nextUpdateLabel: "今日基础预计 07:30 更新",
      yesterday,
    };
  }
  if (minutes < afternoonAt) {
    return {
      date,
      primary: "morning" as const,
      secondary: "afternoon" as const,
      nextUpdateLabel: "今日热点预计 17:30 更新",
      yesterday,
    };
  }
  return {
    date,
    primary: "afternoon" as const,
    secondary: "morning" as const,
    nextUpdateLabel: null,
    yesterday,
  };
}
