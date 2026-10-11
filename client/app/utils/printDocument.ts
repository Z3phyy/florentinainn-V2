const IFRAME_ID = "hidden-print-frame";

let printing = false;

function getPrintFrame(): HTMLIFrameElement {
  let frame = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = IFRAME_ID;
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.top = "0";
    frame.style.left = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "none";
    frame.style.visibility = "hidden";
    frame.style.zIndex = "-999";
    document.body.appendChild(frame);
  }
  return frame;
}

function waitForImages(doc: Document, timeoutMs = 4000): Promise<void> {
  const images = Array.from(doc.images || []);
  if (images.length === 0) return Promise.resolve();

  const loaded = Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);

  const timeout = new Promise<void>((resolve) =>
    setTimeout(resolve, timeoutMs),
  );
  return Promise.race([loaded, timeout]);
}

export interface PrintDocumentOptions {
  title: string;
  bodyHtml: string;
  styles?: string;
  pageCss?: string;
}

const DEFAULT_PAGE_CSS = `
  @page { size: A4 portrait; margin: 15mm; }
`;

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #ffffff;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  img { max-width: 100%; }
  .no-print { display: none !important; }
`;

export async function printHtmlDocument(
  options: PrintDocumentOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (printing) return false;

  printing = true;

  try {
    const frame = getPrintFrame();
    const doc = frame.contentDocument || frame.contentWindow?.document;

    if (!doc) {
      printing = false;
      return false;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${options.title}</title>
    <style>${options.pageCss ?? DEFAULT_PAGE_CSS}${BASE_CSS}${options.styles || ""}</style>
  </head>
  <body>${options.bodyHtml}</body>
</html>`);
    doc.close();

    await waitForImages(doc);
    await new Promise((resolve) => setTimeout(resolve, 120));

    frame.contentWindow?.focus();
    frame.contentWindow?.print();

    return true;
  } finally {
    setTimeout(() => {
      printing = false;
    }, 800);
  }
}

export async function printElementById(
  elementId: string,
  options: Omit<PrintDocumentOptions, "bodyHtml">,
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;
  return printHtmlDocument({ ...options, bodyHtml: element.innerHTML });
}
