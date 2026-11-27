// Sustituto de next/dynamic para la vista previa sin Next.js.
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

export default function dynamic<P extends object>(cargar: () => Promise<{ default: ComponentType<P> }>, opciones?: { loading?: () => ReactNode }) {
  const Perezoso = lazy(cargar);
  return function Dinamico(props: P) {
    return (
      <Suspense fallback={opciones?.loading?.() ?? null}>
        <Perezoso {...props} />
      </Suspense>
    );
  };
}
