// frontend/lib/utils.ts — minimal className combiner
// Dependency-free helper compatible with shadcn-style components.
// Keeps bundle small and avoids clsx/tailwind-merge.

export function cn(
  ...classes: Array<string | number | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
