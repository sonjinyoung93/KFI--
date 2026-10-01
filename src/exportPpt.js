// PJT별 조직도 → PPT(16:9) 1장. 샘플(공사 개요 조직도) 양식 기준
import { getPhoto } from './api.js';

const FONT = '맑은 고딕';
const NAVY = '1F3864', BLUE = '2F6DB5', LINE = '7F92AE', GRAY = '5B6573';

export async function exportSitePpt(S, baseDate) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  const s = pptx.addSlide();

  // 사진 미리 받기
  const all = [...S.top.flatMap(t => t.people), ...S.cols.flatMap(c => c.list)];
  const photos = {};
  await Promise.all(all.filter(x => x.p.photoId).map(async x => { photos[x.p.id] = await getPhoto(x.p.photoId); }));

  // 제목
  s.addText([{ text: 'Ⅰ. 공사 개요 ', options: { fontSize: 24, bold: true } }, { text: '( 조직도 )', options: { fontSize: 16, bold: true } }],
    { x: 0.3, y: 0.15, w: 7, h: 0.55, fontFace: FONT, color: '16202E' });
  s.addText(S.site, { x: 8.3, y: 0.12, w: 4.8, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: 'A6AFBD', align: 'right' });
  s.addShape(pptx.ShapeType.line, { x: 0.3, y: 0.78, w: 12.73, h: 0, line: { color: NAVY, width: 2 } });
  s.addText(`기준일 ${baseDate}`, { x: 0.3, y: 0.8, w: 3, h: 0.25, fontFace: FONT, fontSize: 9, color: GRAY });

  const card = (x, y, w, h, item) => {
    const pw = Math.min(0.5, h * 0.75);
    s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: '9AA7BA', width: 0.75 } });
    const ph = photos[item.p.id];
    if (ph) s.addImage({ data: ph, x: x + 0.02, y: y + 0.02, w: pw - 0.04, h: h - 0.04, sizing: { type: 'cover', w: pw - 0.04, h: h - 0.04 } });
    else s.addText(item.p.name.charAt(0), { x, y, w: pw, h, fontFace: FONT, fontSize: 14, bold: true, color: NAVY, align: 'center', valign: 'middle', fill: { color: 'E3E9F2' } });
    const tx = x + pw, tw = w - pw, rh = h / 3;
    s.addText(item.label, { x: tx, y, w: tw, h: rh, fontFace: FONT, fontSize: 7.5, bold: !!item.lead, color: item.lead ? '5A3A00' : '2B3544', align: 'center', valign: 'middle', fill: { color: item.lead ? 'FFE7B0' : 'F4F6F9' } });
    s.addText(`${item.p.name} ${item.p.rank}`, { x: tx, y: y + rh, w: tw, h: rh, fontFace: FONT, fontSize: 8.5, bold: true, color: '16202E', align: 'center', valign: 'middle' });
    s.addText(item.p.phone || '', { x: tx, y: y + 2 * rh, w: tw, h: rh, fontFace: FONT, fontSize: 7.5, color: GRAY, align: 'center', valign: 'middle' });
  };

  // 상단 3자리
  const tw = 1.95, th = 0.62, gap = 0.45, topY = 1.15;
  const tx0 = (9.0 - (3 * tw + 2 * gap)) / 2 + 0.3;
  S.top.forEach((slot, i) => {
    const x = tx0 + i * (tw + gap);
    s.addText(slot.title, { x, y: topY - 0.25, w: tw, h: 0.22, fontFace: FONT, fontSize: 8, bold: true, color: NAVY, align: 'center' });
    if (slot.people.length) slot.people.forEach((it, k) => card(x, topY + k * (th + 0.06), tw, th, it));
    else s.addText('미지정', { x, y: topY, w: tw, h: th, fontFace: FONT, fontSize: 9, color: GRAY, align: 'center', valign: 'middle', line: { color: '9AA7BA', width: 0.75, dashType: 'dash' } });
    if (i > 0) s.addShape(pptx.ShapeType.line, { x: x - gap, y: topY + th / 2, w: gap, h: 0, line: { color: LINE, width: 2 } });
  });
  const topH = Math.max(...S.top.map(t => Math.max(1, t.people.length))) * (th + 0.06);
  const midX = tx0 + 1.5 * tw + gap;
  const sumRows = 1 + 2 * Math.ceil((S.summary.length + 1) / 5);
  const busY = Math.max(topY + topH + 0.3, 1.0 + sumRows * 0.24 + 0.2);
  s.addShape(pptx.ShapeType.line, { x: midX, y: topY + th, w: 0, h: busY - topY - th, line: { color: LINE, width: 2 } });

  // 투입 현황표
  const sum = [...S.summary, { k: '합계', v: S.total, total: true }];
  while (sum.length % 5) sum.push({ k: '', v: '' });
  const rows = [[{ text: '관리자 투입 현황', options: { colspan: 5, bold: true, color: 'FFFFFF', fill: { color: '2B3544' }, align: 'center' } }]];
  for (let i = 0; i < sum.length; i += 5) {
    const ch = sum.slice(i, i + 5);
    rows.push(ch.map(c => ({ text: c.k, options: { bold: true, align: 'center', fill: { color: c.total ? 'FFE88A' : 'E3E9F2' } } })));
    rows.push(ch.map(c => ({ text: c.v === '' ? '' : c.v + ' 명', options: { align: 'center', bold: !!c.total, fill: { color: c.total ? 'FFF8D6' : 'FFFFFF' } } })));
  }
  s.addTable(rows, { x: 9.35, y: 1.0, w: 3.7, colW: Array(5).fill(0.74), fontFace: FONT, fontSize: 8, rowH: 0.24, border: { type: 'solid', color: '9AA7BA', pt: 0.5 } });

  // 직무별 칸
  const n = Math.max(1, S.cols.length), left = 0.3, width = 12.73, cg = 0.12;
  const cw = (width - cg * (n - 1)) / n;
  const maxRows = Math.max(1, ...S.cols.map(c => c.list.length));
  const headY = busY + 0.2, firstY = headY + 0.38;
  const ch = Math.min(0.62, (7.35 - firstY) / maxRows - 0.06);
  s.addShape(pptx.ShapeType.line, { x: left + cw / 2, y: busY, w: (n - 1) * (cw + cg), h: 0, line: { color: LINE, width: 2 } });
  S.cols.forEach((c, i) => {
    const x = left + i * (cw + cg);
    s.addShape(pptx.ShapeType.line, { x: x + cw / 2, y: busY, w: 0, h: headY - busY, line: { color: LINE, width: 2 } });
    s.addText(`${c.job}  ${c.list.length}`, { x, y: headY, w: cw, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fill: { color: BLUE } });
    c.list.forEach((it, k) => card(x, firstY + k * (ch + 0.06), cw, ch, it));
  });

  await pptx.writeFile({ fileName: `조직도_${S.site}_${baseDate}.pptx` });
}
