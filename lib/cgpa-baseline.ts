export type CgpaBaseline = {
  cgpa: number;
  completedCredits: number;
};

export const CGPA_BASELINE_STORAGE_KEY = "eduniq_cgpa_baseline";

export function getCgpaBaselineStorageKey(userId: string | null | undefined): string {
  if (userId) return `${CGPA_BASELINE_STORAGE_KEY}_${userId}`;
  return `${CGPA_BASELINE_STORAGE_KEY}_guest`;
}

export function isValidCgpaBaseline(value: unknown): value is CgpaBaseline {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const cgpa = record.cgpa;
  const completedCredits = record.completedCredits;
  return (
    typeof cgpa === "number" &&
    !Number.isNaN(cgpa) &&
    cgpa >= 0 &&
    cgpa <= 4.33 &&
    typeof completedCredits === "number" &&
    !Number.isNaN(completedCredits) &&
    completedCredits > 0
  );
}

export function loadCgpaBaseline(userId: string | null | undefined): CgpaBaseline | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getCgpaBaselineStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidCgpaBaseline(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCgpaBaseline(
  baseline: CgpaBaseline | null,
  userId: string | null | undefined,
): void {
  if (typeof window === "undefined") return;
  const key = getCgpaBaselineStorageKey(userId);
  try {
    if (!baseline) {
      localStorage.removeItem(key);
      return;
    }
    if (!isValidCgpaBaseline(baseline)) return;
    localStorage.setItem(key, JSON.stringify(baseline));
  } catch {
    // Ignore quota / private-mode errors.
  }
}
