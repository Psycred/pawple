export function normalizeMomentHeartState(row) {
  const heartCount = Math.max(0, Number(row?.heart_count) || 0);
  return {
    heartCount,
    hasEverBeenHearted: heartCount > 0,
    viewerHasHearted: Boolean(row?.viewer_has_hearted),
  };
}
