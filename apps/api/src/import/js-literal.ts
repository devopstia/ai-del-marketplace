/**
 * A tiny, safe reader for JavaScript LITERALS inside source files we must not execute (the DEL tutorial sources
 * and the video plan). It understands strings ("…", '…', `…` without ${}), numbers, true/false/null/undefined,
 * arrays, objects with plain keys, comments and trailing commas, plus calls to explicitly allowed function names
 * (e.g. `E(...)` in plan.mjs), returned as { call, args }. Anything else (identifiers, member access, functions,
 * spreads, template interpolation) is a ParseError: nothing is ever evaluated.
 */
export class ParseError extends Error {}

export interface Call {
  call: string;
  args: unknown[];
}

export function isCall(v: unknown): v is Call {
  return !!v && typeof v === 'object' && 'call' in v && 'args' in v && Array.isArray((v as Call).args);
}

export class LiteralReader {
  pos: number;
  constructor(
    readonly src: string,
    start = 0,
    private readonly calls: ReadonlySet<string> = new Set(),
  ) {
    this.pos = start;
  }

  private fail(msg: string): never {
    const line = this.src.slice(0, this.pos).split('\n').length;
    throw new ParseError(`${msg} at line ${line}`);
  }

  skipSpace() {
    const s = this.src;
    for (;;) {
      const c = s[this.pos];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.pos++;
      else if (c === '/' && s[this.pos + 1] === '/') {
        const nl = s.indexOf('\n', this.pos);
        this.pos = nl < 0 ? s.length : nl + 1;
      } else if (c === '/' && s[this.pos + 1] === '*') {
        const end = s.indexOf('*/', this.pos + 2);
        if (end < 0) this.fail('Unterminated comment');
        this.pos = end + 2;
      } else return;
    }
  }

  peek() {
    this.skipSpace();
    return this.src[this.pos];
  }

  expect(ch: string) {
    if (this.peek() !== ch) this.fail(`Expected "${ch}"`);
    this.pos++;
  }

  value(): unknown {
    const c = this.peek();
    if (c === '[') return this.array();
    if (c === '{') return this.object();
    if (c === '"' || c === "'") return this.string(c);
    if (c === '`') return this.template();
    if (c === '-' || (c >= '0' && c <= '9') || c === '.') return this.number();
    const id = this.identifier();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;
    if (id === 'undefined') return undefined;
    if (this.calls.has(id) && this.peek() === '(') return this.call(id);
    this.fail(`Unsupported expression "${id || c}"`);
  }

  private identifier(): string {
    const m = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.pos, this.pos + 200));
    if (!m) return '';
    this.pos += m[0].length;
    return m[0];
  }

  private call(name: string): Call {
    this.expect('(');
    const args: unknown[] = [];
    while (this.peek() !== ')') {
      args.push(this.value());
      if (this.peek() === ',') this.pos++;
      else if (this.peek() !== ')') this.fail('Expected "," or ")"');
    }
    this.pos++;
    return { call: name, args };
  }

  private array(): unknown[] {
    this.expect('[');
    const out: unknown[] = [];
    while (this.peek() !== ']') {
      if (this.src.startsWith('...', this.pos)) this.fail('Spread is not supported');
      out.push(this.value());
      if (this.peek() === ',') this.pos++;
      else if (this.peek() !== ']') this.fail('Expected "," or "]"');
    }
    this.pos++;
    return out;
  }

  private object(): Record<string, unknown> {
    this.expect('{');
    const out: Record<string, unknown> = Object.create(null);
    while (this.peek() !== '}') {
      const c = this.peek();
      let key: string;
      if (c === '"' || c === "'") key = this.string(c);
      else if (c >= '0' && c <= '9') key = String(this.number());
      else {
        key = this.identifier();
        if (!key) this.fail('Expected a property name');
      }
      if (this.peek() !== ':') this.fail(`Shorthand or method property "${key}" is not supported`);
      this.pos++;
      if (key === '__proto__') this.fail('"__proto__" is not allowed');
      out[key] = this.value();
      if (this.peek() === ',') this.pos++;
      else if (this.peek() !== '}') this.fail('Expected "," or "}"');
    }
    this.pos++;
    return { ...out };
  }

  private number(): number {
    const m = /^-?(?:0[xX][0-9a-fA-F_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)/.exec(this.src.slice(this.pos, this.pos + 64));
    if (!m) this.fail('Bad number');
    this.pos += m[0].length;
    const n = Number(m[0].replace(/_/g, ''));
    if (!Number.isFinite(n)) this.fail('Bad number');
    return n;
  }

  private escape(): string {
    const s = this.src;
    const c = s[this.pos++];
    switch (c) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'v': return '\v';
      case '0': return '\0';
      case '\n': return '';
      case '\r': if (s[this.pos] === '\n') this.pos++; return '';
      case 'x': {
        const h = s.slice(this.pos, this.pos + 2);
        if (!/^[0-9a-fA-F]{2}$/.test(h)) this.fail('Bad \\x escape');
        this.pos += 2;
        return String.fromCharCode(parseInt(h, 16));
      }
      case 'u': {
        if (s[this.pos] === '{') {
          const end = s.indexOf('}', this.pos);
          const h = s.slice(this.pos + 1, end);
          if (end < 0 || !/^[0-9a-fA-F]{1,6}$/.test(h)) this.fail('Bad \\u{} escape');
          this.pos = end + 1;
          return String.fromCodePoint(parseInt(h, 16));
        }
        const h = s.slice(this.pos, this.pos + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(h)) this.fail('Bad \\u escape');
        this.pos += 4;
        return String.fromCharCode(parseInt(h, 16));
      }
      default:
        if (c === undefined) this.fail('Unterminated string');
        return c;
    }
  }

  private string(quote: string): string {
    this.pos++;
    let out = '';
    for (;;) {
      const c = this.src[this.pos++];
      if (c === undefined || c === '\n') this.fail('Unterminated string');
      if (c === quote) return out;
      out += c === '\\' ? this.escape() : c;
    }
  }

  private template(): string {
    this.pos++;
    let out = '';
    for (;;) {
      const c = this.src[this.pos++];
      if (c === undefined) this.fail('Unterminated template');
      if (c === '`') return out;
      if (c === '$' && this.src[this.pos] === '{') this.fail('Template interpolation is not supported');
      out += c === '\\' ? this.escape() : c;
    }
  }
}

/** Parses one literal starting at `index` (whitespace/comments allowed before it). */
export function parseLiteralAt(src: string, index: number, calls: string[] = []) {
  const r = new LiteralReader(src, index, new Set(calls));
  const value = r.value();
  return { value, end: r.pos };
}

/**
 * Finds `name(` in source (outside comments: the match must start a statement-ish position) and parses its
 * FIRST argument as a literal. Returns null when the call is not present.
 */
export function firstArgOfCall(src: string, name: string): unknown | null {
  const re = new RegExp(`(^|[^\\w$.])${name.replace(/[$]/g, '\\$')}\\s*\\(`, 'gm');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const before = src.slice(lineStart, m.index + m[1].length);
    if (/\/\/|^\s*\*/.test(before)) continue; // inside a line comment / doc comment
    if (/^\s*(import|export\s*\{)/.test(before)) continue;
    return parseLiteralAt(src, m.index + m[0].length).value;
  }
  return null;
}

/** Value of the first `key: <string literal>` inside `export default {` … (other properties are skipped, never parsed). */
export function defaultExportString(src: string, key: string): string | null {
  const start = src.search(/export\s+default\s*\{/);
  if (start < 0) return null;
  const re = new RegExp(`[{,\\s]${key}\\s*:\\s*`, 'g');
  re.lastIndex = start;
  const m = re.exec(src);
  if (!m) return null;
  try {
    const v = parseLiteralAt(src, m.index + m[0].length).value;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}
