// 6 preset "cute" avatars - a gradient-circle background with a centered
// emoji, rendered purely with the Canvas API (no external images, so no
// copyright/licensing concerns, and no extra asset files to ship).
export const AVATAR_PRESETS = [
  { id: "fox",     emoji: "🦊", from: "#f97316", to: "#ef4444" }, // orange -> red
  { id: "cat",     emoji: "🐱", from: "#a855f7", to: "#ec4899" }, // purple -> pink
  { id: "panda",   emoji: "🐼", from: "#64748b", to: "#3b82f6" }, // slate -> blue
  { id: "lion",    emoji: "🦁", from: "#f59e0b", to: "#eab308" }, // amber -> yellow
  { id: "penguin", emoji: "🐧", from: "#06b6d4", to: "#3b82f6" }, // cyan -> blue
  { id: "rabbit",  emoji: "🐰", from: "#f472b6", to: "#fb7185" }, // pink -> rose
];

export const DEFAULT_AVATAR_PRESET = AVATAR_PRESETS[0];

export function getAvatarPreset(id) {
  return AVATAR_PRESETS.find((p) => p.id === id) || DEFAULT_AVATAR_PRESET;
}

// Renders a preset to a square PNG data URL by drawing on an offscreen
// canvas - a gradient-filled circle with the emoji centered on top.
// Used so a chosen preset can be stored exactly like an uploaded photo
// (as a data URL in Firebase Auth's photoURL field) with zero changes
// needed anywhere else the app already displays currentUser.photoURL.
export function renderAvatarDataUrl(presetId, size = 150) {
  const preset = getAvatarPreset(presetId);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, preset.from);
  gradient.addColorStop(1, preset.to);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.font = `${Math.round(size * 0.58)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Small manual nudge - emoji glyphs tend to sit slightly high of true
  // vertical-center in most system fonts.
  ctx.fillText(preset.emoji, size / 2, size / 2 + size * 0.04);

  return canvas.toDataURL("image/png");
}
