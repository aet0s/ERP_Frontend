import { useState, useEffect, useCallback } from 'react';

/**
 * usePersistentTab — Synchronizes tab state with URL search params (?tab=...) and sessionStorage.
 * Ensures that refreshing the page or navigating back stays on the selected tab.
 * 
 * @param storageKey Unique key for this page (e.g. 'superadmin_audit', 'superadmin_backups')
 * @param defaultValue Default tab value if no param is present
 * @param paramName Query param name (default: 'tab')
 */
export function usePersistentTab<T extends string>(
  storageKey: string,
  defaultValue: T,
  paramName = 'tab'
): [T, (tab: T) => void] {
  const getInitialTab = (): T => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlValue = urlParams.get(paramName) || urlParams.get(storageKey);
        if (urlValue) {
          return urlValue as T;
        }

        const stored = sessionStorage.getItem(`active_tab_${storageKey}`);
        if (stored) {
          return stored as T;
        }
      }
    } catch {
      // Ignore storage access errors
    }
    return defaultValue;
  };

  const [activeTab, setActiveTabState] = useState<T>(getInitialTab);

  const setTab = useCallback((newTab: T) => {
    setActiveTabState(newTab);
    try {
      sessionStorage.setItem(`active_tab_${storageKey}`, newTab);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set(paramName, newTab);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // Ignore storage/history errors
    }
  }, [storageKey, paramName]);

  // Sync to sessionStorage & URL on initial load if present
  useEffect(() => {
    try {
      sessionStorage.setItem(`active_tab_${storageKey}`, activeTab);
    } catch {
      // Ignore
    }
  }, [storageKey, activeTab]);

  return [activeTab, setTab];
}
