import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { getAccountDetail, getPercentile, getProfileSnapshot } from "@/lib/db";
import { BADGE_COLOR, TIER_EN, TIER_LABEL_EN } from "@/lib/badge";
import { beatPercent } from "@/lib/percentile";
import { SITE_URL } from "@/lib/site";
import type { Tier } from "@/lib/types";
import {
  Brand,
  H,
  OgAvatarFrame,
  PALETTES,
  Shell,
  W,
  parseQr,
  parseTheme,
  parseVariant,
  renderVariant,
  variantHasData,
} from "./cards";
import type { Identity } from "./cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// Long edge cache: GitHub README views are served by the CDN (and camo) — the
// PNG is generated at most ~once per window per account. Keeps the bill flat.
const CDN_CACHE = "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400";

// Module-cache the (tiny, ~30KB each) Latin fonts across warm invocations.
let fontCache: { name: string; data: Buffer; weight: 400 | 800; style: "normal" }[] | null = null;
async function fonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    readFile(new URL("./fonts/Inter-Regular.woff", import.meta.url)),
    readFile(new URL("./fonts/Inter-ExtraBold.woff", import.meta.url)),
  ]);
  fontCache = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 800, style: "normal" },
  ];
  return fontCache;
}

/** Pre-fetch the avatar to a data URL so a flaky fetch can't break rendering. */
async function avatarDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Tier-tinted QR module color that contrasts with the (transparent) card behind
 * it: blend the tier hue toward white on dark cards, toward black on light cards.
 * Keeps the rank's color while staying scannable on either theme. */
function qrModuleColor(hex: string, mode: "dark" | "light"): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return mode === "dark" ? "#ffffff" : "#000000";
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = mode === "dark" ? 255 : 0;
  const f = mode === "dark" ? 0.55 : 0.3;
  const out = ch.map((c) => Math.round(c * (1 - f) + target * f));
  return `#${((1 << 24) | (out[0] << 16) | (out[1] << 8) | out[2]).toString(16).slice(1)}`;
}

/** QR of the profile page as a PNG data URL, or null on failure. Transparent
 * background (`light: #00000000`) so the card shows through; `dark` is the
 * tier-tinted module color. "M" keeps the matrix small so modules stay chunky
 * and scannable at the card's corner size. */
async function qrDataUrl(username: string, dark: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(`${SITE_URL}/u/${username}`, {
      margin: 1,
      width: 300,
      errorCorrectionLevel: "M",
      color: { dark, light: "#00000000" },
    });
  } catch {
    return null;
  }
}

function png(element: React.ReactElement, fontList: Awaited<ReturnType<typeof fonts>>) {
  return new ImageResponse(element, {
    width: W,
    height: H,
    fonts: fontList,
    emoji: "twemoji",
    headers: { "Cache-Control": CDN_CACHE },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const fontList = await fonts();
  const theme = parseTheme(req);
  const palette = PALETTES[theme];
  const { username } = await ctx.params;
  const name = decodeURIComponent(username ?? "").trim();

  const detail = USERNAME_RE.test(name) ? await getAccountDetail(name) : null;

  // Unrated placeholder — keeps READMEs from showing a broken image.
  if (!detail) {
    return png(
      <Shell glow="rgba(148,163,184,0.25)" palette={palette}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
          @{name || "unknown"}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: palette.muted }}>
            Not yet rated
          </div>
          <div style={{ display: "flex", fontSize: 26, color: palette.subtle, marginTop: 8 }}>
            Get roasted at ghfind.com
          </div>
        </div>
        <Brand palette={palette} />
      </Shell>,
      fontList,
    );
  }

  const tier = detail.tier as Tier;
  const color = BADGE_COLOR[tier];
  const counts = await getPercentile(detail.final_score);
  const beat = counts ? beatPercent(counts.below, counts.total) : null;
  const avatar = await avatarDataUrl(detail.avatar_url);
  const displayName =
    detail.display_name && /^[\x20-\x7e]+$/.test(detail.display_name) ? detail.display_name : null;
  const tags = (detail.tags.en ?? []).slice(0, 4);

  const qr = parseQr(req) ? await qrDataUrl(detail.username, qrModuleColor(color, theme)) : null;
  const id: Identity = { username: detail.username, displayName, avatar, tier, color, palette, qr };

  // Specialty "brag cards" read the sedimented profile snapshot. If it's missing
  // or lacks the data this card needs (low-tier accounts are never backfilled),
  // fall through to the always-available score card so an embed never breaks.
  const variant = parseVariant(req);
  if (variant !== "score") {
    const snap = await getProfileSnapshot(detail.username);
    if (variantHasData(variant, snap) && snap) {
      return png(renderVariant(variant, id, snap), fontList);
    }
  }

  return png(
    <Shell glow={`${color}${theme === "light" ? "30" : "55"}`} palette={palette} qr={qr}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            borderRadius: 9999,
            backgroundColor: palette.handleBg,
            border: `2px solid ${color}80`,
            boxShadow: `0 0 34px -12px ${color}`,
            color,
            fontSize: 38,
            fontWeight: 800,
            padding: "8px 26px",
          }}
        >
          @{detail.username}
        </div>
        {displayName && (
          <div style={{ display: "flex", marginTop: 8, fontSize: 22, color: palette.muted }}>
            {displayName}
          </div>
        )}
        <div style={{ display: "flex", marginTop: 18 }}>
          <OgAvatarFrame
            username={detail.username}
            avatar={avatar}
            tier={tier}
            color={color}
            palette={palette}
          />
        </div>
      </div>

      {/* Score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: 116, fontWeight: 800, color, lineHeight: 1 }}>
              {detail.final_score.toFixed(2)}
            </span>
            <span style={{ fontSize: 40, color: palette.weak, marginLeft: 8, marginBottom: 10 }}>
              /100
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color, marginTop: 8 }}>
            {TIER_EN[tier]}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: palette.muted, marginTop: 2 }}>
            {TIER_LABEL_EN[tier]}
          </div>
        </div>
        {beat !== null && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 64, fontWeight: 800, color }}>{beat.toFixed(1)}%</span>
            <span style={{ fontSize: 22, color: palette.muted }}>ahead of devs</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {tags.map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                marginRight: 12,
                marginTop: 8,
                padding: "6px 18px",
                borderRadius: 9999,
                border: `1px solid ${palette.tagBorder}`,
                backgroundColor: palette.tagBg,
                color: palette.tagText,
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              #{t}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}

      <Brand palette={palette} />
    </Shell>,
    fontList,
  );
}
