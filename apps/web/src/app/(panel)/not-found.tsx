import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonCls, cardCls } from "@/lib/ui";

/**
 * Panel içi 404. `notFound()` yetki denetimlerinde de çağrıldığı için
 * "bulunamadı veya yetkiniz yok" ifadesi bilinçli olarak birleşiktir.
 */
export default function PanelNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-10">
      <div className={`${cardCls} max-w-lg p-8 text-center`}>
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-kb-surface text-kb-muted">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-brand text-xl font-semibold text-kb-navy">
          Kayıt bulunamadı
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-kb-muted">
          Aradığınız kayıt silinmiş olabilir ya da görüntüleme yetkiniz yok.
        </p>
        <div className="mt-6">
          <Link href="/" className={buttonCls("primary")}>
            Panele dön
          </Link>
        </div>
      </div>
    </div>
  );
}
