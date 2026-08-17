'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function AdminDeferredRender({ children, fallback }: { readonly children: ReactNode; readonly fallback: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = fallbackRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return visible ? children : <div ref={fallbackRef}>{fallback}</div>;
}
