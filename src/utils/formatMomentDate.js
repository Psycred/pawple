/** e.g. "12 Feb 2026" in local timezone */
export function formatDayMonthYear(date) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

/** Short weekday for meetup cards, e.g. "Sun" */
export function formatShortWeekday(date) {
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  } catch {
    return '';
  }
}

/** Local time "8:00 AM" */
export function formatLocalTime(date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

/** Smart meetup day label — "Today", "Tomorrow", or weekday name. */
export function formatSmartMeetupDay(dateInput) {
  try {
    const raw = dateInput instanceof Date ? dateInput : new Date(String(dateInput).split('T')[0]);
    if (Number.isNaN(raw.getTime())) {
      return '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(raw);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / 86400000);

    if (diffDays === 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Tomorrow';
    }
    if (diffDays === -1) {
      return 'Yesterday';
    }

    return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(target);
  } catch {
    return '';
  }
}

/** Parse HH:MM:SS into a Date on today's calendar for formatting. */
export function parseTimeOnDate(dateInput, timeStr) {
  const datePart = String(dateInput ?? '').split('T')[0];
  const timePart = String(timeStr ?? '00:00:00').slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
