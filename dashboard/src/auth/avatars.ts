export const AVATARS = [
  { key: null, label: "Default" },
  { key: "avatar-cat", label: "Cat" },
  { key: "avatar-dog", label: "Dog" },
  { key: "avatar-fox", label: "Fox" },
  { key: "avatar-panda", label: "Panda" },
  { key: "avatar-robot", label: "Robot" },
] as const;

export type AvatarKey = Exclude<(typeof AVATARS)[number]["key"], null>;

export function isAvatarKey(v: unknown): v is AvatarKey {
  return typeof v === "string" && AVATARS.some((a) => a.key === v);
}
