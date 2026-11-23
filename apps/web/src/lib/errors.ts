import type { ZodError } from 'zod';

/** Zod hatalarını backend'in döndüğü biçime çevirir: { "questions.0.text": "mesaj" } */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}
