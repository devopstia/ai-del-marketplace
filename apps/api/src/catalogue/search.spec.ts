import { searchWhere } from './catalogue.service';

describe('catalogue searchWhere', () => {
  it('requires every word and searches the curriculum too', () => {
    const w = searchWhere('MCP servers') as { AND: { OR: Record<string, unknown>[] }[] };
    expect(w.AND).toHaveLength(2);
    const fields = w.AND[0].OR.map((o) => Object.keys(o)[0]);
    expect(fields).toEqual(['title', 'subtitle', 'description', 'instructor', 'sections', 'sections']);
    expect(JSON.stringify(w.AND[0])).toContain('"contains":"mcp"');
    expect(JSON.stringify(w.AND[1])).toContain('"contains":"server"'); // plural stemmed
    expect(JSON.stringify(w.AND[0].OR[5])).toContain('lectures');
  });

  it('ignores punctuation and empty input, caps the number of words', () => {
    expect(searchWhere('   ')).toEqual({});
    const k = searchWhere('“Kubernetes,”') as { AND: { OR: unknown[] }[] };
    expect(k.AND).toHaveLength(1);
    expect(k.AND[0].OR).toContainEqual({ title: { contains: 'kubernete', mode: 'insensitive' } }); // stemmed; still matches "Kubernetes"
    expect((searchWhere('a b c d e f g h') as { AND: unknown[] }).AND).toHaveLength(6);
    expect(JSON.stringify(searchWhere('class'))).toContain('"contains":"class"'); // no stemming of -ss
  });
});
