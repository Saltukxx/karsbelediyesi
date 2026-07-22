import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { BrandMark } from "@/components/BrandMark";
import { LoginHero } from "@/components/LoginHero";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { btnPrimary, inputCls, labelCls } from "@/lib/ui";

export const metadata = { title: "Giriş — Kars Belediyesi" };

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; hata?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");
  const { callbackUrl, hata } = await searchParams;

  async function girisYap(formData: FormData) {
    "use server";
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown";
    const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
    if (!checkLoginRateLimit(ip, phone)) {
      redirect(`/giris?hata=limit`);
    }
    try {
      await signIn("credentials", {
        phone: formData.get("phone"),
        password: formData.get("password"),
        redirectTo: (formData.get("callbackUrl") as string) || "/",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect(`/giris?hata=1`);
      }
      throw e;
    }
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <LoginHero />

      <section className="relative flex items-center justify-center px-4 py-12 lg:bg-kb-surface">
        {/* Mobil: hafif arka plan fotoğrafı */}
        <div className="absolute inset-0 lg:hidden">
          <Image
            src="/brand/login/kars-15.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-kb-navy-deep/75" />
        </div>

        <div className="relative z-10 w-full max-w-md rounded-lg border border-kb-border bg-white p-8 shadow-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <div className="mb-6">
            <h2 className="font-brand text-2xl font-semibold text-kb-navy">Giriş</h2>
            <p className="mt-1 text-sm text-kb-muted">
              Telefon numarası ve şifrenizle oturum açın.
            </p>
          </div>
          {hata && (
            <p className="mb-4 rounded-md border border-kb-danger/20 bg-kb-danger-bg px-3 py-2.5 text-sm text-kb-danger">
              {hata === "limit"
                ? "Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin."
                : "Telefon numarası veya şifre hatalı."}
            </p>
          )}
          <form action={girisYap} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
            <div>
              <label htmlFor="phone" className={labelCls}>
                Telefon
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="05xxxxxxxxx"
                className={inputCls}
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="password" className={labelCls}>
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Giriş Yap
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-kb-muted">
            Yetkisiz erişim engellenir. Oturum bilgilerinizi paylaşmayın.
          </p>
        </div>
      </section>
    </main>
  );
}
