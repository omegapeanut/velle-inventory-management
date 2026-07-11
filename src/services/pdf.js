// Professional A4 Purchase Order / Delivery Order generator for Velle.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { VELLE } from "./velleBrand.js";

const INK = [26, 24, 22];       // near-black
const MUTE = [120, 114, 104];   // warm grey
const ACCENT = [154, 123, 78];  // bronze
const L = 40, R = 555;          // page margins (A4 = 595pt wide)

// Editable company details (name/address/phone/email/website/UEN/GST) layer over the
// static brand assets (logo/QR/bank) from velleBrand.js. Call setCompanyInfo whenever
// SuperAdmin → Company Settings changes so every subsequently-generated PDF picks it up.
let COMPANY = { ...VELLE };
export function setCompanyInfo(overrides) { COMPANY = { ...VELLE, ...overrides }; }

const money = n => "$" + (Number(n) || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Build the printable line items from an order (delivered / returned / exchanged).
function lineItems(order) {
  // Orders can carry multiple products (order.items); older/legacy orders only ever had
  // one product on the top-level fields — fall back to that as a single-line array.
  const rows = order.items && order.items.length ? order.items : [{ product: order.product, price: order.price, sold: order.sold, returned: order.returned, exchanged: order.exchanged }];
  const items = [];
  rows.forEach(row => {
    const price = Number(row.price) || 0;
    const delivered = Number(row.sold) || 0;   // "sold" key stores Delivered qty
    const returned = Number(row.returned) || 0;
    const exchanged = Number(row.exchanged) || 0;
    const name = row.product || "Item";
    if (delivered > 0) items.push({ desc: name, note: "", qty: delivered, price, amount: delivered * price });
    if (returned > 0) items.push({ desc: name, note: "Returned — Damaged / Defective", qty: returned, price: -price, amount: -returned * price });
    if (exchanged > 0) items.push({ desc: name, note: "Exchanged — Wrong Size (like-for-like)", qty: exchanged, price: 0, amount: 0 });
  });
  return items;
}

function header(doc, title, refLabel, refNo, date) {
  // logo
  const lw = 96, lh = lw * 152 / 439;
  try { doc.addImage(COMPANY.logo, "PNG", L, 34, lw, lh); } catch { /* ignore */ }
  // company block (right aligned) — UEN/GST share one line to keep this block compact
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(COMPANY.name, R, 42, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  const lines = [COMPANY.addr1, COMPANY.addr2, `UEN ${COMPANY.uen}  ·  GST Reg. No. ${COMPANY.gst}`];
  if (COMPANY.phone) lines.push(`Tel ${COMPANY.phone}`);
  if (COMPANY.email) lines.push(COMPANY.email);
  if (COMPANY.website) lines.push(COMPANY.website);
  lines.forEach((t, i) => doc.text(t, R, 55 + i * 11, { align: "right" }));
  const infoBottom = 55 + (lines.length - 1) * 11;
  // title
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(title, L, 118);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(2); doc.line(L, 126, L + 150, 126);
  // reference meta box (right) — positioned with a clear gap below the company block,
  // however tall that block ends up being (varies with which fields are filled in).
  const refY = Math.max(104, infoBottom + 22);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE);
  doc.text(refLabel, R - 130, refY);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold");
  doc.text(String(refNo || "—"), R, refY, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE);
  doc.text("Date", R - 130, refY + 14);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold");
  doc.text(String(date || "—"), R, refY + 14, { align: "right" });
  return Math.max(150, refY + 36);
}

function parties(doc, y, order) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text("DEALER", L, y);
  doc.text("SALESPERSON", R - 150, y);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(order.dealer || "—", L, y + 15);
  doc.setFontSize(10);
  doc.text(order.by || "—", R - 150, y + 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
  doc.text(`Order date: ${order.date || "—"}`, R - 150, y + 29);
  let bottom = y + 42;
  const contact = [order.dealerPhone, order.dealerEmail].filter(Boolean).join("  ·  ");
  if (contact) { doc.text(contact, L, y + 29); bottom = Math.max(bottom, y + 43); }
  return bottom;
}

function itemsTable(doc, y, order, withPrices) {
  const items = lineItems(order);
  const head = withPrices
    ? [["S/No", "Description", "Qty", "Unit Price", "Amount"]]
    : [["S/No", "Description", "Qty Delivered", "Remarks"]];
  const body = items.map((it, i) => withPrices
    ? [String(i + 1), it.note ? `${it.desc}\n${it.note}` : it.desc, String(it.qty), money(it.price), money(it.amount)]
    : [String(i + 1), it.desc, String(it.qty), it.note || "—"]);
  autoTable(doc, {
    startY: y,
    head, body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: [225, 219, 208] },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    columnStyles: withPrices
      ? { 0: { cellWidth: 38, halign: "center" }, 2: { cellWidth: 44, halign: "center" }, 3: { cellWidth: 78, halign: "right" }, 4: { cellWidth: 84, halign: "right" } }
      : { 0: { cellWidth: 40, halign: "center" }, 2: { cellWidth: 90, halign: "center" } },
    margin: { left: L, right: 40 },
  });
  return doc.lastAutoTable.finalY;
}

// Sub-Total / GST / (divider) / Total, with enough breathing room that the bold total
// line never sits on top of the rule above it.
function totalsBlock(doc, y, sub, gst, gstRate, total, label) {
  const x1 = R - 190, x2 = R;
  doc.setFontSize(9.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
  doc.text("Sub-Total", x1, y); doc.text(money(sub), x2, y, { align: "right" }); y += 17;
  doc.text(`GST ${Math.round((gstRate || 0) * 100)}%`, x1, y); doc.text(money(gst), x2, y, { align: "right" }); y += 14;
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.8); doc.line(x1, y, x2, y); y += 22;
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(label, x1, y); doc.text(money(total), x2, y, { align: "right" });
  return y + 8;
}

function totals(doc, y, order) {
  const items = lineItems(order);
  const sub = items.reduce((s, it) => s + it.amount, 0);
  const gst = sub * (VELLE.gstRate || 0);
  return totalsBlock(doc, y, sub, gst, VELLE.gstRate, sub + gst, "Total (SGD)");
}

// Thank-you note below the totals. (Document no longer credits who issued it.)
function closingRow(doc, y) {
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...ACCENT);
  doc.text("Thank you for your business!", L, y);
  return y + 14;
}

// "E. & O. E." + a blank bordered box for office/internal reference use.
function officialUseBox(doc, y) {
  doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...MUTE);
  doc.text("E. & O. E.", L, y);
  const boxY = y + 6, boxW = 160, boxH = 40;
  doc.setDrawColor(...MUTE); doc.setLineWidth(0.6);
  doc.rect(L, boxY, boxW, boxH);
  doc.setFontSize(7.5);
  doc.text("Official Use", L + 8, boxY + 13);
  return boxY + boxH;
}

function terms(doc, y) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
  doc.text("TERMS & CONDITIONS", L, y); y += 12;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTE);
  const t = [
    "1. All goods remain the property of Velle Pte. Ltd. until full payment is received.",
    "2. Goods must be inspected on delivery. Shortages, damage or defects must be reported within 3 days, with photo evidence and this document.",
    "3. Damage Protection: items confirmed damaged/defective on delivery are replaced or credited at no charge. Damage from mishandling, improper",
    "    installation or normal wear is not covered.",
    "4. Wrong-size or incorrect items may be exchanged within 7 days if unused and in original packaging, subject to stock availability.",
    "5. All returns and exchanges must be pre-approved by Velle Pte. Ltd. Goods are otherwise not returnable.",
  ];
  t.forEach(line => { doc.text(line, L, y); y += 10; });
  return y;
}

function paymentQR(doc, y) {
  try { doc.addImage(VELLE.qr, "PNG", L, y, 66, 66); } catch { /* ignore */ }
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
  doc.text("Payment", L + 78, y + 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text(`PayNow to UEN ${COMPANY.uen}`, L + 78, y + 26);
  doc.text(VELLE.bank, L + 78, y + 37);
  doc.text("Scan the PayNow QR to pay.", L + 78, y + 48);
  return y + 66;
}

function signatures(doc, y) {
  const midx = 300;
  doc.setDrawColor(...MUTE); doc.setLineWidth(0.5);
  doc.line(L, y, L + 180, y);
  doc.line(midx, y, midx + 180, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text("Issued / Delivered by", L, y + 12);
  doc.text("Received by (Name, Signature & Date)", midx, y + 12);
}

function footer(doc) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTE);
  doc.text(`${COMPANY.name}  ·  UEN ${COMPANY.uen}  ·  This is a computer-generated document.`, 297.6, 820, { align: "center" });
}

export function makePO(order) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = header(doc, "PURCHASE ORDER", "PO No.", order.poNo || order.refNo, order.date);
  y = parties(doc, y, order);
  y = itemsTable(doc, y + 4, order, true);
  y = totals(doc, y + 24, order);
  y = closingRow(doc, y + 14);
  y = paymentQR(doc, y + 16);
  y = officialUseBox(doc, y + 18);
  y = terms(doc, y + 20);
  signatures(doc, Math.max(y + 24, 760));
  footer(doc);
  return doc;
}

export function makeDO(order) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = header(doc, "DELIVERY ORDER", "DO No.", order.doNo || order.refNo, order.date);
  y = parties(doc, y, order);
  y = itemsTable(doc, y + 4, order, false);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
  doc.text("Please check goods on receipt. Sign below to acknowledge delivery in good order.", L, y + 20);
  y = closingRow(doc, y + 40);
  y = officialUseBox(doc, y + 12);
  y = terms(doc, y + 20);
  signatures(doc, Math.max(y + 24, 760));
  footer(doc);
  return doc;
}

// ── TAX INVOICE (monthly, per dealer) ──────────────────────────────────────────
function invoiceParties(doc, y, invoice) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text("BILL TO", L, y);
  doc.text("PERIOD", R - 150, y);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(invoice.dealer || "—", L, y + 15);
  doc.setFontSize(10);
  doc.text(invoice.monthLabel || "—", R - 150, y + 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
  doc.text(`Due date: ${invoice.dueDate || "—"}`, R - 150, y + 29);
  let bottom = y + 42;
  const contact = [invoice.dealerPhone, invoice.dealerEmail].filter(Boolean).join("  ·  ");
  if (contact) { doc.text(contact, L, y + 29); bottom = Math.max(bottom, y + 43); }
  return bottom;
}

function invoiceItemsTable(doc, y, invoice) {
  const head = [["S/No", "Model / Description", "PO No.", "DO No.", "Qty", "Unit Price", "Amount"]];
  const body = (invoice.lines || []).map((l, i) => [String(i + 1), l.model, l.poNo || "—", l.doNo || "—", String(l.qty), money(l.price), money(l.amount)]);
  autoTable(doc, {
    startY: y, head, body, theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: INK, lineColor: [225, 219, 208] },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 32, halign: "center" }, 2: { cellWidth: 60 }, 3: { cellWidth: 60 }, 4: { cellWidth: 32, halign: "center" }, 5: { cellWidth: 66, halign: "right" }, 6: { cellWidth: 72, halign: "right" } },
    margin: { left: L, right: 40 },
  });
  return doc.lastAutoTable.finalY;
}

function invoiceTotals(doc, y, invoice) {
  return totalsBlock(doc, y, invoice.subtotal, invoice.gst, invoice.gstRate ?? 0.09, invoice.total, "Total Due (SGD)");
}

function invoiceTerms(doc, y) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
  doc.text("STANDARD TERMS", L, y); y += 12;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTE);
  const t = [
    "1. Payment is due within 30 days of the invoice date stated above.",
    "2. Accounts overdue beyond the 30-day payment term are subject to a $200/month administrative fee.",
    "3. A late payment charge of 3% of the total amount owing applies to balances that remain overdue.",
    "4. All goods remain the property of Velle Pte. Ltd. until paid in full.",
  ];
  t.forEach(line => { doc.text(line, L, y); y += 10; });
  return y;
}

export function makeTaxInvoice(invoice) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = header(doc, "TAX INVOICE", "Invoice No.", invoice.refNo, invoice.issueDate);
  y = invoiceParties(doc, y, invoice);
  y = invoiceItemsTable(doc, y + 4, invoice);
  y = invoiceTotals(doc, y + 24, invoice);
  y = closingRow(doc, y + 14);
  y = paymentQR(doc, y + 16);
  y = officialUseBox(doc, y + 18);
  invoiceTerms(doc, y + 20);
  footer(doc);
  return doc;
}

export function downloadInvoice(invoice) { makeTaxInvoice(invoice).save(`${invoice.refNo || "invoice"}.pdf`); }
export function printInvoice(invoice) {
  const doc = makeTaxInvoice(invoice);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

function make(order, kind) { return kind === "PO" ? makePO(order) : makeDO(order); }

export function downloadDoc(order, kind) {
  const ref = kind === "PO" ? (order.poNo || order.refNo) : (order.doNo || order.refNo);
  make(order, kind).save(`${kind}-${ref || "order"}.pdf`);
}

export function printDoc(order, kind) {
  const doc = make(order, kind);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}
