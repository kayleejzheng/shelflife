// Loads and computes the eco stats for the current user (Profile, Review, Suggestions).
import { useCallback, useEffect, useState } from 'react';
import { useApp } from './app';
import { computeStats, EcoStats, loadFinished } from './stats';

export function useEcoStats() {
  const { userId, members } = useApp();
  const [stats, setStats] = useState<EcoStats | null>(null);
  const memberKey = members.map((m) => m.id).join(',');

  const reload = useCallback(async () => {
    const rows = await loadFinished();
    const ids = memberKey ? memberKey.split(',') : [userId];
    setStats(computeStats(rows, userId, ids));
  }, [userId, memberKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stats, reload };
}
