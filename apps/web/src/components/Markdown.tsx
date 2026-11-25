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

export function Markdown({ source, className = "prose-del" }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        const h = lines[0]!.match(/^(#{1,4})\s+(.*)$/);
        if (h && lines.length === 1) return h[1]!.length <= 2 ? <h2 key={bi}>{inline(h[2]!, `h${bi}`)}</h2> : <h3 key={bi}>{inline(h[2]!, `h${bi}`)}</h3>;
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `u${bi}${li}`)}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={bi} className="list-decimal pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `o${bi}${li}`)}</li>)}</ol>;
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li ? <br /> : null}{inline(l, `p${bi}${li}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}
