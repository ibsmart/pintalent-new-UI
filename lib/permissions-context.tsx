'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PermissionsContextValue {
  can: (permission: string) => boolean;
  role: string;
  loaded: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  can: () => false,
  role: '',
  loaded: false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setPermissions(d.permissions || []);
          setRole(d.role || '');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function can(permission: string): boolean {
    if (role === 'admin') return true;
    return permissions.includes(permission);
  }

  return (
    <PermissionsContext.Provider value={{ can, role, loaded }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
