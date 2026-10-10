/** Only typographic differences in the entire answer may override an AI verdict. */
export function validateAndOverrideGrading(student: unknown, correct: unknown): boolean {
  if (typeof student !== 'string' || typeof correct !== 'string') return false
  const normalizedStudent = student.normalize('NFKC').trim()
  const normalizedCorrect = correct.normalize('NFKC').trim()
  return normalizedStudent.length > 0 && normalizedStudent === normalizedCorrect
}
