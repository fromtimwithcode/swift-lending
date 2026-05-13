function parseUsDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function formatUsDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

export function getSixMonthMaturityDate(closeDate: string) {
  const date = parseUsDate(closeDate);
  if (!date) return "";

  const targetMonth = date.getMonth() + 6;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return formatUsDate(new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay)));
}
