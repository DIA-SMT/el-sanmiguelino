import { MigueChat } from "@/components/migue/migue-chat";

/** Escritorio sobre el que se apoya la hoja del diario. Migue vive acá para
 *  que la conversación sobreviva al paso de página. */
export default function DiarioLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-escritorio px-0 py-0 sm:px-6 sm:py-8">
      {children}
      <MigueChat />
    </div>
  );
}
