import type { Order, Settings } from "../lib/api";
import { stateLabel } from "../lib/gstStates";
import { amountInWords, bpToPercent, formatMoney, formatQty } from "../lib/money";

type Paper = Settings["receiptPaperSize"];
const WIDTH: Record<Paper, string> = { "80mm": "w-[80mm]", "58mm": "w-[58mm]", a4: "w-[190mm]" };

const money = (p: number) => (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gstSummary(order: Order) {
  const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const i of order.items) {
    const r = byRate.get(i.gstRateBp) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    r.taxable += i.taxable;
    r.cgst += i.cgst;
    r.sgst += i.sgst;
    r.igst += i.igst;
    byRate.set(i.gstRateBp, r);
  }
  return [...byRate].sort((a, b) => a[0] - b[0]).filter(([rate]) => rate > 0);
}

/** A GST tax invoice for printing (thermal 80/58 mm or A4). Monospace, black on white. */
export function Receipt({ order, settings, creditNoteId }: { order: Order; settings: Settings; creditNoteId?: string }) {
  const paper = settings.receiptPaperSize;
  const cn = creditNoteId ? order.creditNotes.find((c) => c.id === creditNoteId) : undefined;
  const gstin = order.branch.gstin ?? settings.business.taxNumber;
  const title = cn ? "CREDIT NOTE" : order.taxEnabled ? "TAX INVOICE" : "INVOICE";
  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: settings.business.timezone }).format(new Date(cn?.createdAt ?? order.createdAt));
  const lines = cn
    ? cn.items.map((ci) => {
        const item = order.items.find((i) => i.id === ci.orderItemId)!;
        return { ...item, qtyMilli: ci.qtyMilli, total: ci.total };
      })
    : order.items;
  const small = paper === "58mm";
  const igst = order.interState;

  return (
    <div className={`print-area mx-auto bg-white p-3 font-mono text-black ${WIDTH[paper]} ${small ? "text-[10px]" : "text-[12px]"} leading-snug`} aria-label={`${title} ${cn?.number ?? order.invoiceNumber}`}>
      <div className="flex flex-col items-center text-center">
        <strong className={small ? "text-[13px]" : "text-[16px]"}>{settings.business.name.toUpperCase()}</strong>
        <span>{order.branch.name}</span>
        {order.branch.address ? <span>{order.branch.address}</span> : null}
        {order.branch.phone || settings.business.phone ? <span>Ph {order.branch.phone || settings.business.phone}</span> : null}
        {order.taxEnabled && gstin ? <span>GSTIN {gstin}</span> : null}
        <strong className="mt-1">{title}</strong>
      </div>
      <hr className="my-1.5 border-0 border-t border-dashed border-black" />
      <Row a={cn ? "Credit note" : "Bill"} b={cn?.number ?? order.invoiceNumber} />
      {cn ? <Row a="Against bill" b={order.invoiceNumber} /> : null}
      <Row a="Date" b={date} />
      <Row a="Cashier" b={order.cashierName ?? "—"} />
      {order.taxEnabled && order.placeOfSupply ? <Row a="Place of supply" b={stateLabel(order.placeOfSupply)} /> : null}
      <Row a="Customer" b={order.customer?.name ?? "Walk-in"} />
      {order.customer?.gstin ? <Row a="Customer GSTIN" b={order.customer.gstin} /> : null}
      <hr className="my-1.5 border-0 border-t border-dashed border-black" />
      <div className="flex font-bold">
        <span className="flex-1">Item{order.taxEnabled ? " / HSN" : ""}</span>
        <span className="w-10 text-right">Qty</span>
        <span className="w-[4.5rem] text-right">Amount</span>
      </div>
      {lines.map((i) => (
        <div key={i.id} className="mt-1 flex flex-col">
          <div className="flex">
            <span className="flex-1">{i.name}</span>
            <span className="w-10 text-right">{formatQty(i.qtyMilli)}</span>
            <span className="w-[4.5rem] text-right">{money(i.total)}</span>
          </div>
          <span className="text-[#333]">
            {order.taxEnabled && i.hsn ? `HSN ${i.hsn} · ` : ""}@{money(i.unitPrice)}/{i.unit}
            {order.taxEnabled ? ` · GST ${bpToPercent(i.gstRateBp)}%` : ""}
          </span>
        </div>
      ))}
      <hr className="my-1.5 border-0 border-t border-dashed border-black" />
      {!cn && order.discountTotal > 0 ? (
        <>
          <Row a="Subtotal" b={money(order.subtotal)} />
          <Row a="Discount" b={`−${money(order.discountTotal)}`} />
        </>
      ) : null}
      {order.taxEnabled && !cn ? (
        <div className="flex flex-col">
          <div className="flex font-bold">
            <span className="flex-1">GST</span>
            <span className="w-[4.2rem] text-right">Taxable</span>
            {igst ? <span className="w-[3.6rem] text-right">IGST</span> : (
              <>
                <span className="w-[3.2rem] text-right">CGST</span>
                <span className="w-[3.2rem] text-right">SGST</span>
              </>
            )}
          </div>
          {gstSummary(order).map(([rate, r]) => (
            <div key={rate} className="flex">
              <span className="flex-1">{bpToPercent(rate)}%</span>
              <span className="w-[4.2rem] text-right">{money(r.taxable)}</span>
              {igst ? <span className="w-[3.6rem] text-right">{money(r.igst)}</span> : (
                <>
                  <span className="w-[3.2rem] text-right">{money(r.cgst)}</span>
                  <span className="w-[3.2rem] text-right">{money(r.sgst)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {cn && order.taxEnabled ? (
        <>
          <Row a="Taxable" b={money(cn.taxableTotal)} />
          {igst ? <Row a="IGST" b={money(cn.igstTotal)} /> : (
            <>
              <Row a="CGST" b={money(cn.cgstTotal)} />
              <Row a="SGST" b={money(cn.sgstTotal)} />
            </>
          )}
        </>
      ) : null}
      <hr className="my-1.5 border-0 border-t border-dashed border-black" />
      <div className={`flex justify-between font-bold ${small ? "text-[13px]" : "text-[16px]"}`}>
        <span>{cn ? "REFUND" : "TOTAL"}</span>
        <span>{formatMoney(cn?.total ?? order.total, settings.business.currency)}</span>
      </div>
      {cn ? <Row a="Refunded by" b={cn.refundMethodName} /> : order.payments.map((p, i) => <Row key={i} a={p.methodName} b={money(p.amount)} />)}
      <span className="block">{amountInWords(cn?.total ?? order.total)}</span>
      {order.taxEnabled && !cn ? <span className="block text-[#333]">Amounts are in ₹, exact to the paisa.</span> : null}
      {order.status === "CANCELLED" ? <strong className="mt-1 block text-center">*** CANCELLED ***</strong> : null}
      <hr className="my-1.5 border-0 border-t border-dashed border-black" />
      <div className="text-center">
        <span className="block">{settings.receiptFooter}</span>
        <span className="block text-[#333]">Powered by Setu Retail</span>
      </div>
    </div>
  );
}

function Row({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{a}</span>
      <span className="text-right">{b}</span>
    </div>
  );
}
