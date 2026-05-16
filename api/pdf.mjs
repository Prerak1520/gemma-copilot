function escapePdf(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\t]/g, ' ');
}

function wrapLine(line, max = 92) {
  const words = String(line || '').replace(/^#+\s*/, '').split(/\s+/).filter(Boolean);
  const out = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [''];
}

function markdownToLines(markdown) {
  const lines = [];
  for (const rawLine of String(markdown || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      lines.push('');
      continue;
    }
    const normalized = line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^- /, '• ');
    lines.push(...wrapLine(normalized));
  }
  return lines;
}

function buildPage(lines) {
  let y = 760;
  const commands = ['BT', '/F1 10 Tf', '50 760 Td', '14 TL'];
  for (const line of lines) {
    if (line) commands.push(`(${escapePdf(line)}) Tj`);
    commands.push('T*');
    y -= 14;
    if (y < 60) break;
  }
  commands.push('ET');
  return commands.join('\n');
}

export function renderMarkdownPdf(markdown) {
  const allLines = markdownToLines(markdown);
  const pages = [];
  for (let i = 0; i < allLines.length; i += 50) {
    pages.push(buildPage(allLines.slice(i, i + 50)));
  }
  if (!pages.length) pages.push(buildPage(['Empty resume']));

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`
  ];

  pages.forEach((content, index) => {
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
