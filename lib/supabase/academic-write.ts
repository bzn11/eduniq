import type { Assignment } from "@/lib/assignments";
import type { Course } from "@/lib/courses";
import type { Term } from "@/lib/terms";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canPersistAcademicData(userId: string | null | undefined): boolean {
  return Boolean(userId && isSupabaseConfigured());
}

async function resolveEntityId(userId: string, localOrUuidId: string): Promise<string> {
  if (UUID_PATTERN.test(localOrUuidId)) {
    return localOrUuidId;
  }
  const data = new TextEncoder().encode(`${userId}:${localOrUuidId}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function persistTerm(userId: string, term: Term): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;

  const supabase = createClient();
  const termUuid = await resolveEntityId(userId, term.id);
  const { error } = await supabase.from("terms").upsert(
    {
      id: termUuid,
      user_id: userId,
      name: term.name,
      is_active: term.isActive,
      target_gpa: term.termTargetGpa,
    },
    { onConflict: "id" },
  );

  return !error;
}

export async function persistAllTerms(userId: string, terms: Term[]): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;
  const results = await Promise.all(terms.map((term) => persistTerm(userId, term)));
  return results.every(Boolean);
}

export async function deleteTerm(userId: string, termId: string): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;

  const supabase = createClient();
  const termUuid = await resolveEntityId(userId, termId);
  const { error } = await supabase.from("terms").delete().eq("id", termUuid);
  return !error;
}

export async function persistCourse(
  userId: string,
  term: Term,
  course: Course,
): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;

  const termOk = await persistTerm(userId, term);
  if (!termOk) return false;

  const supabase = createClient();
  const termUuid = await resolveEntityId(userId, term.id);
  const courseUuid = await resolveEntityId(userId, course.id);

  const { error } = await supabase.from("courses").upsert(
    {
      id: courseUuid,
      term_id: termUuid,
      name: course.name,
      credits: course.credits,
      target_letter: course.targetLetter,
      target_gpa: course.targetGpa,
    },
    { onConflict: "id" },
  );

  if (error) return false;

  const assignmentResults = await Promise.all(
    course.assignments.map((assignment) =>
      persistAssignment(userId, course, assignment),
    ),
  );

  return assignmentResults.every(Boolean);
}

export async function deleteCourse(userId: string, courseId: string): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;

  const supabase = createClient();
  const courseUuid = await resolveEntityId(userId, courseId);
  const { error } = await supabase.from("courses").delete().eq("id", courseUuid);
  return !error;
}

export async function persistAssignment(
  userId: string,
  course: Course,
  assignment: Assignment,
): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;

  const supabase = createClient();
  const courseUuid = await resolveEntityId(userId, course.id);
  const assignmentUuid = await resolveEntityId(userId, assignment.id);

  const { error } = await supabase.from("assignments").upsert(
    {
      id: assignmentUuid,
      course_id: courseUuid,
      name: assignment.name,
      weight: assignment.weight,
      earned_points: assignment.earnedPoints ?? null,
      total_points: assignment.totalPoints ?? null,
    },
    { onConflict: "id" },
  );

  return !error;
}

export async function deleteAssignment(
  userId: string,
  assignmentId: string,
): Promise<boolean> {
  if (!canPersistAcademicData(userId)) return false;

  const supabase = createClient();
  const assignmentUuid = await resolveEntityId(userId, assignmentId);
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentUuid);
  return !error;
}
