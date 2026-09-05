export const Colors = {
  background: "#0D1117",
  card: "#161B22",
  border: "#30363D",
  text: "#E6EDF3",
  textMuted: "#8B949E",
  accent: "#58A6FF",
  green: "#3FB950",
  red: "#F85149",
  yellow: "#D29922",
};

// Design system (docs/UX_REDESIGN.md, anexo B)
export const Palette = {
  text: "#ECF2F8",
  textSecondary: "#9BA8B5",
  surface: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.08)",
  stale: "#D29922",
};

export type AmbientGradient = {
  top: string;
  bottom: string;
  accent: string;
};

// Anclas térmicas: [temp, parada superior, parada inferior, acento].
// Entre anclas se interpola linealmente; fuera de rango se clampea.
const THERMAL_ANCHORS: Array<[number, string, string, string]> = [
  [-5, "#0A0F1E", "#1E3A5F", "#7EB6E8"],
  [5, "#0B111C", "#1F4A66", "#6FB1D8"],
  [14, "#0C1319", "#1E5252", "#6FCFC3"],
  [21, "#10131A", "#33503F", "#8FD694"],
  [27, "#14100E", "#6B4226", "#F0B269"],
  [32, "#170D0A", "#7A3B24", "#F08C5A"],
];

// Sin dato / stale: el color "se apaga", no cambia de matiz.
export const STALE_GRADIENT: AmbientGradient = {
  top: "#101216",
  bottom: "#242830",
  accent: "#9BA8B5",
};

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 0xff;
    const vb = (pb >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  return (
    "#" +
    ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")
  );
}

export function gradientForTemp(temp: number | null): AmbientGradient {
  if (temp == null) return STALE_GRADIENT;
  const anchors = THERMAL_ANCHORS;
  if (temp <= anchors[0][0]) {
    const [, top, bottom, accent] = anchors[0];
    return { top, bottom, accent };
  }
  const last = anchors[anchors.length - 1];
  if (temp >= last[0]) {
    const [, top, bottom, accent] = last;
    return { top, bottom, accent };
  }
  let i = 0;
  while (temp > anchors[i + 1][0]) i++;
  const [t0, top0, bot0, acc0] = anchors[i];
  const [t1, top1, bot1, acc1] = anchors[i + 1];
  const f = (temp - t0) / (t1 - t0);
  return {
    top: lerpHex(top0, top1, f),
    bottom: lerpHex(bot0, bot1, f),
    accent: lerpHex(acc0, acc1, f),
  };
}
