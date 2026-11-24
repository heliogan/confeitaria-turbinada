// Markdown restrito para instruções de receitas. Nunca interpreta HTML fornecido pelo utilizador.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
export function renderInline(value) {
  let html = escapeHtml(value);
  // Não permitir Markdown de links, imagens ou HTML arbitrário.
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return html;
}
export function renderPreparation(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return '';
  const lines = markdown.replace(/\r\n?/g,'\n').split('\n');
  const output = [];
  let listType = null, paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      output.push('<p>' + paragraph.map(renderInline).join('<br>') + '</p>');
      paragraph = [];
    }
  };
  const closeList = () => { if (listType) { output.push('</'+listType+'>'); listType = null; } };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); closeList(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(heading[1].length + 1, 4);
      output.push('<h'+level+'>'+renderInline(heading[2])+'</h'+level+'>');
      continue;
    }
    const bullet = /^[-+]\s+(.+)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (listType !== type) { closeList(); output.push('<'+type+'>'); listType = type; }
      output.push('<li>'+renderInline((bullet||numbered)[1])+'</li>');
      continue;
    }
    closeList();
    paragraph.push(trimmed);
  }
  flushParagraph();closeList();
  return output.join('');
}
export function insertMarkdown(text, start, end, kind) {
  const value = String(text ?? '');
  const a = Math.max(0,Math.min(start,value.length));
  const b = Math.max(a,Math.min(end,value.length));
  const selected = value.slice(a,b);
  const formats = {
    bold: ['**','**','texto'],
    italic: ['*','*','texto'],
    heading: ['## ','','Título'],
    bullet: ['- ','','Item'],
    numbered: ['1. ','','Passo']
  };
  const format = formats[kind];
  if (!format) throw new Error('Formatação desconhecida');
  const [before,after,placeholder] = format;
  const insertion = before + (selected||placeholder) + after;
  return {
    text:value.slice(0,a)+insertion+value.slice(b),
    selectionStart:a+before.length,
    selectionEnd:a+before.length+(selected||placeholder).length
  };
}
