export type CsvRow = Record<string, string>;

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pushRow(rows: string[][], row: string[]) {
  if (row.length === 1 && row[0] === "") return;
  if (!row.some((cell) => cell.trim() !== "")) return;
  rows.push(row);
}

export function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (inQuotes) {
      if (char === "\"") {
        if (clean[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      pushRow(rows, row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  pushRow(rows, row);

  if (!rows.length) return [];

  const headers = rows.shift()!.map(normalizeHeader);

  return rows.map((values) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    return record;
  });
}

export function getCsvValue(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

export function parseCsvBoolean(value: string) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

export function parseCsvNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
