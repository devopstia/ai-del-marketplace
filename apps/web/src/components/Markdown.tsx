import { Fragment } from "react";

/** Minimal, safe markdown: headings, paragraphs, bullet/numbered lists, **bold**, *italic*, `code`, [links](https://…). No raw HTML. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) out.push(<a key={k} className="link" href={m[2]} rel="noopener noreferrer" target="_blank">{t.slice(1, t.indexOf("]"))}</a>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "h2" | "h3" | "ul" | "ol" | "p"; lines: string[] };

/** Line-based: a heading, list item or paragraph line starts or continues a block; blank lines end it. */
function parse(source: string): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) { cur = null; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push({ kind: h[1]!.length <= 2 ? "h2" : "h3", lines: [h[2]!] }); cur = null; continue; }
    const ul = l.match(/^\s*[-*]\s+(.*)$/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
    const kind = ul ? "ul" : ol ? "ol" : "p";
    const text = ul ? ul[1]! : ol ? ol[1]! : l;
    if (cur && cur.kind === kind) cur.lines.push(text);
    else if (cur && kind === "p" && cur.kind !== "p") cur.lines[cur.lines.length - 1] += ` ${text.trim()}`; // a wrapped list item
    else { cur = { kind, lines: [text] }; out.push(cur); }
  }
  return out;
}

export function Markdown({ source, className = "prose-del" }: { source: string; className?: string }) {
  return (
    <div className={className}>
      {parse(source).map((b, bi) => {
        if (b.kind === "h2") return <h2 key={bi}>{inline(b.lines[0]!, `h${bi}`)}</h2>;
        if (b.kind === "h3") return <h3 key={bi}>{inline(b.lines[0]!, `h${bi}`)}</h3>;
        if (b.kind === "ul") return <ul key={bi}>{b.lines.map((l, li) => <li key={li}>{inline(l, `u${bi}${li}`)}</li>)}</ul>;
        if (b.kind === "ol") return <ol key={bi} className="list-decimal pl-5">{b.lines.map((l, li) => <li key={li}>{inline(l, `o${bi}${li}`)}</li>)}</ol>;
        return <p key={bi}>{b.lines.map((l, li) => <Fragment key={li}>{li ? <br /> : null}{inline(l, `p${bi}${li}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}
