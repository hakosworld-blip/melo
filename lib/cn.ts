export function cn(...inputs: (string | false | null | undefined | 0)[]) {
  return inputs.filter(Boolean).join(" ");
}
