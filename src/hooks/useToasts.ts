import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastMessage } from '../components/ToastContainer.tsx';

const TOAST_TTL_MS = 4500;

export type Notify = (type: ToastMessage['type'], title: string, detail?: string) => void;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback<Notify>(
    (type, title, detail) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, title, detail }]);
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_TTL_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, notify, dismiss };
}
