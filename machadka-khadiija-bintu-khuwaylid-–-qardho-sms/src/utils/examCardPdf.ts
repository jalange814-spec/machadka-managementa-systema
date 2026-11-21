/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { ExamCard, SchoolSettings } from '../types';

export function chunkCardsForA4<T>(items: T[], cardsPerPage: 5 | 8): T[][] {
  const size = cardsPerPage === 5 ? 5 : 8;
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

async function tryLoadImage(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 2500);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// SHARED EXAM CARD META (validity dates, authorization, session)
// Every renderer (screen preview, PDF, A4 print HTML) uses these helpers,
// so the three outputs always show the same information.
// ============================================================

export const EXAM_CARD_DEFAULTS = {
  validityStart: '2026-12-05',
  validityEnd: '2026-12-15',
  administratorName: 'Ahmed Khaliif Ceegaag',
  administratorTitle: 'Examination Administrator / Maamulaha Imtixaanka',
};

/** Converts YYYY-MM-DD to DD/MM/YYYY. Any other format is returned unchanged. */
export function formatDateDMY(value: string | undefined): string {
  const v = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export interface ExamCardMeta {
  validityStart: string;
  validityEnd: string;
  validityText: string;
  administratorName: string;
  administratorTitle: string;
}

export function getExamCardMeta(settings: SchoolSettings): ExamCardMeta {
  const validityStart = settings.examValidityStart || EXAM_CARD_DEFAULTS.validityStart;
  const validityEnd = settings.examValidityEnd || EXAM_CARD_DEFAULTS.validityEnd;
  return {
    validityStart,
    validityEnd,
    validityText: `${formatDateDMY(validityStart)} – ${formatDateDMY(validityEnd)}`,
    administratorName: settings.examAdministratorName?.trim() || EXAM_CARD_DEFAULTS.administratorName,
    administratorTitle: settings.examAdministratorTitle?.trim() || EXAM_CARD_DEFAULTS.administratorTitle,
  };
}

/** Session (Galinka) label taken from the student's registered shift. */
export function examSessionLabel(shift: string | undefined): string {
  const v = String(shift || '').trim().toLowerCase();
  if (v.startsWith('subax') || v === 'morning') return 'Subax (Morning)';
  if (v.startsWith('galab') || v === 'afternoon') return 'Galab (Afternoon)';
  if (v.startsWith('habeen') || v === 'evening' || v === 'night') return 'Habeen (Evening / Night)';
  return shift || '—';
}

function drawSingleExamCard(
  ctx: CanvasRenderingContext2D,
  card: ExamCard,
  meta: ExamCardMeta,
  logoImg: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  layoutMode: 5 | 8
) {
  const isCompact = layoutMode === 8;
  const GREEN = '#00723A';
  const GOLD = '#FCA700';
  const pad = isCompact ? 22 : 26;

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = GREEN;
  ctx.stroke();
  ctx.clip();

  // ---------- Header ----------
  const headerH = isCompact ? 128 : 108;
  ctx.fillStyle = GREEN;
  ctx.fillRect(x, y, w, headerH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, y + headerH, w, 6);

  const logoSize = Math.round(headerH * 0.7);
  const logoX = x + pad;
  const logoY = y + Math.round((headerH - logoSize) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.clip();
  if (logoImg) {
    try {
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      // ignore
    }
  } else {
    ctx.fillStyle = GREEN;
    ctx.font = `bold ${Math.round(logoSize * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MK', logoX + logoSize / 2, logoY + logoSize / 2);
  }
  ctx.restore();

  const badgeW = isCompact ? 200 : 300;
  const badgeX = x + w - badgeW - pad;
  const titleX = logoX + logoSize + 16;
  const titleMaxW = badgeX - titleX - 14;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;
  ctx.font = `bold ${isCompact ? 19 : 20}px Amiri, serif`;
  ctx.fillText('معهد خديجة بنت خويلد – قرطو', titleX, y + (isCompact ? 14 : 10), titleMaxW);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${isCompact ? 19 : 22}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('MACHADKA KHADIIJA BINTU KHUWAYLID – QARDHO', titleX, y + (isCompact ? 44 : 38), titleMaxW);
  ctx.fillStyle = '#E2F5EB';
  ctx.font = `700 ${isCompact ? 14 : 15}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('KAARKA OGOLAANSHAHA IMTIXAANKA', titleX, y + (isCompact ? 74 : 68), titleMaxW);
  if (isCompact) {
    ctx.fillText('EXAMINATION ADMISSION CARD', titleX, y + 94, titleMaxW);
  } else {
    const firstW = ctx.measureText('KAARKA OGOLAANSHAHA IMTIXAANKA ').width;
    ctx.fillStyle = GOLD;
    ctx.fillText('· EXAMINATION ADMISSION CARD', titleX + firstW, y + 68, Math.max(40, titleMaxW - firstW));
  }

  const badgeY = y + 16;
  const badgeH = headerH - 32;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = `bold ${isCompact ? 15 : 16}px "JetBrains Mono", monospace`;
  ctx.fillText(card.academicYear, badgeX + badgeW / 2, badgeY + 10, badgeW - 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${isCompact ? 16 : 18}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(card.examTitle, badgeX + badgeW / 2, badgeY + (isCompact ? 38 : 36), badgeW - 16);

  // ---------- Footer (authorization + signature) ----------
  const footerH = isCompact ? 96 : 82;
  const footerY = y + h - footerH;
  const bandH = isCompact ? 44 : 40;
  const bandY = footerY - bandH - 10;

  // ---------- Body: student information ----------
  const bodyTop = y + headerH + 6;
  const rowH = isCompact ? 66 : 52;
  const nameBlockH = isCompact ? 66 : 64;
  const contentH = nameBlockH + rowH * (isCompact ? 2 : 1) - 10;
  const bodyY = bodyTop + Math.max(12, Math.round((bandY - bodyTop - contentH) / 2));
  const innerW = w - pad * 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const label = (text: string, fx: number, fy: number, maxW: number) => {
    ctx.fillStyle = '#64748B';
    ctx.font = `700 ${isCompact ? 13 : 13}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(text, fx, fy, maxW);
  };
  const value = (text: string, fx: number, fy: number, maxW: number, size: number, mono = false, color = '#0F172A') => {
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px ${mono ? '"JetBrains Mono", monospace' : '"Plus Jakarta Sans", sans-serif'}`;
    ctx.fillText(text, fx, fy, maxW);
  };

  label('MAGACA ARDAYGA · STUDENT NAME', x + pad, bodyY, innerW);
  value(card.studentName, x + pad, bodyY + 18, innerW, isCompact ? 30 : 32);

  const fields: Array<[string, string, boolean, string]> = [
    ['FASALKA · CLASS', `${card.className}${card.section ? ` (${card.section})` : ''}`, false, '#0F172A'],
    ['LAMBARKA ROLL-KA · ROLL NO.', card.rollNumber, true, '#0F172A'],
    ['AQOONSIGA ARDAYGA · STUDENT ID', card.studentId, true, GREEN],
    ['GALINKA · SESSION', examSessionLabel(card.shift), false, '#0F172A'],
  ];
  const gridY = bodyY + nameBlockH;
  const cols = isCompact ? 2 : 4;
  const colW = innerW / cols;
  fields.forEach(([lbl, val, mono, color], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fx = x + pad + col * colW;
    const fy = gridY + row * rowH;
    if (col > 0) {
      ctx.beginPath();
      ctx.moveTo(fx - 10, fy + 2);
      ctx.lineTo(fx - 10, fy + rowH - 12);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    label(lbl, fx, fy, colW - 18);
    value(val || '—', fx, fy + 18, colW - 18, isCompact ? 23 : 22, mono, color);
  });

  // ---------- Validity band ----------
  drawRoundedRect(ctx, x + pad, bandY, innerW, bandH, 8);
  ctx.fillStyle = '#FFF7E0';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GREEN;
  ctx.font = `800 ${isCompact ? 18 : 19}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(`EXAMINATION VALIDITY: ${meta.validityText}`, x + w / 2, bandY + bandH / 2 + 1, innerW - 20);

  // ---------- Footer ----------
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(x, footerY, w, footerH);
  ctx.beginPath();
  ctx.moveTo(x, footerY);
  ctx.lineTo(x + w, footerY);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  const sigW = isCompact ? 280 : 380;
  const sigX = x + w - pad - sigW;
  const leftMaxW = sigX - (x + pad) - 16;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#64748B';
  ctx.font = `700 ${isCompact ? 12 : 13}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('AUTHORIZED BY · WAXAA OGGOLAADAY:', x + pad, footerY + (isCompact ? 12 : 10), leftMaxW);
  ctx.fillStyle = '#0F172A';
  ctx.font = `800 ${isCompact ? 18 : 19}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(meta.administratorName, x + pad, footerY + (isCompact ? 30 : 28), leftMaxW);
  ctx.fillStyle = GREEN;
  ctx.font = `700 ${isCompact ? 12 : 13}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(meta.administratorTitle, x + pad, footerY + (isCompact ? 54 : 52), leftMaxW);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${isCompact ? 10 : 11}px "JetBrains Mono", monospace`;
  ctx.fillText(`Ref: ${card.id}`, x + pad, footerY + (isCompact ? 74 : 68), leftMaxW);

  // Signature line (left blank for a real signature)
  const lineY = footerY + (isCompact ? 58 : 50);
  ctx.beginPath();
  ctx.moveTo(sigX, lineY);
  ctx.lineTo(sigX + sigW, lineY);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = `700 ${isCompact ? 12 : 13}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('Signature of Examination Administrator', sigX + sigW / 2, lineY + 6, sigW);

  ctx.restore();
}

export async function generateExamCardsPdf(
  cards: ExamCard[],
  settings: SchoolSettings,
  cardsPerPage: 5 | 8,
  filename?: string
): Promise<{ pageCount: number; cardCount: number }> {
  const pages = chunkCardsForA4(cards, cardsPerPage);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // A4 at 200 DPI = 1654 x 2339 px
  const PAGE_W = 1654;
  const PAGE_H = 2339;
  const MARGIN_X = 48;
  const MARGIN_Y = 56;
  const GAP_X = 28;
  const GAP_Y = 24;

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  const logoImg = await tryLoadImage(settings.logoUrl);
  const meta = getExamCardMeta(settings);

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    if (pIdx > 0) {
      pdf.addPage('a4', 'portrait');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Subtle A4 Header + Page Marker
    ctx.fillStyle = '#00723A';
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `MACHADKA KHADIIJA BINTU KHUWAYLID – KAARARKA IMTIXAANKA (${cardsPerPage}/Bogga)`,
      MARGIN_X,
      20
    );
    ctx.fillStyle = '#64748B';
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Bogga ${pIdx + 1} / ${pages.length}`, PAGE_W - MARGIN_X, 20);

    const usableTop = MARGIN_Y + 8;
    const usableH = PAGE_H - usableTop - MARGIN_Y;
    const usableW = PAGE_W - MARGIN_X * 2;
    const pageCards = pages[pIdx];

    if (cardsPerPage === 8) {
      const cols = 2;
      const rows = 4;
      const cardW = Math.floor((usableW - GAP_X) / cols);
      const cardH = Math.floor((usableH - GAP_Y * (rows - 1)) / rows);
      pageCards.forEach((card, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = MARGIN_X + col * (cardW + GAP_X);
        const cy = usableTop + row * (cardH + GAP_Y);
        drawSingleExamCard(
          ctx,
          card,
          meta,
          logoImg,
          cx,
          cy,
          cardW,
          cardH,
          8
        );
      });
    } else {
      const rows = 5;
      const cardW = usableW;
      const cardH = Math.floor((usableH - GAP_Y * (rows - 1)) / rows);
      pageCards.forEach((card, idx) => {
        const cy = usableTop + idx * (cardH + GAP_Y);
        drawSingleExamCard(
          ctx,
          card,
          meta,
          logoImg,
          MARGIN_X,
          cy,
          cardW,
          cardH,
          5
        );
      });
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  const targetName =
    filename ||
    `Kaararka-Imtixaanka-${cardsPerPage}-per-A4-${new Date().toISOString().substring(0, 10)}.pdf`;
  pdf.save(targetName);

  return { pageCount: pages.length, cardCount: cards.length };
}

export function buildPrintableExamCardsHtml(
  cards: ExamCard[],
  settings: SchoolSettings,
  cardsPerPage: 5 | 8
): string {
  const pages = chunkCardsForA4(cards, cardsPerPage);
  const meta = getExamCardMeta(settings);
  const esc = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const logoHtml = settings.logoUrl
    ? `<div class="ec-logo"><img src="${esc(settings.logoUrl)}" alt="" /></div>`
    : '<div class="ec-logo">MK</div>';

  const pagesHtml = pages
    .map((pageCards, pIdx) => {
      const gridStyle =
        cardsPerPage === 8
          ? 'display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;'
          : 'display:grid;grid-template-columns:1fr;gap:4mm;';

      const cardsHtml = pageCards
        .map(
          (card) => `
          <div class="ec" style="height:${cardsPerPage === 8 ? '63mm' : '51mm'};">
            <div class="ec-head">
              ${logoHtml}
              <div class="ec-titles">
                <div class="ec-ar">معهد خديجة بنت خويلد – قرطو</div>
                <div class="ec-name">MACHADKA KHADIIJA BINTU KHUWAYLID – QARDHO</div>
                <div class="ec-sub">KAARKA OGOLAANSHAHA IMTIXAANKA · EXAMINATION ADMISSION CARD</div>
              </div>
              <div class="ec-badge"><div class="ec-year">${esc(card.academicYear)}</div><div>${esc(card.examTitle)}</div></div>
            </div>
            <div class="ec-body">
              <div>
              <div class="ec-lbl">MAGACA ARDAYGA · STUDENT NAME</div>
              <div class="ec-student">${esc(card.studentName)}</div>
              <div class="ec-grid ${cardsPerPage === 8 ? 'two' : 'four'}">
                <div><div class="ec-lbl">FASALKA · CLASS</div><div class="ec-val">${esc(card.className)}${
            card.section ? ` (${esc(card.section)})` : ''
          }</div></div>
                <div><div class="ec-lbl">LAMBARKA ROLL-KA · ROLL NO.</div><div class="ec-val mono">${esc(card.rollNumber)}</div></div>
                <div><div class="ec-lbl">AQOONSIGA ARDAYGA · STUDENT ID</div><div class="ec-val mono green">${esc(card.studentId)}</div></div>
                <div><div class="ec-lbl">GALINKA · SESSION</div><div class="ec-val">${esc(examSessionLabel(card.shift))}</div></div>
              </div>
              </div>
              <div class="ec-valid">EXAMINATION VALIDITY: ${esc(meta.validityText)}</div>
            </div>
            <div class="ec-foot">
              <div class="ec-auth">
                <div class="ec-lbl">AUTHORIZED BY · WAXAA OGGOLAADAY:</div>
                <div class="ec-admin">${esc(meta.administratorName)}</div>
                <div class="ec-title">${esc(meta.administratorTitle)}</div>
              </div>
              <div class="ec-sig"><div class="ec-line"></div>Signature of Examination Administrator<div class="ec-ref">Ref: ${esc(card.id)}</div></div>
            </div>
          </div>`
        )
        .join('');

      return `
      <div style="width:210mm;min-height:282mm;margin:0 auto;padding:5mm;box-sizing:border-box;page-break-after:${
        pIdx === pages.length - 1 ? 'auto' : 'always'
      };">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#00723A;font-weight:700;margin-bottom:3mm;">
          <span>Kaararka Imtixaanka · Machadka Khadiija Bintu Khuwaylid</span>
          <span>Bogga ${pIdx + 1} / ${pages.length}</span>
        </div>
        <div style="${gridStyle}">${cardsHtml}</div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="so">
<head>
<meta charset="UTF-8" />
<title>Kaararka Imtixaanka - A4 Print</title>
<style>
@page { size: A4 portrait; margin: 6mm; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ec { border:1.5px solid #00723A; border-radius:6px; overflow:hidden; background:#fff; page-break-inside:avoid; break-inside:avoid; display:flex; flex-direction:column; box-sizing:border-box; }
.ec-head { background:#00723A; color:#fff; padding:4px 8px; border-bottom:3px solid #FCA700; display:flex; align-items:center; gap:7px; }
.ec-logo { width:28px; height:28px; border-radius:50%; background:#fff; border:1.5px solid #FCA700; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:#00723A; flex-shrink:0; }
.ec-logo img { width:100%; height:100%; object-fit:contain; }
.ec-titles { flex:1; min-width:0; line-height:1.2; }
.ec-ar { color:#FCA700; font-weight:700; font-size:10px; }
.ec-name { font-weight:800; font-size:8.5px; line-height:1.15; }
.ec-sub { font-size:7.5px; font-weight:700; color:#E2F5EB; letter-spacing:.2px; }
.ec-badge { border:1px solid #FCA700; border-radius:4px; padding:2px 6px; text-align:center; font-size:8.5px; font-weight:700; max-width:34%; }
.ec-year { color:#FCA700; font-family:ui-monospace, monospace; }
.ec-body { flex:1; padding:5px 10px 4px; display:flex; flex-direction:column; justify-content:space-between; gap:3px; min-height:0; }
.ec-lbl { font-size:7px; font-weight:700; color:#64748b; letter-spacing:.2px; }
.ec-student { font-size:15px; font-weight:800; color:#0f172a; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ec-grid { display:grid; gap:4px 10px; }
.ec-grid.two { grid-template-columns:1fr 1fr; }
.ec-grid.four { grid-template-columns:repeat(4,1fr); }
.ec-val { font-size:11.5px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ec-val.mono { font-family:ui-monospace, monospace; }
.ec-val.green { color:#00723A; }
.ec-valid { background:#FFF7E0; border:1px solid #FCA700; border-radius:4px; text-align:center; font-size:10px; font-weight:800; color:#00723A; padding:2px 4px; }
.ec-foot { background:#f8fafc; border-top:1px solid #e2e8f0; padding:3px 9px; display:flex; justify-content:space-between; align-items:flex-end; gap:8px; }
.ec-auth { min-width:0; line-height:1.2; }
.ec-admin { font-size:10px; font-weight:800; color:#0f172a; }
.ec-title { font-size:7px; font-weight:700; color:#00723A; }
.ec-sig { width:42%; text-align:center; font-size:7px; font-weight:700; color:#334155; }
.ec-line { border-top:1px solid #334155; margin:12px 0 2px; }
.ec-ref { font-size:6px; color:#94a3b8; font-family:ui-monospace, monospace; font-weight:600; }
</style>
</head>
<body>${pagesHtml}<script>window.onload=function(){try{window.print();}catch(e){}}</script></body>
</html>`;
}
