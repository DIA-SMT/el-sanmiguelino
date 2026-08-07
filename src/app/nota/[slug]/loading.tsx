export default function LoadingNota() {
  return (
    <main
      className="mx-auto w-full max-w-6xl flex-1 animate-pulse px-4 py-10 sm:px-6"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Cargando la nota
      </p>
      <div aria-hidden="true">
        <div className="mx-auto h-4 w-24 rounded bg-line" />
        <div className="mx-auto mt-4 h-10 w-3/4 rounded bg-line" />
        <div className="mx-auto mt-3 h-10 w-1/2 rounded bg-line" />
        <div className="mx-auto mt-5 h-4 w-2/3 rounded bg-line" />
        <div className="mx-auto mt-8 aspect-[8/5] w-full max-w-4xl rounded bg-line" />
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-3 w-full rounded bg-line" />
              <div className="h-3 w-full rounded bg-line" />
              <div className="h-3 w-4/5 rounded bg-line" />
              <div className="h-3 w-full rounded bg-line" />
              <div className="h-3 w-2/3 rounded bg-line" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
