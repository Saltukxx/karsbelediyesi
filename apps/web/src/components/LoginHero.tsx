"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const SLIDES = [
  {
    src: "/brand/login/kars-15.jpg",
    alt: "Kars Kalesi ve çevresi",
    caption: "Gazi Kars",
  },
  {
    src: "/brand/login/kars-1.jpg",
    alt: "Kars tarihi sokakları",
    caption: "Tarihi doku",
  },
  {
    src: "/brand/login/kars-2.jpg",
    alt: "Kars mimarisi",
    caption: "Serhat şehri",
  },
  {
    src: "/brand/login/kars-12.jpg",
    alt: "Kars kent parkı",
    caption: "Kent yaşamı",
  },
] as const;

export function LoginHero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative hidden min-h-screen overflow-hidden lg:block">
      {SLIDES.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={i === 0}
          sizes="50vw"
          className={[
            "object-cover transition-opacity duration-[1.4s] ease-out",
            i === active ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-kb-navy-deep via-kb-navy-deep/55 to-kb-navy-deep/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-kb-navy-deep/50 to-transparent" />

      <div className="relative z-10 flex h-full min-h-screen flex-col justify-between px-12 py-14 text-white">
        <BrandMark light size="lg" />

        <div className="max-w-lg">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
            Fotoğraflarla Gazi Kars · {SLIDES[active]?.caption}
          </p>
          <h1 className="font-brand text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            Saha operasyonlarını tek merkezden yönetin
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
            Şikayet, filo, bakım ve görevlendirme süreçleri için kurumsal panel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              aria-label={`Fotoğraf ${i + 1}`}
              onClick={() => setActive(i)}
              className={[
                "h-1.5 rounded-full transition-all",
                i === active ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/60",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
