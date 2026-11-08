import { useQrDataUrl } from "../hooks/useQrDataUrl";
import { Maximize2 } from "lucide-react";

/** On-screen QR for the exact amount, for the cashier to turn towards the customer. */
export function UpiQrCard({ link, amountLabel, upiId, size = 160, onZoom, compact = false }: { link: string; amountLabel: string; upiId: string; size?: number; onZoom?: () => void; compact?: boolean }) {
  const qr = useQrDataUrl(link, Math.max(size * 2, 240));
  const zoom = onZoom ? (
    <button type="button" onClick={onZoom} aria-label="Show the UPI QR full size for the customer" title="Show full size" className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-lg text-ok hover:bg-white">
      <Maximize2 size={18} aria-hidden="true" />
    </button>
  ) : null;
  // Side by side, to leave the bill's lines room on a short screen.
  if (compact)
    return (
      <div className="relative flex items-center gap-3 rounded-xl border border-ok/30 bg-ok-50 p-2.5 pr-12">
        <div className="flex shrink-0 items-center justify-center rounded-lg bg-white p-1.5" style={{ width: size + 12, height: size + 12 }}>
          {qr ? <img src={qr} alt={`UPI QR code to pay ${amountLabel}`} width={size} height={size} /> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="m-0 text-sm font-bold text-ok">Scan to pay {amountLabel}</p>
          <p className="m-0 text-xs break-all text-ok">{upiId}</p>
          <p className="m-0 text-[11px] text-muted">Any UPI app: the amount is filled in</p>
        </div>
        {zoom}
      </div>
    );
  return (
    <div className="relative rounded-xl border border-ok/30 bg-ok-50 p-3 text-center">
      <p className="m-0 text-sm font-bold text-ok">Scan to pay {amountLabel}</p>
      <div className="mx-auto mt-2 flex items-center justify-center rounded-lg bg-white p-2" style={{ width: size + 16, height: size + 16 }}>
        {qr ? <img src={qr} alt={`UPI QR code to pay ${amountLabel}`} width={size} height={size} /> : null}
      </div>
      <p className="m-0 mt-2 text-xs break-all text-ok">{upiId}</p>
      <p className="m-0 mt-0.5 text-[11px] text-muted">GPay · PhonePe · Paytm · any UPI app: the amount is filled in</p>
      {zoom}
    </div>
  );
}
