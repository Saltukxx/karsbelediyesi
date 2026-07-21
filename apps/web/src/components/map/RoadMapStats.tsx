import { format, startOfMonth, subMonths } from "date-fns";
import { tr } from "date-fns/locale";
import { cardCls } from "@/lib/ui";
import { formatLength, roadLengthMeters } from "@/components/map/road-map-geo";
import {
  HAZARD_TIP_LABELS,
  type ComplaintPinDto,
  type HazardDto,
  type HazardTipDto,
  type RoadDto,
} from "@/components/map/road-map-types";

const DURUM_RENK = {
  TAMAMLANDI: "#16a34a",
  DEVAM_EDIYOR: "#f59e0b",
  PLANLANDI: "#64748b",
} as const;

const TIP_RENK: Record<HazardTipDto, string> = {
  CUKUR: "#dc2626",
  ENGEL: "#ea580c",
  DIGER: "#7c3aed",
};

/** Donut grafiği — SVG stroke-dasharray ile */
function Donut({
  segments,
  centerTitle,
  centerSub,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  centerTitle: string;
  centerSub: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" className="h-40 w-40">
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--kb-border)" strokeWidth="14" />
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => {
            const frac = s.value / total;
            const dash = frac * C;
            const el = (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              >
                <title>{`${s.label}: ${Math.round(frac * 100)}%`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
      <text
        x="60"
        y="57"
        textAnchor="middle"
        className="fill-kb-navy"
        style={{ fontSize: 17, fontWeight: 700 }}
      >
        {centerTitle}
      </text>
      <text
        x="60"
        y="72"
        textAnchor="middle"
        className="fill-kb-muted"
        style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.05em" }}
      >
        {centerSub}
      </text>
    </svg>
  );
}

/** Son 12 ay çubuk grafiği */
function MonthlyBars({ data }: { data: Array<{ label: string; meters: number }> }) {
  const max = Math.max(...data.map((d) => d.meters), 1);
  const W = 300;
  const H = 130;
  const chartH = 96;
  const gap = 6;
  const barW = (W - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="asfaltBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a4a73" />
          <stop offset="100%" stopColor="#1e3a5f" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const h = d.meters > 0 ? Math.max((d.meters / max) * chartH, 3) : 2;
        const x = i * (barW + gap);
        const y = 8 + chartH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={d.meters > 0 ? "url(#asfaltBar)" : "var(--kb-border)"}
            >
              <title>{`${d.label}: ${formatLength(d.meters)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-kb-muted"
              style={{ fontSize: 7.5, fontWeight: 600 }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RatioBar({
  left,
  right,
  leftColor,
  rightColor,
}: {
  left: { label: string; value: number };
  right: { label: string; value: number };
  leftColor: string;
  rightColor: string;
}) {
  const total = left.value + right.value;
  const pct = total > 0 ? (left.value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-kb-ink">
        <span>
          {left.label}: <b>{left.value}</b>
        </span>
        <span>
          {right.label}: <b>{right.value}</b>
        </span>
      </div>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-kb-border">
        {total > 0 && (
          <>
            <div style={{ width: `${pct}%`, background: leftColor }} />
            <div style={{ width: `${100 - pct}%`, background: rightColor }} />
          </>
        )}
      </div>
    </div>
  );
}

export default function RoadMapStats({
  roads,
  hazards,
  complaints,
}: {
  roads: RoadDto[];
  hazards: HazardDto[];
  complaints: ComplaintPinDto[];
}) {
  const lengths = roads.map((r) => ({
    road: r,
    meters: roadLengthMeters(r.koordinatlar),
  }));
  const toplamM = lengths.reduce((s, x) => s + x.meters, 0);
  const kmByDurum = (durum: RoadDto["durum"]) =>
    lengths.filter((x) => x.road.durum === durum).reduce((s, x) => s + x.meters, 0);

  const tamamlananM = kmByDurum("TAMAMLANDI");
  const devamM = kmByDurum("DEVAM_EDIYOR");
  const planlananM = kmByDurum("PLANLANDI");

  const acikEngel = hazards.filter((h) => h.durum === "ACIK").length;
  const giderilen = hazards.length - acikEngel;
  const acikSikayet = complaints.filter(
    (c) => c.durumKodu === "ACIK" || c.durumKodu === "DEVAM_EDIYOR",
  ).length;

  // Son 12 ay: dokumTarihi (yoksa createdAt) ayına göre uzunluk toplamı
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(now, 11 - i)));
  const monthly = months.map((m) => {
    const key = format(m, "yyyy-MM");
    const meters = lengths
      .filter(
        (x) => format(new Date(x.road.dokumTarihi ?? x.road.createdAt), "yyyy-MM") === key,
      )
      .reduce((s, x) => s + x.meters, 0);
    return { label: format(m, "MMM", { locale: tr }), meters };
  });

  const tipCounts = (Object.keys(HAZARD_TIP_LABELS) as HazardTipDto[]).map((tip) => ({
    tip,
    count: hazards.filter((h) => h.tip === tip).length,
  }));
  const maxTip = Math.max(...tipCounts.map((t) => t.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div className="relative overflow-hidden rounded-lg border border-kb-navy-deep bg-gradient-to-br from-kb-navy-soft to-kb-navy-deep p-4 shadow-sm">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/70">
            Toplam Asfalt
          </div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-white">
            {formatLength(toplamM)}
          </div>
          <div className="mt-1 text-xs text-white/70">{roads.length} yol kaydı</div>
        </div>

        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
            Tamamlanan
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-kb-success">
            {formatLength(tamamlananM)}
          </div>
          <div className="mt-1 text-xs text-kb-muted">
            {roads.filter((r) => r.durum === "TAMAMLANDI").length} yol
          </div>
        </div>

        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
            Devam Eden + Planlı
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-kb-warning">
            {formatLength(devamM + planlananM)}
          </div>
          <div className="mt-1 text-xs text-kb-muted">
            {roads.filter((r) => r.durum !== "TAMAMLANDI").length} yol
          </div>
        </div>

        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
            Açık Çukur / Engel
          </div>
          <div
            className={`mt-1.5 text-2xl font-semibold tabular-nums ${
              acikEngel > 0 ? "text-kb-danger" : "text-kb-success"
            }`}
          >
            {acikEngel}
          </div>
          <div className="mt-1 text-xs text-kb-muted">{giderilen} giderildi</div>
        </div>

        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
            Açık Şikayet
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-kb-navy">
            {acikSikayet}
          </div>
          <div className="mt-1 text-xs text-kb-muted">
            haritada {complaints.length} konumlu şikayet
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`${cardCls} p-4 lg:col-span-1`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Aylık Asfalt Üretimi (12 ay)
          </p>
          <div className="mt-3">
            <MonthlyBars data={monthly} />
          </div>
        </div>

        <div className={`${cardCls} flex items-center gap-4 p-4`}>
          <Donut
            segments={[
              { value: tamamlananM, color: DURUM_RENK.TAMAMLANDI, label: "Tamamlandı" },
              { value: devamM, color: DURUM_RENK.DEVAM_EDIYOR, label: "Devam Ediyor" },
              { value: planlananM, color: DURUM_RENK.PLANLANDI, label: "Planlandı" },
            ]}
            centerTitle={formatLength(toplamM)}
            centerSub="TOPLAM"
          />
          <div className="space-y-2 text-xs text-kb-ink">
            <p className="text-xs font-semibold uppercase tracking-wider text-kb-muted">
              Asfalt Durumu
            </p>
            <p>
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ background: DURUM_RENK.TAMAMLANDI }}
              />
              Tamamlandı — {formatLength(tamamlananM)}
            </p>
            <p>
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ background: DURUM_RENK.DEVAM_EDIYOR }}
              />
              Devam ediyor — {formatLength(devamM)}
            </p>
            <p>
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ background: DURUM_RENK.PLANLANDI }}
              />
              Planlandı — {formatLength(planlananM)}
            </p>
          </div>
        </div>

        <div className={`${cardCls} space-y-4 p-4`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Çukur / Engel &amp; Şikayet
          </p>
          <div className="space-y-2">
            {tipCounts.map((t) => (
              <div key={t.tip} className="flex items-center gap-2 text-xs text-kb-ink">
                <span className="w-12 shrink-0 font-medium">{HAZARD_TIP_LABELS[t.tip]}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-kb-border">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(t.count / maxTip) * 100}%`,
                      background: TIP_RENK[t.tip],
                    }}
                  />
                </div>
                <span className="w-6 text-right font-semibold tabular-nums">{t.count}</span>
              </div>
            ))}
          </div>
          <RatioBar
            left={{ label: "Açık", value: acikEngel }}
            right={{ label: "Giderildi", value: giderilen }}
            leftColor="#dc2626"
            rightColor="#16a34a"
          />
          <RatioBar
            left={{ label: "Açık şikayet", value: acikSikayet }}
            right={{ label: "Kapalı", value: complaints.length - acikSikayet }}
            leftColor="#2563eb"
            rightColor="#94a3b8"
          />
        </div>
      </div>
    </div>
  );
}
