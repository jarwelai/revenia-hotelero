// Layout mínimo para rutas de embed (iframe-friendly).
// No añade chrome: sin sidebar, header ni footer.
// El root layout (html/body) ya es provisto por src/app/layout.tsx.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
