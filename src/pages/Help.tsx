import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { PageHeader } from "../components/ui";
import type { Role } from "../lib/roles";

type Topic = { id: string; title: string; roles: readonly Role[]; body: ReactNode };

const ALL: readonly Role[] = ["OWNER", "MANAGER", "CASHIER"];
const OM: readonly Role[] = ["OWNER", "MANAGER"];
const O: readonly Role[] = ["OWNER"];

const A = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="font-semibold text-indigo">
    {children}
  </Link>
);

const TOPICS: Topic[] = [
  {
    id: "start",
    title: "Getting started",
    roles: O,
    body: (
      <ol>
        <li>
          Add your products in <A to="/products">Products</A>, or bring them in from a spreadsheet or the free Browser POS in <A to="/settings/import">Settings → Import &amp; export</A>.
        </li>
        <li>
          Check your shop details, GST and receipt in <A to="/settings/pos">Settings → Billing &amp; receipt</A>.
        </li>
        <li>
          Add your team in <A to="/staff">Staff</A>. Each person gets an email to set their password.
        </li>
        <li>
          Open <A to="/billing">Billing</A> on each counter once while online, so it can keep billing when the internet drops.
        </li>
      </ol>
    ),
  },
  {
    id: "billing",
    title: "Billing",
    roles: ALL,
    body: (
      <ul>
        <li>Search by name, or scan the barcode, to add a product. Change the quantity on the line.</li>
        <li>Hold a bill to serve the next customer; pick it up again from Held bills.</li>
        <li>Split a payment across cash, UPI and card. Udhaar (credit) needs a saved customer.</li>
        <li>
          Owners and managers cancel a bill or take a return from <A to="/orders">Orders</A>. Cashiers: ask them.
        </li>
      </ul>
    ),
  },
  {
    id: "offline",
    title: "When the internet drops",
    roles: ALL,
    body: (
      <ul>
        <li>Keep billing. Bills are saved on this counter with their own numbers and sent to the cloud as soon as the internet is back.</li>
        <li>The sync chip at the top shows how many bills are waiting. Don't clear the browser's data while bills are waiting.</li>
        <li>
          With no internet you sign in with your 4-digit PIN instead of your password. Set it in <A to="/pin">Counter PIN</A> while online.
        </li>
        <li>Prices and stock on the counter are as of its last refresh; the cloud keeps the bill exactly as it was charged.</li>
      </ul>
    ),
  },
  {
    id: "staff",
    title: "Staff and what they can do",
    roles: OM,
    body: (
      <ul>
        <li>
          <strong>Owner</strong>: everything, including plan, branches and settings.
        </li>
        <li>
          <strong>Manager</strong>: products, stock, reports, transfers and staff in their branches.
        </li>
        <li>
          <strong>Cashier</strong>: billing, their own sales, customers and udhaar in one branch.
        </li>
        <li>Removing someone's access signs them out at once. Every important action is in the <A to="/audit-log">Audit log</A>.</li>
      </ul>
    ),
  },
  {
    id: "stock",
    title: "Stock, branches and transfers",
    roles: OM,
    body: (
      <ul>
        <li>Each branch has its own stock. Supplier bills in Tools → Purchases add stock and set the cost.</li>
        <li>
          Move stock with <A to="/stock-transfers">Stock transfers</A>: send from one branch, receive at the other. Anything short comes back or is written off.
        </li>
        <li>
          Compare branches in <A to="/branch-reports">Branch reports</A>.
        </li>
      </ul>
    ),
  },
  {
    id: "plan",
    title: "Plan, keys and renewals",
    roles: O,
    body: (
      <ul>
        <li>New shops get 3 months of Basic free after verifying their email.</li>
        <li>
          Buy a key on <a href="https://setutechnology.com/products/retail#buy" className="font-semibold text-indigo">setutechnology.com</a>, then redeem it in{" "}
          <A to="/settings/plan">Settings → Plan &amp; key</A>. The button in the purchase email fills the key in for you.
        </li>
        <li>A key for the same plan adds its days. For a different plan you choose to switch now or start it when the current one ends.</li>
        <li>We email you 14, 7 and 1 days before your plan ends. If it ends, your data stays: only you can sign in, to renew.</li>
        <li>More than 100 branches? Contact sales on the website for a key made for you.</li>
      </ul>
    ),
  },
  {
    id: "free-pos",
    title: "Coming from the free Browser POS",
    roles: O,
    body: (
      <ol>
        <li>In the free Browser POS, use its backup to export POS_BACKUP.json.</li>
        <li>
          Here, open <A to="/settings/import">Settings → Import &amp; export</A> and choose the file and the branch.
        </li>
        <li>Products, customers, stock and batches come over, with suppliers, purchases, expenses and udhaar history. Bills stay in the free POS.</li>
      </ol>
    ),
  },
  {
    id: "support",
    title: "Need help?",
    roles: ALL,
    body: (
      <p className="m-0">
        Staff: ask your shop owner or manager first. Owners: write to Setu Technology from{" "}
        <a href="https://setutechnology.com/contact" className="font-semibold text-indigo">
          setutechnology.com/contact
        </a>
        . Mention your shop name, what you were doing and what you saw.
      </p>
    ),
  },
];

/** Short, role-aware help. Each person sees only what applies to them. */
export function HelpPage() {
  const me = useMe();
  const topics = TOPICS.filter((t) => t.roles.includes(me.user.role));
  return (
    <div className="w-full max-w-3xl">
      <PageHeader title="Help" description="Quick answers for using Setu Retail." />
      <nav aria-label="Help topics" className="mb-4 flex flex-wrap gap-2">
        {topics.map((t) => (
          <a key={t.id} href={`#${t.id}`} onClick={() => document.getElementById(t.id)?.setAttribute("open", "")} className="flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-indigo hover:border-indigo">
            {t.title}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-3">
        {topics.map((t, i) => (
          <details key={t.id} id={t.id} open={i < 2} className="scroll-mt-20 rounded-2xl border border-line bg-white px-5 py-1">
            <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold">{t.title}</summary>
            <div className="pb-4 text-[15px] leading-relaxed [&_li]:mb-1.5 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5">{t.body}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
