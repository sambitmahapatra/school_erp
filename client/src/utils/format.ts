export type ClassLabelInput = {
  name: string;
  grade?: number | null;
  section?: string | null;
};

export function formatClassLabel(input: ClassLabelInput) {
  const parts: string[] = [];
  if (input.grade) {
    parts.push(`Grade ${input.grade}`);
  }
  if (input.name) {
    parts.push(input.name);
  }
  if (input.section) {
    parts.push(String(input.section).toUpperCase());
  }
  return parts.join(" ").trim();
}
