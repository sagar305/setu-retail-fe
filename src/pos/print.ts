// Prints one receipt at its own paper size (58 mm / 80 mm roll, or A4).
// The receipt is copied into a hidden iframe with the app's styles and an
// @page rule for that paper, so the rest of the screen never takes up room
// and the printer gets the right page size, not the browser's default A4.
import type { ReceiptTemplate, Settings } from "../lib/api";

export type Paper = Settings["receiptPaperSize"];

const PX_PER_MM = 96 / 25.4;

/** The @page rule for a paper. Rolls are as long as the receipt. */
export function pageRule(paper: Paper, heightPx: number): string {
  if (paper === "a4") return "@page { size: A4; margin: 10mm; }";
  const width = paper === "58mm" ? 58 : 80;
  const height = Math.max(40, Math.ceil(heightPx / PX_PER_MM) + 2);
  return `@page { size: ${width}mm ${height}mm; margin: 0; }`;
}

/** Print the receipt inside `container` (its `.print-area`). False when that couldn't start. */
export function printReceipt(container: HTMLElement | null, paper: Paper): boolean {
  const receipt = container?.matches(".print-area") ? container : container?.querySelector<HTMLElement>(".print-area");
  if (!receipt || typeof document === "undefined") return false;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.title = "Receipt print";
  // Off screen but laid out, so the receipt's height can be measured.
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:220mm;height:10px;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join("");
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${document.title}</title>${styles}` +
      `<style>html,body{margin:0;padding:0;background:#fff}.print-area{margin:0!important;box-shadow:none!important;border:0!important}` +
      `@media print{body *{visibility:visible!important}.print-area{position:static!important}}</style>` +
      `<style id="page-size"></style></head><body>${receipt.outerHTML}</body></html>`,
  );
  doc.close();

  let printed = false;
  const go = async () => {
    if (printed) return;
    printed = true;
    try {
      await Promise.all([...doc.images].map((img) => (img.complete ? null : img.decode().catch(() => null))));
      if (doc.fonts?.ready) await doc.fonts.ready;
    } catch {
      /* print anyway */
    }
    const el = doc.querySelector<HTMLElement>(".print-area");
    doc.getElementById("page-size")!.textContent = pageRule(paper, el?.getBoundingClientRect().height ?? 0);
    const cleanup = () => window.setTimeout(() => frame.remove(), 500);
    win.addEventListener("afterprint", cleanup, { once: true });
    win.focus();
    win.print();
    window.setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  };
  // Wait for the copied stylesheets (production builds link them).
  const links = [...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
  const pending = links.filter((l) => !l.sheet);
  if (!pending.length) void go();
  else {
    let left = pending.length;
    const one = () => {
      left -= 1;
      if (left <= 0) void go();
    };
    for (const l of pending) {
      l.addEventListener("load", one, { once: true });
      l.addEventListener("error", one, { once: true });
    }
    window.setTimeout(() => void go(), 2000);
  }
  return true;
}

/** The paper a receipt prints on: the design's, else the business setting. */
export const receiptPaper = (settings: Pick<Settings, "receiptPaperSize">, template?: Pick<ReceiptTemplate, "paperSize"> | null): Paper => template?.paperSize ?? settings.receiptPaperSize;
