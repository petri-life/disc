// Version is baked in at build time by deploy.sh from disc-app/VERSION.
// Falls back to 'dev' if Vite didn't see the var (local `bun run dev`
// without going through deploy.sh).
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev'

export function Footer() {
  return (
    <footer className="footer">
      disc.petri.life &middot;{' '}
      <a href="https://petri.life" target="_blank" rel="noopener">petri.life</a>
      {' '}&middot;{' '}
      <span className="footer-version" title="Deployed version (disc-app/VERSION)">
        v{APP_VERSION}
      </span>
    </footer>
  )
}
