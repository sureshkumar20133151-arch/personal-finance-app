import React from "react";
import { DEFAULT_AVATAR_PRESET } from "../lib/avatars";

// Nicer placeholder than a plain initial letter for users who haven't
// uploaded a photo or picked a preset avatar yet. Purely visual (CSS
// gradient + emoji) - doesn't touch Firebase Auth/Firestore, so it costs
// nothing and needs no migration for existing users.
export default function AvatarFallback({ className = "" }) {
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(135deg, ${DEFAULT_AVATAR_PRESET.from}, ${DEFAULT_AVATAR_PRESET.to})`,
      }}
    >
      <span style={{ fontSize: "55%", lineHeight: 1 }}>{DEFAULT_AVATAR_PRESET.emoji}</span>
    </div>
  );
}
