import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function readSessionValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue;
  }

  const storedValue = window.sessionStorage.getItem(key);
  if (!storedValue) {
    return initialValue;
  }

  try {
    return JSON.parse(storedValue) as T;
  }
  catch {
    return initialValue;
  }
}

export function useSessionState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readSessionValue(key, initialValue));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

export function usePreservedListState<T>(key: string, initialValue: T) {
  const location = useLocation();
  const navigate = useNavigate();
  const [value, setValue] = useSessionState(key, initialValue);
  const shouldPreserve = useMemo(
    () => (location.state as { preserveState?: boolean } | null)?.preserveState === true,
    [location.state]
  );

  useEffect(() => {
    if (!shouldPreserve) {
      setValue(initialValue);
      return;
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [initialValue, location.pathname, navigate, setValue, shouldPreserve]);

  return [value, setValue] as const;
}