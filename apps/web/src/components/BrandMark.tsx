"use client";

import Image from "next/image";
import { useState } from "react";

export function BrandMark({
  size = "md",
  light = false,
}: {
  size?: "sm" | "md" | "lg";
  light?: boolean;
}) {
  const [logoOk, setLogoOk] = useState(true);
  const box =
    size === "lg"
      ? "h-12 w-12 text-lg"
      : size === "sm"
        ? "h-8 w-8 text-xs"
        : "h-9 w-9 text-sm";
  const title =
    size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";
  const imgSize = size === "lg" ? 48 : size === "sm" ? 32 : 36;

  return (
    <div className="flex items-center gap-3">
      {logoOk ? (
        <Image
          src="/brand/logo.png"
          alt="Kars Belediyesi"
          width={imgSize}
          height={imgSize}
          className={`shrink-0 rounded-md object-contain ${box}`}
          onError={() => setLogoOk(false)}
          unoptimized
        />
      ) : (
        <div
          className={[
            "flex shrink-0 items-center justify-center rounded-md font-brand font-bold",
            box,
            light
              ? "bg-white/15 text-white ring-1 ring-white/25"
              : "bg-kb-navy text-white",
          ].join(" ")}
        >
          KB
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <div
          className={[
            "font-brand font-semibold tracking-tight",
            title,
            light ? "text-white" : "text-kb-navy",
          ].join(" ")}
        >
          Kars Belediyesi
        </div>
        <div className={light ? "text-[0.7rem] text-white/70" : "text-[0.7rem] text-kb-muted"}>
          Saha Operasyon Sistemi
        </div>
      </div>
    </div>
  );
}
