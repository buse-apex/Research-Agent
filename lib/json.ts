// Shared JSON extraction/repair helpers (used by the meetings quick-check).

export function extractJson(text: string): string {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

// Escape raw control characters that appear inside string literals.
export function sanitizeJson(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        out += ch;
        esc = false;
      } else if (ch === "\\") {
        out += ch;
        esc = true;
      } else if (ch === '"') {
        out += ch;
        inStr = false;
      } else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else out += ch;
    } else {
      out += ch;
      if (ch === '"') inStr = true;
    }
  }
  return out;
}

export function tryParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
