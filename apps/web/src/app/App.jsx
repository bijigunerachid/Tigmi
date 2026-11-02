import { SystemStatus } from '../features/system/SystemStatus.jsx';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-10 px-4 py-12">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Tigmi<span className="text-accent">.</span>
        </h1>
        <p className="mt-3 text-ink-muted">Votre maison, intelligemment organisée.</p>
      </header>
      <SystemStatus />
    </main>
  );
}
