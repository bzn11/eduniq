import { sanitizeTermsDataset } from "@/lib/academic-storage";
import { isValidCourseCredits, isValidTermTargetGpa, type TargetType } from "@/lib/courses";
import type { Assignment } from "@/lib/assignments";
import { getDefaultScale } from "@/lib/grading";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ensureSingleActiveTerm, type Term } from "@/lib/terms";

type DbTerm = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  target_gpa: number | string | null;
};

type DbCourse = {
  id: string;
  term_id: string;
  name: string;
  credits: number | string;
  target_letter: string | null;
  target_gpa: number | string | null;
};

type DbAssignment = {
  id: string;
  course_id: string;
  name: string;
  weight: number | string;
  earned_points: number | string | null;
  total_points: number | string | null;
};

export type AcademicFetchResult =
  | { ok: true; terms: Term[] }
  | { ok: false };

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDbAssignment(row: DbAssignment): Assignment | null {
  const weight = toNumber(row.weight);
  if (weight === null || weight <= 0 || weight > 100) return null;
  if (!row.id || !row.course_id || !row.name?.trim()) return null;

  const earned = toNumber(row.earned_points);
  const total = toNumber(row.total_points);

  const assignment: Assignment = {
    id: row.id,
    name: row.name.trim(),
    weight,
  };

  if (earned !== null && total !== null && total > 0) {
    assignment.earnedPoints = earned;
    assignment.totalPoints = total;
  }

  return assignment;
}

type CourseSeed = {
  id: string;
  name: string;
  credits: number;
  targetType: TargetType;
  targetLetter: string | null;
  targetGpa: number | null;
  targetPercentage: number | null;
  assignments: Assignment[];
};

function parseDbCourse(
  row: DbCourse,
  assignmentsByCourse: Map<string, Assignment[]>,
): CourseSeed | null {
  const credits = toNumber(row.credits);
  if (!row.id || !row.term_id || !row.name?.trim()) return null;
  if (credits === null || !isValidCourseCredits(credits)) return null;

  const targetGpa = toNumber(row.target_gpa);
  const targetLetter = row.target_letter?.trim() || null;
  const hasTarget = targetGpa !== null && Boolean(targetLetter);

  return {
    id: row.id,
    name: row.name.trim(),
    credits,
    targetType: "gpa",
    targetLetter: hasTarget ? targetLetter : null,
    targetGpa: hasTarget ? targetGpa : null,
    targetPercentage: null,
    assignments: assignmentsByCourse.get(row.id) ?? [],
  };
}

function parseDbTerm(
  row: DbTerm,
  coursesByTerm: Map<string, CourseSeed[]>,
): Term | null {
  if (!row.id || !row.name?.trim()) return null;

  const termTargetGpa = toNumber(row.target_gpa);
  const normalizedTarget =
    termTargetGpa !== null && isValidTermTargetGpa(termTargetGpa)
      ? termTargetGpa
      : null;

  return {
    id: row.id,
    name: row.name.trim(),
    isActive: row.is_active === true,
    courses: (coursesByTerm.get(row.id) ?? []) as Term["courses"],
    termTargetGpa: normalizedTarget,
  };
}

function assembleTerms(
  dbTerms: DbTerm[],
  dbCourses: DbCourse[],
  dbAssignments: DbAssignment[],
): Term[] {
  const assignmentsByCourse = new Map<string, Assignment[]>();

  const seenAssignmentIds = new Set<string>();

  for (const row of dbAssignments) {
    if (seenAssignmentIds.has(row.id)) continue;
    const assignment = parseDbAssignment(row);
    if (!assignment) continue;
    seenAssignmentIds.add(row.id);
    const list = assignmentsByCourse.get(row.course_id) ?? [];
    list.push(assignment);
    assignmentsByCourse.set(row.course_id, list);
  }

  const validTermIds = new Set(dbTerms.map((term) => term.id));
  const coursesByTerm = new Map<string, CourseSeed[]>();

  const seenCourseIds = new Set<string>();

  for (const row of dbCourses) {
    if (!validTermIds.has(row.term_id)) continue;
    if (seenCourseIds.has(row.id)) continue;
    const course = parseDbCourse(row, assignmentsByCourse);
    if (!course) continue;
    seenCourseIds.add(row.id);
    const list = coursesByTerm.get(row.term_id) ?? [];
    list.push(course);
    coursesByTerm.set(row.term_id, list);
  }

  const terms: Term[] = [];
  for (const row of dbTerms) {
    const seeds = coursesByTerm.get(row.id) ?? [];
    const term = parseDbTerm(row, new Map([[row.id, seeds]]));
    if (term) terms.push(term);
  }

  if (terms.length === 0) return [];
  return ensureSingleActiveTerm(terms);
}

export async function fetchTerms(userId: string): Promise<DbTerm[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("terms")
    .select("id, user_id, name, is_active, target_gpa")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data as DbTerm[];
}

async function fetchCoursesForTermIds(termIds: string[]): Promise<DbCourse[]> {
  if (!isSupabaseConfigured() || termIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, term_id, name, credits, target_letter, target_gpa")
    .in("term_id", termIds);

  if (error || !data) return [];
  return data as DbCourse[];
}

async function fetchAssignmentsForCourseIds(courseIds: string[]): Promise<DbAssignment[]> {
  if (!isSupabaseConfigured() || courseIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, course_id, name, weight, earned_points, total_points")
    .in("course_id", courseIds);

  if (error || !data) return [];
  return data as DbAssignment[];
}

export async function fetchCourses(userId: string): Promise<DbCourse[]> {
  const dbTerms = await fetchTerms(userId);
  return fetchCoursesForTermIds(dbTerms.map((term) => term.id));
}

export async function fetchAssignments(userId: string): Promise<DbAssignment[]> {
  const dbCourses = await fetchCourses(userId);
  return fetchAssignmentsForCourseIds(dbCourses.map((course) => course.id));
}

export async function fetchFullAcademicState(userId: string): Promise<AcademicFetchResult> {
  if (!isSupabaseConfigured() || !userId) {
    return { ok: false };
  }

  try {
    const dbTerms = await fetchTerms(userId);
    if (dbTerms.length === 0) {
      return { ok: true, terms: [] };
    }

    const termIds = dbTerms.map((term) => term.id);
    const dbCourses = await fetchCoursesForTermIds(termIds);
    const dbAssignments = await fetchAssignmentsForCourseIds(
      dbCourses.map((course) => course.id),
    );

    const assembled = assembleTerms(dbTerms, dbCourses, dbAssignments);
    const terms = sanitizeTermsDataset(assembled, getDefaultScale());
    if (!terms) {
      return { ok: false };
    }

    return { ok: true, terms };
  } catch {
    return { ok: false };
  }
}
