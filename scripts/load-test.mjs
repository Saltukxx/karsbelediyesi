/**
 * Panel API'sinin eşzamanlı kullanıcı kapasitesini ölçer.
 *
 * Gerçek kullanım şekli taklit edilir: her sanal kullanıcı bir ekran açar, listeyi
 * çeker, bildirim yoklamasını yapar ve düşünme süresi kadar bekler. Amaç saniyede
 * kaç istek atılabildiği değil, kaç kullanıcının kabul edilebilir gecikmeyle
 * çalışabildiği.
 *
 * Kullanım: node scripts/load-test.mjs [--url http://localhost:3100] [--users 50]
 *                                     [--seconds 30] [--think 2]
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const BASE = args.url ?? "http://localhost:3100";
const USERS = Number(args.users ?? 25);
const SECONDS = Number(args.seconds ?? 30);
/** Ortalama düşünme süresi (sn); gerçek panel kullanımında 10-20 sn civarı. */
const THINK = Number(args.think ?? 2);
/**
 * Kullanıcıların devreye alındığı pencere (sn). 0 verilirse hepsi aynı anda
 * başlar; mesai başlangıcındaki toplu açılışı ölçmek için kullanılır.
 */
const STAGGER = Number(args.stagger ?? THINK);
const PHONE = args.phone ?? "05000000000";
const PASSWORD = args.password ?? "admin123";

/** Bir panel kullanıcısının tipik oturumunda dolaştığı uçlar ve göreli sıklıkları. */
const SENARYO = [
  { ad: "dashboard", yol: "/api/v1/dashboard?aralik=30g", agirlik: 3 },
  { ad: "sikayetler", yol: "/api/v1/complaints?sekme=aktif", agirlik: 4 },
  { ad: "bildirim", yol: "/api/v1/notifications", agirlik: 6 },
  { ad: "araclar", yol: "/api/v1/vehicles", agirlik: 2 },
  { ad: "gorevler", yol: "/api/v1/tasks", agirlik: 2 },
  { ad: "yakit", yol: "/api/v1/fuel", agirlik: 1 },
  { ad: "bakim", yol: "/api/v1/maintenance", agirlik: 1 },
  { ad: "personel", yol: "/api/v1/personnel", agirlik: 1 },
];

const havuz = SENARYO.flatMap((s) => Array(s.agirlik).fill(s));

async function girisYap() {
  // Giriş ucu (ip, telefon) başına 15 dakikada 10 denemeyle sınırlı; ardışık
  // ölçümlerde kotayı tüketmemek için hazır token verilebilir.
  if (args.token) return args.token;
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Giriş başarısız: ${res.status}`);
  const { token } = await res.json();
  if (!token) throw new Error("Yanıtta token yok");
  return token;
}

const olcumler = new Map(SENARYO.map((s) => [s.ad, []]));
/** Hata nedenini ayırt etmek için: HTTP durum kodu ya da soket hatası kodu. */
const hatalar = new Map();
let hata = 0;
let toplam = 0;

function hataSay(anahtar) {
  hata++;
  hatalar.set(anahtar, (hatalar.get(anahtar) ?? 0) + 1);
}

async function istek(token, senaryo) {
  const bas = performance.now();
  try {
    const res = await fetch(`${BASE}${senaryo.yol}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await res.arrayBuffer();
    const sure = performance.now() - bas;
    toplam++;
    if (!res.ok) {
      hataSay(`HTTP ${res.status}`);
      return;
    }
    olcumler.get(senaryo.ad).push(sure);
  } catch (e) {
    toplam++;
    hataSay(e.cause?.code ?? e.code ?? e.name ?? "bilinmeyen");
  }
}

/**
 * Bir sanal kullanıcı: istek at, düşünme süresi kadar bekle, tekrarla.
 * Gerçek kullanıcılar aynı anda oturum açmadığı için başlangıç kademelendirilir.
 */
async function sanalKullanici(token, bitis, gecikme) {
  await new Promise((r) => setTimeout(r, gecikme));
  while (performance.now() < bitis) {
    const senaryo = havuz[Math.floor(Math.random() * havuz.length)];
    await istek(token, senaryo);
    const dusunme = THINK * 1000 * (0.5 + Math.random());
    if (performance.now() + dusunme > bitis) break;
    await new Promise((r) => setTimeout(r, dusunme));
  }
}

function yuzdelik(dizi, p) {
  if (!dizi.length) return null;
  const sirali = [...dizi].sort((a, b) => a - b);
  return sirali[Math.min(sirali.length - 1, Math.floor((p / 100) * sirali.length))];
}

const ms = (v) => (v == null ? "  —  " : `${v.toFixed(0).padStart(5)}ms`);

async function main() {
  const token = await girisYap();
  console.log(
    `${USERS} eşzamanlı kullanıcı, ${THINK} sn düşünme, ` +
      `${STAGGER} sn devreye alma, ${SECONDS} saniye, hedef ${BASE}\n`,
  );

  const bitis = performance.now() + SECONDS * 1000;
  const baslangic = performance.now();
  await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      sanalKullanici(token, bitis, (i / USERS) * STAGGER * 1000),
    ),
  );
  const gecen = (performance.now() - baslangic) / 1000;

  const hepsi = [...olcumler.values()].flat();
  console.log("uç nokta        istek      p50      p95      p99");
  console.log("─".repeat(52));
  for (const [ad, sureler] of olcumler) {
    if (!sureler.length) continue;
    console.log(
      `${ad.padEnd(14)} ${String(sureler.length).padStart(5)}  ` +
        `${ms(yuzdelik(sureler, 50))} ${ms(yuzdelik(sureler, 95))} ${ms(yuzdelik(sureler, 99))}`,
    );
  }
  console.log("─".repeat(52));
  console.log(
    `TOPLAM         ${String(toplam).padStart(5)}  ` +
      `${ms(yuzdelik(hepsi, 50))} ${ms(yuzdelik(hepsi, 95))} ${ms(yuzdelik(hepsi, 99))}`,
  );
  console.log(
    `\n${(toplam / gecen).toFixed(1)} istek/sn · hata: ${hata} (%${((hata / toplam) * 100).toFixed(1)})`,
  );
  if (hatalar.size) {
    const dokum = [...hatalar].map(([k, v]) => `${k}: ${v}`).join(", ");
    console.log(`hata dökümü → ${dokum}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
