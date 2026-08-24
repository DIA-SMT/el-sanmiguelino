export default function LoadingNota() {
  return (
    <div className="hoja grano mx-auto w-full max-w-6xl">
      <main
        className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10 sm:px-6"
        aria-busy="true"
      >
        <p className="sr-only" role="status">
          Cargando la nota
        </p>
        <div aria-hidden="true">
          <div className="mx-auto h-3 w-24 bg-line" />
          <div className="mx-auto mt-5 h-11 w-3/4 bg-line" />
          <div className="mx-auto mt-3 h-11 w-1/2 bg-line" />
          <div className="mx-auto mt-6 h-4 w-2/3 bg-line" />
          <div className="mx-auto mt-9 aspect-[8/5] w-full max-w-4xl bg-line" />
          <div className="mt-9 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-3 w-full bg-line" />
                <div className="h-3 w-full bg-line" />
                <div className="h-3 w-4/5 bg-line" />
                <div className="h-3 w-full bg-line" />
                <div className="h-3 w-2/3 bg-line" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
