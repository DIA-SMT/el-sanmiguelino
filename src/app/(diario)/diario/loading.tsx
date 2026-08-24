export default function LoadingPortada() {
  return (
    <div className="hoja grano mx-auto w-full max-w-6xl">
      <main
        className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10 sm:px-6"
        aria-busy="true"
      >
        <p className="sr-only" role="status">
          Cargando la edición
        </p>
        <div aria-hidden="true">
          <div className="mx-auto h-4 w-40 bg-line" />
          <div className="mx-auto mt-5 h-12 w-3/4 bg-line" />
          <div className="mx-auto mt-3 h-12 w-1/2 bg-line" />
          <div className="mx-auto mt-6 h-4 w-1/3 bg-line" />
          <div className="mt-10 grid gap-8 md:grid-cols-[0.85fr_1.45fr_0.85fr]">
            <div className="space-y-3">
              <div className="h-3 w-20 bg-line" />
              <div className="h-6 w-full bg-line" />
              <div className="h-3 w-full bg-line" />
              <div className="h-3 w-full bg-line" />
              <div className="h-3 w-2/3 bg-line" />
            </div>
            <div className="space-y-3">
              <div className="aspect-[8/5] w-full bg-line" />
              <div className="h-3 w-full bg-line" />
              <div className="h-3 w-full bg-line" />
              <div className="h-3 w-4/5 bg-line" />
            </div>
            <div className="space-y-3">
              <div className="h-28 w-full bg-line" />
              <div className="h-3 w-full bg-line" />
              <div className="h-3 w-3/4 bg-line" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
