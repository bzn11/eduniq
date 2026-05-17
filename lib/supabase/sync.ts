/**
 * Optional silent fallback writes. Primary persistence is in academic-write.ts
 * and invoked await-first from CourseContext.
 */
import type { Assignment } from "@/lib/assignments";
import type { Course } from "@/lib/courses";
import type { Term } from "@/lib/terms";
import {
  canPersistAcademicData,
  deleteAssignment as deleteAssignmentRecord,
  deleteCourse as deleteCourseRecord,
  persistAssignment,
  persistCourse,
} from "@/lib/supabase/academic-write";

type SyncRuntime = {
  userId: string | null;
  getTerms: () => Term[];
};

let syncRuntime: SyncRuntime = {
  userId: null,
  getTerms: () => [],
};

export function configureAcademicSync(
  userId: string | null,
  getTerms: () => Term[],
): void {
  syncRuntime = { userId, getTerms };
}

function runSilent(task: () => void | Promise<void>): void {
  void Promise.resolve(task()).catch(() => {});
}

function findTermForCourse(terms: Term[], courseId: string): Term | undefined {
  return terms.find((term) => term.courses.some((course) => course.id === courseId));
}

/** @deprecated Use await persistCourse from academic-write.ts */
export function syncCourseToSupabase(course: Course, termId?: string): void {
  const userId = syncRuntime.userId;
  if (!canPersistAcademicData(userId)) return;

  const terms = syncRuntime.getTerms();
  const term = termId
    ? terms.find((entry) => entry.id === termId)
    : findTermForCourse(terms, course.id);
  if (!term || !userId) return;

  runSilent(() => {
    void persistCourse(userId, term, course);
  });
}

/** @deprecated Use await persistAssignment from academic-write.ts */
export function syncAssignmentToSupabase(
  assignment: Assignment,
  courseId?: string,
): void {
  const userId = syncRuntime.userId;
  if (!canPersistAcademicData(userId) || !courseId) return;

  const term = findTermForCourse(syncRuntime.getTerms(), courseId);
  const course = term?.courses.find((entry) => entry.id === courseId);
  if (!term || !course || !userId) return;

  runSilent(() => {
    void persistAssignment(userId, course, assignment);
  });
}

/** @deprecated Use await deleteCourse from academic-write.ts */
export function deleteCourseFromSupabase(id: string): void {
  const userId = syncRuntime.userId;
  if (!canPersistAcademicData(userId) || !userId) return;
  runSilent(() => {
    void deleteCourseRecord(userId, id);
  });
}

/** @deprecated Use await deleteAssignment from academic-write.ts */
export function deleteAssignmentFromSupabase(id: string): void {
  const userId = syncRuntime.userId;
  if (!canPersistAcademicData(userId) || !userId) return;
  runSilent(() => {
    void deleteAssignmentRecord(userId, id);
  });
}
