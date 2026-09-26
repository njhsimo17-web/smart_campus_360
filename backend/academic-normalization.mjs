export function cleanAcademicValue(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function normalizeAcademicValue(value) {
  return cleanAcademicValue(value).toLocaleLowerCase("en").normalize("NFC");
}

export function academicValuesMatch(left, right) {
  const normalizedLeft = normalizeAcademicValue(left);
  return normalizedLeft !== "" && normalizedLeft === normalizeAcademicValue(right);
}

export function hasCompleteSessionAcademics(session) {
  if (!session) return false;
  const { department, program, level } = session;
  return [department, program, level].every(value => cleanAcademicValue(value) !== "")
    && academicValuesMatch(session.filiere, program)
    && academicValuesMatch(session.niveau, level);
}

export function isStudentEligibleForSession(student, session) {
  return hasCompleteSessionAcademics(session)
    && academicValuesMatch(student?.department, session.department)
    && academicValuesMatch(student?.program, session.program)
    && academicValuesMatch(student?.level, session.level);
}
