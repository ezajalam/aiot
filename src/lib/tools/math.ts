const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  τ: Math.PI * 2,
  tau: Math.PI * 2,
};

const FUNS: Record<string, (n: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  exp: Math.exp,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sign: Math.sign,
};

function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error("Factorial needs a non-negative integer");
  }
  if (n > 170) throw new Error("Factorial overflow");
  let r = 1;
  for (let i = 2; i <= n; i += 1) r *= i;
  return r;
}

type Tok =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "id"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

const PREC: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2,
  "^": 3,
  "u-": 4,
  "!": 5,
};

function tokenize(src: string): Tok[] {
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, "pi").replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if ((c >= "0" && c <= "9") || c === ".") {
      const m = s.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/i);
      if (!m) throw new Error("Bad number");
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z]/i.test(c)) {
      const m = s.slice(i).match(/^[a-z]+/i);
      out.push({ t: "id", v: m![0]!.toLowerCase() });
      i += m![0]!.length;
      continue;
    }
    if (c === "(") {
      out.push({ t: "lp" });
      i += 1;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rp" });
      i += 1;
      continue;
    }
    if (c === ",") {
      out.push({ t: "comma" });
      i += 1;
      continue;
    }
    if ("+-*/%^!".includes(c)) {
      out.push({ t: "op", v: c });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return out;
}

function toRpn(tokens: Tok[]): Tok[] {
  const out: Tok[] = [];
  const ops: Tok[] = [];
  let prev: Tok | null = null;
  for (const tok of tokens) {
    if (tok.t === "num" || tok.t === "id") {
      out.push(tok);
      prev = tok;
      continue;
    }
    if (tok.t === "op") {
      let op = tok.v;
      const unary =
        op === "-" &&
        (prev === null || prev.t === "op" || prev.t === "lp" || prev.t === "comma");
      if (unary) op = "u-";
      const token: Tok = { t: "op", v: op };
      while (ops.length) {
        const top = ops[ops.length - 1]!;
        if (top.t !== "op") break;
        const pTop = PREC[top.v] ?? 0;
        const pNow = PREC[op] ?? 0;
        const right = op === "^" || op === "u-";
        if (pTop > pNow || (pTop === pNow && !right)) out.push(ops.pop()!);
        else break;
      }
      ops.push(token);
      prev = token;
      continue;
    }
    if (tok.t === "lp") {
      ops.push(tok);
      prev = tok;
      continue;
    }
    if (tok.t === "comma") {
      while (ops.length && ops[ops.length - 1]!.t !== "lp") out.push(ops.pop()!);
      prev = tok;
      continue;
    }
    if (tok.t === "rp") {
      while (ops.length && ops[ops.length - 1]!.t !== "lp") out.push(ops.pop()!);
      if (!ops.length) throw new Error("Mismatched parentheses");
      ops.pop();
      if (ops.length && ops[ops.length - 1]!.t === "id") out.push(ops.pop()!);
      prev = tok;
    }
  }
  while (ops.length) {
    const t = ops.pop()!;
    if (t.t === "lp" || t.t === "rp") throw new Error("Mismatched parentheses");
    out.push(t);
  }
  return out;
}

function evalRpn(rpn: Tok[]): number {
  const st: number[] = [];
  for (const tok of rpn) {
    if (tok.t === "num") {
      st.push(tok.v);
      continue;
    }
    if (tok.t === "id") {
      if (tok.v in CONSTANTS) {
        st.push(CONSTANTS[tok.v]!);
        continue;
      }
      if (tok.v in FUNS) {
        const a = st.pop();
        if (a === undefined) throw new Error("Missing argument");
        const r = FUNS[tok.v]!(a);
        if (!Number.isFinite(r)) throw new Error("Domain error");
        st.push(r);
        continue;
      }
      throw new Error(`Unknown name: ${tok.v}`);
    }
    if (tok.t === "op") {
      if (tok.v === "u-") {
        const a = st.pop();
        if (a === undefined) throw new Error("Missing operand");
        st.push(-a);
        continue;
      }
      if (tok.v === "!") {
        const a = st.pop();
        if (a === undefined) throw new Error("Missing operand");
        st.push(factorial(a));
        continue;
      }
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) throw new Error("Missing operand");
      let r = 0;
      if (tok.v === "+") r = a + b;
      else if (tok.v === "-") r = a - b;
      else if (tok.v === "*") r = a * b;
      else if (tok.v === "/") {
        if (b === 0) throw new Error("Division by zero");
        r = a / b;
      } else if (tok.v === "%") r = a % b;
      else if (tok.v === "^") r = a ** b;
      else throw new Error("Unknown operator");
      if (!Number.isFinite(r)) throw new Error("Overflow");
      st.push(r);
    }
  }
  if (st.length !== 1) throw new Error("Incomplete expression");
  return st[0]!;
}

export function evaluateExpression(expr: string): number {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error("Enter an expression");
  return evalRpn(toRpn(tokenize(trimmed)));
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  if (Object.is(n, -0)) return "0";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-10 || abs >= 1e12)) return n.toExponential(8);
  const s = n.toPrecision(12);
  return String(Number(s));
}
