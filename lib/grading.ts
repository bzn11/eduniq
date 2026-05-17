export type GradeBand = {
  min: number;
  max: number;
  letter: string | null;
  gpa: number | null;
};

export type GradeScale = {
  id: string;
  name: string;
  bands: GradeBand[];
};

export type GradeInfo = {
  roundedPercentage: number;
  letterGrade: string | null;
  gpaValue: number | null;
};

const STANDARD_40_BANDS: GradeBand[] = [
  { min: 90, max: 100, letter: "A+", gpa: 4.0 },
  { min: 85, max: 89, letter: "A", gpa: 4.0 },
  { min: 80, max: 84, letter: "A-", gpa: 3.7 },
  { min: 77, max: 79, letter: "B+", gpa: 3.3 },
  { min: 73, max: 76, letter: "B", gpa: 3.0 },
  { min: 70, max: 72, letter: "B-", gpa: 2.7 },
  { min: 67, max: 69, letter: "C+", gpa: 2.3 },
  { min: 63, max: 66, letter: "C", gpa: 2.0 },
  { min: 60, max: 62, letter: "C-", gpa: 1.7 },
  { min: 57, max: 59, letter: "D+", gpa: 1.3 },
  { min: 53, max: 56, letter: "D", gpa: 1.0 },
  { min: 50, max: 52, letter: "D-", gpa: 0.7 },
  { min: 0, max: 49, letter: "F", gpa: 0.0 },
];

function cloneBands(bands: GradeBand[]): GradeBand[] {
  return bands.map((band) => ({ ...band }));
}

function withBandOverride(
  bands: GradeBand[],
  min: number,
  max: number,
  overrides: Partial<Pick<GradeBand, "letter" | "gpa">>,
): GradeBand[] {
  return bands.map((band) =>
    band.min === min && band.max === max ? { ...band, ...overrides } : band,
  );
}

export const STANDARD_40_SCALE: GradeScale = {
  id: "standard-40",
  name: "Standard 4.0 Scale (UofT-style)",
  bands: STANDARD_40_BANDS,
};

export const OMSAS_SCALE: GradeScale = {
  id: "omsas",
  name: "OMSAS Scale",
  bands: withBandOverride(cloneBands(STANDARD_40_BANDS), 85, 89, { gpa: 3.9 }),
};

export const SCALE_433: GradeScale = {
  id: "scale-433",
  name: "4.33 Scale",
  bands: withBandOverride(cloneBands(STANDARD_40_BANDS), 90, 100, { gpa: 4.33 }),
};

export const PERCENTAGE_ONLY_SCALE: GradeScale = {
  id: "percentage-only",
  name: "Percentage Only",
  bands: [],
};

export const ACTIVE_GRADE_SCALE: GradeScale = STANDARD_40_SCALE;

export function getDefaultScale(): GradeScale {
  return STANDARD_40_SCALE;
}

export function getGradeInfo(percentage: number, scale: GradeScale): GradeInfo {
  const roundedPercentage = Math.round(percentage);

  if (scale.id === PERCENTAGE_ONLY_SCALE.id || scale.bands.length === 0) {
    return {
      roundedPercentage,
      letterGrade: null,
      gpaValue: null,
    };
  }

  const band = scale.bands.find(
    (entry) =>
      roundedPercentage >= entry.min && roundedPercentage <= entry.max,
  );

  if (!band) {
    return {
      roundedPercentage,
      letterGrade: null,
      gpaValue: null,
    };
  }

  return {
    roundedPercentage,
    letterGrade: band.letter,
    gpaValue: band.gpa,
  };
}

export function formatProjection(
  letterGrade: string | null,
  percentage: number,
): string {
  const rounded = Math.round(percentage);
  if (!letterGrade) {
    return `proj. ${rounded}%`;
  }
  return `proj. ${letterGrade} · ${rounded}%`;
}

export function getScaleLetterOptions(scale: GradeScale): string[] {
  const letters: string[] = [];
  for (const band of scale.bands) {
    if (band.letter && !letters.includes(band.letter)) {
      letters.push(band.letter);
    }
  }
  return letters;
}

export function letterToMinPercent(
  letter: string,
  scale: GradeScale = ACTIVE_GRADE_SCALE,
): number {
  const band = scale.bands.find((entry) => entry.letter === letter);
  return band?.min ?? 0;
}

export function formatGradeSecondary(
  letterGrade: string | null,
  percentage: number,
  scale: GradeScale = ACTIVE_GRADE_SCALE,
): string | null {
  if (percentage === 0) return null;

  const projectedLetter = getGradeInfo(percentage, scale).letterGrade;

  if (!letterGrade && !projectedLetter) {
    return `proj. ${percentage.toFixed(1)}%`;
  }
  if (!letterGrade) {
    return projectedLetter ? `proj. ${projectedLetter}` : null;
  }
  if (!projectedLetter) {
    return letterGrade;
  }
  return `${letterGrade} · proj. ${projectedLetter}`;
}

export function formatLetterTarget(letter: string): string {
  return letter;
}

export type GpaTargetOption = {
  id: string;
  gpa: number;
  letter: string;
  label: string;
};

export function formatGpaTargetLabel(gpa: number, letter: string): string {
  return `${gpa.toFixed(1)} (${letter})`;
}

export function getGpaTargetOptions(
  scale: GradeScale = ACTIVE_GRADE_SCALE,
): GpaTargetOption[] {
  const seen = new Set<string>();
  const options: GpaTargetOption[] = [];

  for (const band of scale.bands) {
    if (!band.letter || band.gpa === null) continue;
    const id = `${band.gpa}|${band.letter}`;
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({
      id,
      gpa: band.gpa,
      letter: band.letter,
      label: formatGpaTargetLabel(band.gpa, band.letter),
    });
  }

  return options.sort((a, b) => b.gpa - a.gpa);
}

export function findGpaTargetOption(
  gpa: number,
  letter: string,
  scale: GradeScale = ACTIVE_GRADE_SCALE,
): GpaTargetOption | undefined {
  return getGpaTargetOptions(scale).find(
    (option) => option.gpa === gpa && option.letter === letter,
  );
}

export function parseGpaTargetOptionId(optionId: string): {
  gpa: number;
  letter: string;
} | null {
  const [gpaValue, letter] = optionId.split("|");
  const gpa = Number(gpaValue);
  if (!letter || Number.isNaN(gpa)) return null;
  return { gpa, letter };
}

export function formatCourseGradeMeta(
  letterGrade: string | null,
  percentage: number,
): string | null {
  if (percentage === 0) return null;
  if (!letterGrade) return `${percentage.toFixed(1)}%`;
  return `${letterGrade} · ${percentage.toFixed(1)}%`;
}
