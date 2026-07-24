'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// SpaceValue: slug=null means "All spaces"
export interface SpaceValue {
  slug: string | null;
  name?: string;
}

interface SpaceContextType {
  space: SpaceValue;
  setSpace: (space: SpaceValue) => void;
}

const LS_KEY = 'onemcp:space';

const SpaceContext = createContext<SpaceContextType>({
  space: { slug: null },
  setSpace: () => {},
});

function readLocalStorage(): SpaceValue {
  if (typeof window === 'undefined') return { slug: null };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { slug: null };
    return JSON.parse(raw) as SpaceValue;
  } catch {
    return { slug: null };
  }
}

function writeLocalStorage(space: SpaceValue): void {
  if (typeof window === 'undefined') return;
  try {
    if (space.slug === null) {
      window.localStorage.removeItem(LS_KEY);
    } else {
      window.localStorage.setItem(LS_KEY, JSON.stringify(space));
    }
  } catch {
    // ignore quota errors
  }
}

export interface SpaceProviderProps {
  children: ReactNode;
  /** Passed from Server Component via searchParams */
  initialSlug?: string | null;
  initialName?: string;
}

export function SpaceProvider({ children, initialSlug, initialName }: SpaceProviderProps) {
  const [space, setSpaceState] = useState<SpaceValue>(() => {
    // Priority: URL param (via initialSlug prop) → localStorage → null
    if (initialSlug) return { slug: initialSlug, name: initialName };
    const ls = readLocalStorage();
    return ls;
  });

  const setSpace = useCallback((next: SpaceValue) => {
    setSpaceState(next);
    writeLocalStorage(next);
    // URL sync is handled by SpaceSwitcher via router.push
  }, []);

  const value = useMemo(() => ({ space, setSpace }), [space, setSpace]);

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useCurrentSpace(): SpaceContextType {
  return useContext(SpaceContext);
}
