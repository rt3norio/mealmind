import type { ReactNode } from 'react';

// Minimal, safe Markdown renderer — builds React elements (no HTML injection).
// Covers what a chat model typically emits: #/##/### headings, - / * and 1.
// lists, **bold**, *italic* / _italic_, `code`, and paragraphs.

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={k++}>{m[3]}</em>);
    else if (m[4] != null) nodes.push(<em key={k++}>{m[4]}</em>);
    else if (m[5] != null) nodes.push(<code key={k++}>{m[5]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const lvl = Math.min(h[1].length + 2, 4);
      const Tag = (`h${lvl}` as 'h3') ;
      blocks.push(<Tag key={blocks.length}>{renderInline(h[2])}</Tag>);
    } else if (ul) {
      if (list && !list.ordered) list.items.push(ul[1]);
      else {
        flush();
        list = { ordered: false, items: [ul[1]] };
      }
    } else if (ol) {
      if (list && list.ordered) list.items.push(ol[1]);
      else {
        flush();
        list = { ordered: true, items: [ol[1]] };
      }
    } else if (line === '') {
      flush();
    } else {
      flush();
      blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
    }
  }
  flush();
  return <div className="md">{blocks}</div>;
}
