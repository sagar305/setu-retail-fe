import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** PNG data URL of a QR for `link`; "" while it's made or when link is "". */
export function useQrDataUrl(link: string, width = 240): string {
  const [qr, setQr] = useState({ link: "", url: "" });
  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, { width, margin: 1, errorCorrectionLevel: "M" }).then(
      (url) => alive && setQr({ link, url }),
      () => alive && setQr({ link, url: "" }),
    );
    return () => {
      alive = false;
    };
  }, [link, width]);
  return link && qr.link === link ? qr.url : "";
}
