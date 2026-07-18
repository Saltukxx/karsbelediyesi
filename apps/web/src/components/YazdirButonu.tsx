"use client";

export function YazdirButonu() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm font-medium"
    >
      Yazdır / PDF Kaydet
    </button>
  );
}
