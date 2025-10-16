export async function getSession() {
  // With purely client-side cookies, we don’t have server access to them here.
  // In production, prefer a middleware or RSC fetch with cookies pass-through.
  return { ok: false } as const;
}
