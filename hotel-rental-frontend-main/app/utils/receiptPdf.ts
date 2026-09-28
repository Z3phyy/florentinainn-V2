import { jsPDF } from "jspdf";

const FRAME_ID = "receipt-pdf-render-frame";
const RENDER_WIDTH_PX = 460;
const PAGE_MARGIN_MM = 12;

let rendering = false;

function waitForImages(doc: Document, timeoutMs = 5000): Promise<void> {
  const images = Array.from(doc.images || []);
  const loaded = Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
  return Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

function createRenderFrame(): HTMLIFrameElement {
  document.getElementById(FRAME_ID)?.remove();
  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    top: "0",
    left: "-10000px",
    width: `${RENDER_WIDTH_PX + 40}px`,
    height: "1600px",
    border: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(frame);
  return frame;
}

export async function downloadReceiptPdf(options: {
  bodyHtml: string;
  styles: string;
  filename: string;
  title?: string;
  pageFormat?: "a5" | "a4";
}): Promise<boolean> {
  if (typeof window === "undefined" || rendering) return false;
  rendering = true;
  const frame = createRenderFrame();

  try {
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #ffffff; }
      body { padding: 20px; width: ${RENDER_WIDTH_PX + 40}px; }
      ${options.styles}
      .rcpt-stamp { display: inline-block; line-height: 12px; padding: 1px 10px 7px; }
    </style>
  </head>
  <body>${options.bodyHtml}</body>
</html>`);
    doc.close();

    await waitForImages(doc);
    if (doc.fonts?.ready) {
      await Promise.race([doc.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
    }

    const target = (doc.querySelector(".rcpt") as HTMLElement | null) || doc.body;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(target, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: RENDER_WIDTH_PX + 40,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: options.pageFormat || "a5" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - PAGE_MARGIN_MM * 2;
    const maxHeight = pageHeight - PAGE_MARGIN_MM * 2;
    const ratio = canvas.height / canvas.width;
    let width = maxWidth;
    let height = width * ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / ratio;
    }
    const x = (pageWidth - width) / 2;

    if (options.title) {
      pdf.setProperties({ title: options.title });
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, PAGE_MARGIN_MM, width, height, undefined, "FAST");
    pdf.save(options.filename);
    return true;
  } finally {
    frame.remove();
    rendering = false;
  }
}

export function toSafeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "receipt";
}
