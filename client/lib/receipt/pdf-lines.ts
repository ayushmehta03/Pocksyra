// Rebuilds readable lines from the positioned text fragments a PDF stores.
// Pure and import-free so it can be tested without pdf.js.

export type PdfTextItem = {
  str: string;
  /** left edge, PDF units */
  x: number;
  /** baseline, PDF units (larger = higher on the page) */
  y: number;
  width?: number;
};

export type PdfLine = { text: string };

/**
 * Groups fragments that sit on the same baseline into a line, ordered left to
 * right, and returns the lines top to bottom. A gap between two fragments
 * becomes a space, so "Subtotal" ........ "1510.00" stays on one line.
 */
export function groupTextItems(items: PdfTextItem[], tolerance = 3): PdfLine[] {
  const clean = items.filter((i) => i.str.trim().length > 0);
  clean.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: PdfTextItem[][] = [];
  for (const item of clean) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0]!.y - item.y) <= tolerance) row.push(item);
    else rows.push([item]);
  }

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd: number | null = null;
    for (const item of row) {
      const gap = prevEnd === null ? 0 : item.x - prevEnd;
      const needsSpace = prevEnd !== null && (item.width === undefined || gap > 1.5);
      if (needsSpace && !text.endsWith(" ") && !item.str.startsWith(" ")) text += " ";
      text += item.str;
      prevEnd = item.x + (item.width ?? 0);
    }
    return { text: text.replace(/\s+/g, " ").trim() };
  });
}
