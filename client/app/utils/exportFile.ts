import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const escapeCell = (value: string | number) => {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadImageSize(
  src: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export async function downloadPDF(options: {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  logoDataUrl?: string;
}) {
  const { filename, title, subtitle, headers, rows, logoDataUrl } = options;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  let textLeft = 40;
  let headerBottom = 0;

  if (logoDataUrl) {
    const size = await loadImageSize(logoDataUrl);
    if (size && size.width > 0 && size.height > 0) {
      const logoHeight = 40;
      const logoWidth = (size.width / size.height) * logoHeight;
      try {
        doc.addImage(
          logoDataUrl,
          40,
          26,
          logoWidth,
          logoHeight,
          undefined,
          "FAST",
        );
        textLeft = 40 + logoWidth + 14;
        headerBottom = 26 + logoHeight;
      } catch {}
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(26, 0, 5);
  doc.text(title, textLeft, 45);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(92, 69, 75);
    doc.text(subtitle, textLeft, 63);
  }

  const startY = Math.max(subtitle ? 80 : 70, headerBottom + 16);

  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? ""))),
    startY,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [144, 5, 70], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 245, 245] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}

export function getExportTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}
