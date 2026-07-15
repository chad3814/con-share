export const SHOW_NSFW_COOKIE = "show_nsfw";

export function showNsfwFromCookie(value: string | undefined): boolean {
  return value === "1";
}
