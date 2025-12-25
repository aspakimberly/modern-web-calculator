/* =========================
   Royal Calculator JS (Expression-first)
   - Big display shows the LIVE expression: "9 × 9"
   - Top display only shows LAST evaluated expression after "="
   - Supports negatives, decimals, %, backspace
   - No eval(); uses a simple tokenizer + left-to-right evaluation
     (matches many basic calculators; no operator precedence)
   ========================= */

const exprEl  = document.getElementById("expr");   // small/top line (history)
const valueEl = document.getElementById("value");  // big/main line (live)

let live = "0";           // what user is currently typing (full expression)
let history = "";         // last evaluated expression (shown on top)
let justEvaluated = false;

const OPS = new Set(["+", "-", "×", "÷"]);

function render() {
  // Top line: only show after equals (or if you want: show history always)
  exprEl.textContent = history;

  // Big line: always show live expression/result
  valueEl.textContent = live;
}

function clampDisplay(n) {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e12 || abs < 1e-9) return n.toPrecision(10).replace(/\.?0+$/, "");
  const s = n.toString();
  if (s.length <= 14) return s;
  return n.toPrecision(12).replace(/\.?0+$/, "");
}

function isOperatorChar(ch) {
  return OPS.has(ch);
}

function lastChar() {
  return live.slice(-1);
}

function clearAll() {
  live = "0";
  history = "";
  justEvaluated = false;
  render();
}

function backspace() {
  if (justEvaluated) {
    // after "=", backspace resets to 0 like many calculators
    live = "0";
    justEvaluated = false;
    render();
    return;
  }

  if (live.length <= 1) {
    live = "0";
  } else {
    live = live.slice(0, -1);
    // avoid ending in empty
    if (live === "" || live === "-") live = "0";
  }
  render();
}

function normalizeSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

function appendDigit(d) {
  // if result shown and user starts typing a number, start fresh
  if (justEvaluated && (live === "0" || !live.includes(" "))) {
    live = "0";
    justEvaluated = false;
  }

  // Keep expression spaced like: "9 × 9"
  // live tokens are separated by spaces around operators.
  if (d === ".") {
    // Prevent multiple decimals in the current number token
    const parts = normalizeSpaces(live).split(" ");
    const last = parts[parts.length - 1];
    if (isOperatorChar(last)) {
      // operator then decimal => start "0."
      parts.push("0.");
      live = parts.join(" ");
      render();
      return;
    }
    if (last.includes(".")) return;
    parts[parts.length - 1] = (last === "" ? "0." : last + ".");
    live = parts.join(" ");
    render();
    return;
  }

  // digit 0-9
  const parts = normalizeSpaces(live).split(" ");
  let last = parts[parts.length - 1];

  if (isOperatorChar(last)) {
    parts.push(d);
    live = parts.join(" ");
    render();
    return;
  }

  // Handle leading zero in a number token
  if (last === "0") last = d;
  else if (last === "-0") last = "-" + d;
  else last = last + d;

  parts[parts.length - 1] = last;
  live = parts.join(" ");
  render();
}

function appendOperator(op) {
  // allow unary minus: start negative number
  if (op === "-") {
    const s = normalizeSpaces(live);
    if (s === "0") {
      live = "-0";
      justEvaluated = false;
      render();
      return;
    }
    // if last token is operator, treat '-' as unary next number
    const parts = s.split(" ");
    const last = parts[parts.length - 1];
    if (isOperatorChar(last)) {
      parts.push("-0");
      live = parts.join(" ");
      justEvaluated = false;
      render();
      return;
    }
  }

  // If just evaluated and user presses operator, keep the result as first operand
  if (justEvaluated) {
    justEvaluated = false;
  }

  const s = normalizeSpaces(live);
  const parts = s.split(" ");
  const last = parts[parts.length - 1];

  // If last token is operator, replace it (operator change)
  if (isOperatorChar(last)) {
    parts[parts.length - 1] = op;
    live = parts.join(" ");
    render();
    return;
  }

  // If last token is incomplete negative starter like "-0" and user hasn't typed digits beyond 0,
  // still allow operator after it.
  live = parts.join(" ") + " " + op;
  render();
}

function percent() {
  // Apply percent to the last number token only
  const s = normalizeSpaces(live);
  const parts = s.split(" ");
  if (parts.length === 0) return;

  const last = parts[parts.length - 1];
  if (isOperatorChar(last)) return;

  const n = Number(last);
  if (!Number.isFinite(n)) return;

  parts[parts.length - 1] = clampDisplay(n / 100);
  live = parts.join(" ");
  justEvaluated = false;
  render();
}

/* =========================
   Expression evaluation (left-to-right)
   Tokens: number op number op number ...
   ========================= */
function tokenize(expr) {
  const parts = normalizeSpaces(expr).split(" ").filter(Boolean);
  return parts;
}

function computeLTR(tokens) {
  // Expect: number (op number)*
  if (tokens.length === 0) return NaN;

  let acc = Number(tokens[0]);
  if (!Number.isFinite(acc)) return NaN;

  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const rhsStr = tokens[i + 1];
    if (!operator || !rhsStr) return NaN;

    const rhs = Number(rhsStr);
    if (!Number.isFinite(rhs)) return NaN;

    if (operator === "+") acc = acc + rhs;
    else if (operator === "-") acc = acc - rhs;
    else if (operator === "×") acc = acc * rhs;
    else if (operator === "÷") acc = (rhs === 0 ? NaN : acc / rhs);
    else return NaN;
  }
  return acc;
}

function equals() {
  const tokens = tokenize(live);

  // If ends with an operator, ignore equals
  if (tokens.length >= 2 && isOperatorChar(tokens[tokens.length - 1])) return;

  // Must be odd length: n op n op n ...
  if (tokens.length % 2 === 0) return;

  const out = computeLTR(tokens);
  const result = clampDisplay(out);

  history = normalizeSpaces(live) + " =";
  live = result;

  justEvaluated = true;
  render();
}

/* =========================
   Bind UI
   ========================= */
document.querySelector(".keys").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const digit = btn.getAttribute("data-digit");
  const oper  = btn.getAttribute("data-op");
  const act   = btn.getAttribute("data-action");

  if (digit !== null) return appendDigit(digit);
  if (oper  !== null) return appendOperator(oper);

  if (act === "clear")   return clearAll();
  if (act === "back")    return backspace();
  if (act === "percent") return percent();
  if (act === "equals")  return equals();
});

/* Keyboard support */
window.addEventListener("keydown", (e) => {
  const k = e.key;

  if ((k >= "0" && k <= "9") || k === ".") return appendDigit(k);
  if (k === "+") return appendOperator("+");
  if (k === "-") return appendOperator("-");
  if (k === "*") return appendOperator("×");
  if (k === "/") return appendOperator("÷");
  if (k === "Enter" || k === "=") return equals();
  if (k === "Backspace") return backspace();
  if (k === "Escape") return clearAll();
  if (k === "%") return percent();
});

render();
