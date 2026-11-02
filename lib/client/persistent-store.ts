import { useSyncExternalStore } from "react";

type StorageKind = "local" | "session";

export type PersistentStore<T> = {
  get: () => T;
  set: (updater: T | ((current: T) => T)) => boolean;
  subscribe: (listener: () => void) => () => void;
  /** React hook; returns the server value during SSR and hydration. */
  use: () => T;
};

/**
 * A small browser-storage-backed store for client state such as the cart.
 * Values are validated on read (`sanitize`), shared across components through
 * useSyncExternalStore, and kept in sync across tabs via the `storage` event.
 */
export function createPersistentStore<T>(
  key: string,
  fallback: T,
  sanitize: (raw: unknown) => T,
  kind: StorageKind = "local",
): PersistentStore<T> {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;

  const storage = () => {
    try {
      return kind === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };

  function get(): T {
    if (typeof window === "undefined") return fallback;
    let raw: string | null = null;
    try {
      raw = storage()?.getItem(key) ?? null;
    } catch {
      raw = null;
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    try {
      value = raw ? sanitize(JSON.parse(raw)) : fallback;
    } catch {
      value = fallback;
    }
    cache = { raw, value };
    return value;
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  function set(updater: T | ((current: T) => T)) {
    const next = typeof updater === "function" ? (updater as (current: T) => T)(get()) : updater;
    try {
      storage()?.setItem(key, JSON.stringify(next));
      cache = null;
      emit();
      return true;
    } catch {
      return false;
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    get,
    set,
    subscribe,
    use: () => useSyncExternalStore(subscribe, get, () => fallback),
  };
}

/** True after hydration; lets UI avoid flashing "empty cart" before storage is read. */
const noopSubscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
