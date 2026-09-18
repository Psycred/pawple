/**
 * Optional feed nudge — unused on happy path (PAW-222 N5).
 * Returns null so primer copy cannot resurface if remounted.
 */
export default function NotificationNudge() {
  return null;
}
