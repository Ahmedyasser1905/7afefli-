// apps/mobile/src/hooks/booking/useSlotLock.ts
// 5-minute UX lock — prevents accidental navigation away from a tapped slot
// Does NOT block other users (DB trigger handles race conditions)

import { useState, useCallback, useRef, useEffect } from 'react';

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface Lock {
  startTime: string;
  lockedAt: number; // Date.now() when locked
  timerId: ReturnType<typeof setTimeout>;
}

interface UseSlotLockReturn {
  lockSlot: (startTime: string) => void;
  releaseLock: (startTime: string) => void;
  isSlotLocked: (startTime: string) => boolean;
  isSlotLockedByMe: (startTime: string) => boolean;
  getLockSecondsLeft: (startTime: string) => number;
  activeLockedSlot: string | null;
}

export function useSlotLock(): UseSlotLockReturn {
  // Map<startTime, Lock>
  const [locks, setLocks] = useState<Map<string, Lock>>(new Map());
  const locksRef = useRef(locks);
  locksRef.current = locks;

  // Force re-render every second for countdown display
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const lockSlot = useCallback((startTime: string) => {
    // Release any other existing lock (single lock at a time)
    locksRef.current.forEach((lock, key) => {
      if (key !== startTime) clearTimeout(lock.timerId);
    });

    // Clear any existing lock on this specific slot
    const existing = locksRef.current.get(startTime);
    if (existing) clearTimeout(existing.timerId);

    const timerId = setTimeout(() => {
      // Auto-release after 5 minutes
      setLocks((prev) => {
        const next = new Map(prev);
        next.delete(startTime);
        return next;
      });
    }, LOCK_DURATION_MS);

    // Replace all locks with just this one (single slot lock model)
    setLocks(new Map([[startTime, { startTime, lockedAt: Date.now(), timerId }]]));
  }, []);

  const releaseLock = useCallback((startTime: string) => {
    const lock = locksRef.current.get(startTime);
    if (lock) clearTimeout(lock.timerId);
    setLocks((prev) => {
      const next = new Map(prev);
      next.delete(startTime);
      return next;
    });
  }, []);

  const isSlotLocked = useCallback((startTime: string): boolean => {
    const lock = locksRef.current.get(startTime);
    if (!lock) return false;
    return Date.now() - lock.lockedAt < LOCK_DURATION_MS;
  }, []);

  // For this single-user device, "locked by me" = any lock
  const isSlotLockedByMe = isSlotLocked;

  const getLockSecondsLeft = useCallback((startTime: string): number => {
    const lock = locksRef.current.get(startTime);
    if (!lock) return 0;
    const elapsed = Date.now() - lock.lockedAt;
    return Math.max(0, Math.ceil((LOCK_DURATION_MS - elapsed) / 1000));
  }, []);

  // Find the slot the current user has actively locked
  const activeLockedSlot = (() => {
    for (const [startTime, lock] of locksRef.current.entries()) {
      if (Date.now() - lock.lockedAt < LOCK_DURATION_MS) return startTime;
    }
    return null;
  })();

  return {
    lockSlot,
    releaseLock,
    isSlotLocked,
    isSlotLockedByMe,
    getLockSecondsLeft,
    activeLockedSlot,
  };
}
