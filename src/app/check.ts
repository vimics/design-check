/**
 * Folds a typed name so small differences don't block a DVM: case, extra spaces, accents and
 * the Turkish dotted and dotless i. "Dr." in front and "DVM" after are ignored too.
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^dr\.?\s+/, '')
    .replace(/,?\s*dvm\.?$/, '')
    .trim();
}

export function matches(typed: { dvm: string; patient: string }, expected: { dvm: string; patient: string }): boolean {
  return normalizeName(typed.dvm) === normalizeName(expected.dvm) && normalizeName(typed.patient) === normalizeName(expected.patient);
}
