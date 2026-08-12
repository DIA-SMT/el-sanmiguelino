export default function LoadingPortada() {
  return (
    <main
      className="mx-auto w-full max-w-6xl flex-1 animate-pulse px-4 py-10 sm:px-6"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Cargando la edición
      </p>
      <div aria-hidden="true">
        <div className="mx-auto h-12 w-2/3 rounded bg-line" />
        <div className="mx-auto mt-4 h-4 w-1/3 rounded bg-line" />
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="h-4 w-24 rounded bg-line" />
            <div className="h-10 w-full rounded bg-line" />
            <div className="h-10 w-4/5 rounded bg-line" />
            <div className="h-4 w-full rounded bg-line" />
            <div className="h-4 w-2/3 rounded bg-line" />
          </div>
          <div className="aspect-[8/5] w-full rounded bg-line" />
        </div>
      </div>
    </main>
  );
}
