export function cleanAcademicValue(value: unknown): string;
export function normalizeAcademicValue(value: unknown): string;
export function academicValuesMatch(left: unknown, right: unknown): boolean;
export function hasCompleteSessionAcademics(session: Record<string, unknown> | null | undefined): boolean;
export function isStudentEligibleForSession(
  student: Record<string, unknown> | null | undefined,
  session: Record<string, unknown> | null | undefined,
): boolean;
