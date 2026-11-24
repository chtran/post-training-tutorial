const meta = {
  id: "serve",
  nav: "Quantize and serve",
  title: "Quantization and speculative decoding",
  question: "How does a 934 GiB checkpoint become a 4-GPU deployment, and how does a 1.93B-parameter helper make it decode 1.9× to 3.0× faster?",
  minutes: 17,
  takeaways: [
    "Both quantized checkpoints are made from the finished BF16 model without any further training. FP8 rounds almost every linear layer to 8 bits with no calibration data; NVFP4 rounds only the MoE experts to 4 bits and uses 32.8M tokens of agentic text to choose one scale per block of 16 weights.",
    "The memory saved on weights becomes KV cache. BF16 needs 8 GPUs for a 1M-token context; FP8 and NVFP4 fit it on 4, and 4-GPU NVFP4 delivers 6.0× the per-GPU throughput of 8-GPU BF16 at 50 tokens per second per user.",
    "Quantization costs little measured quality: FP8 recovers 99.93% and NVFP4 98.98% of the median benchmark score, and refusal rates stay within one point of BF16.",
    "The NVFP4 recipe was chosen by held-out KL divergence to the BF16 model, not by benchmarks, because benchmark differences between recipes (under 0.4% in the median) were swamped by noisy swings of up to 3.2 points on individual benchmarks.",
    "The drafter is sized for speed, not for acceptance. It trains on blocks of 16 but serves with blocks of 8, because the late positions of a block are rarely accepted and still cost verification compute.",
  ],
};

// ---------------------------------------------------------------- data (all from the report)
// Table 12.
const sizes = [
  { label: "BF16 (reference)", value: 933.81, valueLabel: "933.81 GiB" },
  { label: "FP8", value: 468.72, valueLabel: "468.72 GiB" },
  { label: "NVFP4", value: 273.5, valueLabel: "about 273.5 GiB" },
];
// Figure 37: labels printed in the figure. GiB per GPU; kvTok is replica-wide.
const GPU_GIB = 268.6;
const memory = [
  { d: "NVFP4 · 8 GPUs", w: 42, kv: 198, kvTok: "19.1M" },
  { d: "FP8 · 8 GPUs", w: 60, kv: 180, kvTok: "17.3M" },
  { d: "BF16 · 8 GPUs", w: 118, kv: 122, kvTok: "11.7M" },
  { d: "NVFP4 · 4 GPUs", w: 70, kv: 171, kvTok: "8.2M" },
  { d: "FP8 · 4 GPUs", w: 119, kv: 122, kvTok: "5.8M" },
  { d: "BF16 · 4 GPUs", w: 235, kv: null, kvTok: "213K" },
];
// Table 13. Columns: max scale, four-over-six, Local Hessian, Local Hessian + dense MLPs.
const recipeCols = ["Max scale", "Four-over-six", "Local Hessian (released)", "Local Hessian + dense MLPs"];
const fidelity = [
  { m: "Mean KL(BF16 || NVFP4), lower is better", v: [0.0315, 0.0308, 0.029, 0.0308], d: 4, low: true },
  { m: "Top-1 agreement", v: [96.66, 96.73, 96.82, 96.75], d: 2, unit: "%" },
];
const recipeBench = [
  { m: "LiveCodeBench v6", v: [87.7, 88.3, 88.3, 87.7] },
  { m: "GPQA Diamond", v: [90.0, 90.4, 89.3, 91.0] },
  { m: "AIME 2026", v: [98.0, 97.1, 97.5, 97.2] },
  { m: "AdvancedIF, complex single-turn", v: [85.8, 82.8, 86.1, 87.3] },
  { m: "AdvancedIF, system steerability", v: [34.7, 33.9, 35.1, 32.5] },
  { m: "AdvancedIF, carried context", v: [57.6, 57.1, 58.6, 59.1] },
  { m: "Chat arena (win rate)", v: [37.4, 38.2, 38.5, 37.7] },
  { m: "FACTS Grounding v2", v: [87.3, 86.9, 87.0, 86.8] },
  { m: "SimpleQA Verified (F-score)", v: [40.2, 38.3, 41.1, 40.7] },
  { m: "AA-LCR", v: [78.6, 78.4, 78.7, 78.1] },
];
const recipeMedian = ["99.7%", "99.6%", "100%", "99.7%"];
// Figure 36: quantized minus BF16, percentage points. [benchmark, FP8, NVFP4].
const benchDiff = [
  { g: "Agentic coding and terminal", rows: [
    ["SWE-bench Pro v2-Hard", 1.9, 2.1], ["SWE Atlas Codebase QnA", 0.4, -0.4], ["SWE-bench Pro v1", -0.2, -0.5],
    ["DeepSWE v1.1", -0.3, -0.6], ["SWE-bench Multilingual", -0.2, -0.8], ["SWE-bench Verified", -1.4, -0.9],
    ["Terminal Bench v2.1", -1.2, -1.7] ] },
  { g: "Reasoning", rows: [
    ["HLE (with tools)", 0.0, 0.0], ["LiveCodeBench", -0.2, 0.0], ["AIME 2026", 0.3, -0.2], ["CriPT AA", 1.1, -0.9],
    ["HLE (no tools)", 0.0, -1.2], ["GPQA Diamond", -0.3, -1.3], ["SciCode", -0.9, -2.3] ] },
  { g: "Tool calling and search", rows: [
    ["DeepSearchQA (context mgmt.)", -0.9, 0.6], ["AutomationBench (public split)", -1.1, 0.5], ["MCP Atlas", 0.7, -0.3],
    ["Tau3 Banking", 0.7, -0.7], ["BrowseComp (context mgmt.)", -0.1, -1.2] ] },
  { g: "General capabilities", rows: [ ["AA-LCR", 1.2, 0.5], ["LongBench v2", 0.1, -0.3], ["IFBench", 1.1, -0.4] ] },
];
// Table 15 (8K in / 1K out) and table 16 (AgentX replay).
const thr = [
  { d: "BF16 · 8", c8: 126, t50: 211, r50: "1.0×", t100: 137, r100: "1.0×" },
  { d: "FP8 · 8", c8: 128, t50: 325, r50: "1.5×", t100: 156, r100: "1.1×" },
  { d: "NVFP4 · 8", c8: 199, t50: 882, r50: "4.2×", t100: 477, r100: "3.5×" },
  { d: "FP8 · 4", c8: 102, t50: 331, r50: "1.6×", t100: 195, r100: "1.4×" },
  { d: "NVFP4 · 4", c8: 168, t50: 1263, r50: "6.0×", t100: 570, r100: "4.2×" },
];
const agentx = [
  { d: "BF16 · 8 GPUs", c8: 135, c64: 36, t50: "122 (1.0×)", ttft: 224 },
  { d: "FP8 · 8 GPUs", c8: 130, c64: 42, t50: "182 (1.5×)", ttft: 219 },
  { d: "NVFP4 · 8 GPUs", c8: 217, c64: 79, t50: "at least 296 (2.4×)", ttft: 189 },
  { d: "FP8 · 4 GPUs", c8: 99, c64: 28, t50: "204 (1.7×)", ttft: 211 },
  { d: "NVFP4 · 4 GPUs", c8: 184, c64: 51, t50: "at least 457 (3.7×)", ttft: 190 },
];
// Table 18.
const tauLen = [
  { len: "0–2K", tau: 5.72 }, { len: "2–4K", tau: 5.39 }, { len: "4–8K", tau: 4.91 }, { len: "8–16K", tau: 4.66 },
  { len: "16–32K", tau: 4.22 }, { len: "32–64K", tau: 4.58 }, { len: "64–128K", tau: 4.23 },
];
// Table 17.
const drafter = [
  { b: "GSM8K", kind: "grade-school math", ts: 5.6, tg: 5.88, s1: 3.03, s32: 2.75 },
  { b: "MATH-500", kind: "competition math", ts: 5.05, tg: 5.39, s1: 2.99, s32: 2.52 },
  { b: "HumanEval", kind: "code", ts: 4.58, tg: 4.68, s1: 2.54, s32: 2.34 },
  { b: "MBPP", kind: "code", ts: 4.19, tg: 4.32, s1: 2.3, s32: 2.21 },
  { b: "MT-Bench", kind: "chat", ts: 3.93, tg: 4.11, s1: 1.96, s32: 1.89 },
];

const fp8Code = `# Illustrative PyTorch-style sketch of the FP8 rule in
# section 4.5.1. It is not the report's code.
E4M3_MAX = 448.0     # largest finite 8-bit E4M3 value

def fp8_quantize(v):             # v: [rows, input_features]
    # one scale per row
    s = v.abs().amax(dim=1, keepdim=True) / E4M3_MAX
    # an all-zero row gets a positive fallback scale
    s = torch.where(s == 0, FALLBACK, s)
    # nearest representable 8-bit value
    q = round_to_e4m3(v / s)
    return s, q                  # the layer computes with s * q

# Weights:     a row is an output channel. Done once, at
#              conversion. No data needed.
# Activations: a row is a token. Redone at every quantized
#              layer on every forward pass.`;

const specCode = `# Illustrative sketch of one speculative-decoding step.
# It is not the report's code.

# Beam has already computed these hidden states.
feats = beam.hidden_states(layers=[4, 16, 28, 40, 46])[-4096:]
# One drafter pass proposes the whole block.
draft = drafter(feats, n_tokens=7)
# One Beam pass scores every drafted position.
p = beam.forward(context + draft)

# Accept guesses until the first disagreement.
#   greedy:   accept if draft[n] == argmax(p[n])
#   sampling: the rejection test in the equation above
n = 0
while n < len(draft) and accept(draft[n], p[n]):
    n += 1

# Keep the accepted prefix plus Beam's own next token.
context += draft[:n] + [beam_token(p[n])]
# Tokens gained this step: n + 1, between 1 and 8.
# The mean of that number over steps is tau.`;

// ---------------------------------------------------------------- small figure helpers
const fmtPP = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1);
const Dot = ({ color }) => color
  ? <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-[2px]" style={{ background: color }} />
  : <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-[2px] border border-primary bg-wash" />;
const Legend = ({ items }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-5 text-secondary">
    {items.map(([color, label]) => <span key={label} className="flex items-center gap-[6px]"><Dot color={color} />{label}</span>)}
  </div>
);
const Num = ({ children, className }) => <TableCell className={"text-right font-mono " + (className || "")}>{children}</TableCell>;

// Figure 37 redrawn from its printed labels.
function MemoryBars() {
  return (
    <div className="flex flex-col gap-2">
      <Legend items={[[chartColors[0], "Weights"], [chartColors[1], "KV cache pool"], [null, "Other reserved and unreserved"]]} />
      <div className="flex flex-col gap-[6px]">
        {memory.map((m) => (
          <div key={m.d} className="flex items-center gap-2 text-[12px] leading-5">
            <span className="w-[98px] shrink-0 text-secondary">{m.d}</span>
            <div className="flex h-[22px] min-w-0 grow overflow-hidden rounded-[4px] bg-wash">
              <div className="flex items-center justify-center font-mono text-[11px] font-semibold text-white" style={{ width: (m.w / GPU_GIB) * 100 + "%", background: chartColors[0] }}>{m.w}</div>
              {m.kv ? <div className="flex items-center justify-center font-mono text-[11px] font-semibold text-white" style={{ width: (m.kv / GPU_GIB) * 100 + "%", background: chartColors[1] }}>{m.kv}</div> : null}
            </div>
            <span className="w-[92px] shrink-0 whitespace-nowrap text-right font-mono text-[11.5px] text-primary">{m.kvTok} tokens</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Figure 36 redrawn from its printed labels: a diverging bar pair per benchmark.
function DiffBars() {
  const span = 3; // axis runs from -3 to +3 points
  const bar = (x, color) => (
    <div className="relative h-[6px]">
      <div className="absolute top-0 h-[6px] rounded-[1px]" style={{ background: color, left: (x >= 0 ? 50 : 50 + (x / span) * 50) + "%", width: Math.max((Math.abs(x) / span) * 50, 0.6) + "%" }} />
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <Legend items={[[chartColors[1], "FP8, FP8 KV cache (upper bar, first number)"], [chartColors[0], "NVFP4, BF16 KV cache (lower bar, second number)"]]} />
      {benchDiff.map((grp) => (
        <div key={grp.g} className="flex flex-col gap-[5px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{grp.g}</div>
          {grp.rows.map(([name, f, n]) => (
            <div key={name} className="flex items-center gap-2 text-[12px] leading-4">
              <span className="w-[150px] shrink-0 text-primary sm:w-[196px]">{name}</span>
              <div className="relative min-w-0 grow">
                <div className="absolute bottom-[-3px] left-1/2 top-[-3px] border-l border-primary" />
                <div className="flex flex-col gap-[2px]">{bar(f, chartColors[1])}{bar(n, chartColors[0])}</div>
              </div>
              <span className="w-[84px] shrink-0 text-right font-mono text-[11.5px] text-secondary">{fmtPP(f)} / {fmtPP(n)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2 text-[11px] text-secondary">
        <span className="w-[150px] shrink-0 sm:w-[196px]" />
        <div className="flex min-w-0 grow justify-between font-mono"><span>−3</span><span>0</span><span>+3</span></div>
        <span className="w-[84px] shrink-0 text-right">points</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- demo 1: rounding a block of 16 weights
const E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6]; // magnitudes a 4-bit E2M1 float can hold (standard format definition)
const E4M3 = (() => { // magnitudes an 8-bit E4M3 float can hold: 3 mantissa bits per power of two, up to 448
  const out = [0];
  for (let k = 1; k < 8; k++) out.push(k * Math.pow(2, -9));
  for (let e = -6; e <= 8; e++) for (let m = 0; m < 8; m++) { const x = (1 + m / 8) * Math.pow(2, e); if (x <= 448) out.push(x); }
  return out;
})();
const FORMATS = { e2m1: { grid: E2M1, top: 6, name: "4-bit E2M1" }, e4m3: { grid: E4M3, top: 448, name: "8-bit E4M3" } };
const nearest = (grid, a) => { let b = grid[0]; for (const g of grid) if (Math.abs(g - a) < Math.abs(b - a)) b = g; return b; };
const TOY_BLOCK = [0.1, -0.26, 0.41, -0.06, 0.55, -0.47, 0.18, 0.03, -0.78, 0.34, -0.14, 0.84, -0.36, 0.24, -0.59, 1.0];
function quantizeBlock(vals, fmt, c) {
  const f = FORMATS[fmt];
  const vmax = Math.max(...vals.map(Math.abs));
  const s = (c * vmax) / f.top; // c = 1 is the max scale: the largest weight lands on the largest grid point
  const q = vals.map((v) => Math.sign(v) * nearest(f.grid, Math.min(Math.abs(v) / s, f.top)) * s);
  const err = Math.sqrt(vals.reduce((a, v, i) => a + (v - q[i]) * (v - q[i]), 0) / vals.reduce((a, v) => a + v * v, 0));
  return { s, q, err, vmax };
}
function randomBlock(seed) { // made-up bell-shaped values, scaled so the largest magnitude is 1
  let t = seed * 2654435761 % 4294967296;
  const rnd = () => { t = (t * 1664525 + 1013904223) % 4294967296; return t / 4294967296; };
  const v = Array.from({ length: 16 }, () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.9);
  const m = Math.max(...v.map(Math.abs));
  return v.map((x) => Math.round((x / m) * 100) / 100);
}
function QuantDemo() {
  const [fmt, setFmt] = useState("e2m1");
  const [c, setC] = useState(1);
  const [seed, setSeed] = useState(0);
  const vals = useMemo(() => (seed === 0 ? TOY_BLOCK : randomBlock(seed)), [seed]);
  const cur = quantizeBlock(vals, fmt, c);
  const atMax = quantizeBlock(vals, fmt, 1);
  const best = useMemo(() => {
    let b = { c: 1, err: Infinity };
    for (let i = 50; i <= 160; i++) { const e = quantizeBlock(vals, fmt, i / 100).err; if (e < b.err - 1e-12) b = { c: i / 100, err: e }; }
    return b;
  }, [vals, fmt]);
  const f = FORMATS[fmt];
  const W = 640, H = 118, PAD = 14, LIM = 1.7;
  const x = (v) => PAD + ((v + LIM) / (2 * LIM)) * (W - 2 * PAD);
  const ticks = [];
  f.grid.forEach((g) => { const v = g * cur.s; if (v <= LIM) { ticks.push(v); if (g > 0) ticks.push(-v); } });
  const clipped = vals.filter((v) => Math.abs(v) > f.top * cur.s + 1e-9).length;
  const stat = (label, value, sub) => (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg bg-wash px-3 py-2">
      <span className="text-[11.5px] leading-4 text-secondary">{label}</span>
      <span className="font-mono text-[17px] leading-7 text-primary">{value}</span>
      <span className="text-[11.5px] leading-4 text-secondary">{sub}</span>
    </div>
  );
  return (
    <Demo title="Round one block of 16 weights"
      takeaway={<>With 8 bits the grid is so fine that the error is small at any scale and the best scale gains only a fraction of a point, which is why FP8 can simply round. With 4 bits
      there are only 15 grid points, widely spaced at the top, so where the scale puts them changes the error by several points and the max scale is often not the best choice. That is the gap a search over scales exploits. The weights are made up; the demo scores plain weight error and ignores that
      a real NVFP4 block scale is itself rounded to FP8, whereas the released recipe scores the error of the layer's output on calibration data.</>}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SegmentedControl value={fmt} onValueChange={(v) => { if (v) { setFmt(v); setC(1); } }} size="small">
          <SegmentedControlItem value="e2m1">4-bit E2M1 (NVFP4)</SegmentedControlItem>
          <SegmentedControlItem value="e4m3">8-bit E4M3 (FP8)</SegmentedControlItem>
        </SegmentedControl>
        <Button variant="secondary" size="sm" onClick={() => setC(best.c)}>Jump to lowest error</Button>
        <Button variant="secondary" size="sm" onClick={() => { setSeed(seed + 1); setC(1); }}>New random block</Button>
      </div>
      <Slider label="Scale, relative to the max scale" value={c} min={0.5} max={1.6} step={0.01} onChange={setC} fmt={(v) => "×" + v.toFixed(2)} />
      <svg viewBox={"0 0 " + W + " " + H} className="w-full text-secondary" role="img" aria-label="Sixteen weights and the grid points they round to">
        <text x={PAD} y={12} fontSize="11" fill="currentColor">original weights</text>
        <text x={PAD} y={H - 4} fontSize="11" fill="currentColor">representable values at this scale ({ticks.length} within view)</text>
        <line x1={PAD} x2={W - PAD} y1={84} y2={84} stroke="currentColor" strokeOpacity="0.5" />
        {ticks.map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1={76} y2={92} stroke="currentColor" strokeOpacity={fmt === "e2m1" ? 0.9 : 0.35} strokeWidth={fmt === "e2m1" ? 1.4 : 0.6} />)}
        {vals.map((v, i) => {
          const clip = Math.abs(v) > f.top * cur.s + 1e-9;
          const col = clip ? "rgb(var(--text-red))" : chartColors[0];
          return (
            <g key={i}>
              <line x1={x(v)} y1={30} x2={x(cur.q[i])} y2={84} stroke={col} strokeWidth="1.2" strokeOpacity="0.75" />
              <circle cx={x(v)} cy={30} r="4" fill={col} />
              <circle cx={x(cur.q[i])} cy={84} r="3" fill={col} />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2">
        {stat("Rounding error at this scale", pct(cur.err, 1), clipped ? clipped + " weight" + (clipped > 1 ? "s" : "") + " clipped (red)" : "no weight clipped")}
        {stat("At the max scale (×1.00)", pct(atMax.err, 1), "largest weight on the top grid point")}
        {stat("Lowest in the sweep", pct(best.err, 1), "at ×" + best.c.toFixed(2) + ", " + ((atMax.err - best.err) * 100).toFixed(1) + " points below max scale")}
      </div>
      <Small>Error is the root-mean-square difference between the 16 weights and their rounded values, divided by the root-mean-square
      weight. Each slanted line joins a weight (top) to the grid point it rounds to (bottom).</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------- figure: one verification step (toy tokens)
function Tok({ children, tone }) {
  const cls = tone === "ok" ? "bg-tint-green text-green" : tone === "bad" ? "bg-tint-red text-red line-through" : tone === "beam" ? "bg-tint-blue text-blue" : tone === "drop" ? "bg-wash text-secondary line-through" : "bg-wash text-primary";
  return <span className={"whitespace-pre rounded px-[6px] py-[2px] font-mono text-[12.5px] leading-5 " + cls}>{children}</span>;
}
function StepFigure() {
  const row = (label, toks) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-[2px] text-[12.5px] leading-5 text-secondary sm:w-[150px]">{label}</span>
      <div className="flex flex-wrap gap-[5px]">{toks}</div>
    </div>
  );
  const draft = ["is", "Canberra", ",", "not", "Melbourne", "or", "Sydney"];
  return (
    <div className="flex flex-col gap-3">
      {row("Text so far", [<Tok key="c">The capital of Australia</Tok>])}
      {row("1. Drafter proposes 7", draft.map((t) => <Tok key={t}>{t}</Tok>))}
      {row("2. Beam checks all 7 at once", draft.map((t, i) => <Tok key={t} tone={i < 4 ? "ok" : i === 4 ? "bad" : "drop"}>{t}</Tok>))}
      {row("3. Kept this step", [...draft.slice(0, 4).map((t) => <Tok key={t} tone="ok">{t}</Tok>), <Tok key="b" tone="beam">Sydney</Tok>])}
      <Legend items={[["rgb(var(--text-green))", "accepted draft token"], ["rgb(var(--text-red))", "first rejected token"], ["rgb(var(--text-blue))", "Beam's own token, from the same pass"]]} />
    </div>
  );
}

// ---------------------------------------------------------------- figure: how the drafter is wired to Beam
function Box({ title, lines, tint }) {
  return (
    <div className={"flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-3 py-[10px] " + (tint ? "bg-tint-blue" : "bg-wash")}>
      <span className="text-[13px] font-semibold leading-5 text-primary">{title}</span>
      {lines.map((l, i) => <span key={i} className="text-[12.5px] leading-5 text-secondary">{l}</span>)}
    </div>
  );
}
const Arrow = ({ label }) => (
  <div className="flex shrink-0 flex-row items-center justify-center gap-1 text-secondary sm:w-[74px] sm:flex-col">
    <span className="text-center text-[11px] leading-4">{label}</span>
    <svg width="34" height="12" viewBox="0 0 34 12" className="rotate-90 sm:rotate-0" aria-hidden="true"><path d="M1 6h30M26 1.5 31 6l-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </div>
);
function WiringFigure() {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row">
      <Box title="Beam (target)" lines={["Has already processed the context.", "Hidden states are read at layers 4, 16, 28, 40 and 46, for the last 4,096 tokens only."]} />
      <Arrow label="hidden states" />
      <Box tint title="Drafter, 1.93B parameters" lines={["5 transformer layers.", "Positions in the block attend to each other in both directions, and to Beam's hidden states.", "Embedding and output head are Beam's, frozen."]} />
      <Arrow label="7 tokens" />
      <Box title="Beam (target)" lines={["One forward pass over the block.", "Keeps the agreed prefix and adds one token of its own."]} />
    </div>
  );
}

// ---------------------------------------------------------------- demo 2: acceptance versus speed (toy cost model)
const D_COST = 0.2; // made-up: one drafter pass, as a fraction of one plain Beam decode step
function SpeedDemo() {
  const [p, setP] = useState(0.8);
  const [k, setK] = useState(7);
  const [cv, setCv] = useState(0.1);
  const tau = (n) => { let t = 1, a = 1; for (let i = 0; i < n; i++) { a *= p; t += a; } return t; };
  const cost = (n) => 1 + D_COST + cv * n;
  const rows = Array.from({ length: 15 }, (_, i) => ({ k: i + 1, tau: +tau(i + 1).toFixed(2), speed: +(tau(i + 1) / cost(i + 1)).toFixed(2) }));
  const top = Math.max(4, Math.ceil(Math.max(...rows.map((r) => r.speed)) / 2) * 2);
  const topTicks = Array.from({ length: top / (top > 4 ? 2 : 1) + 1 }, (_, i) => i * (top > 4 ? 2 : 1));
  const tauTop = rows[14].tau > 8 ? 16 : 8;
  const bestK = rows.reduce((b, r) => (r.speed > b.speed ? r : b), rows[0]);
  const cfg = { tau: { label: "Tokens per step (τ)", color: chartColors[1] }, speed: { label: "Speedup over plain decoding (×)", color: chartColors[0] } };
  const stat = (label, value, sub) => (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg bg-wash px-3 py-2">
      <span className="text-[11.5px] leading-4 text-secondary">{label}</span>
      <span className="font-mono text-[17px] leading-7 text-primary">{value}</span>
      <span className="text-[11.5px] leading-4 text-secondary">{sub}</span>
    </div>
  );
  return (
    <Demo title="Longer drafts raise acceptance length, but not always speed"
      takeaway={<>Tokens per step keeps rising with the draft length, but each extra position adds less, because it only counts when every
      position before it was accepted. Its verification cost does not shrink. So at the starting settings the speedup peaks at a short
      draft and then falls, which is the report's reason for serving with blocks of 8 rather than 16. Raise the acceptance chance and the peak
      moves to longer drafts. This is a toy model: every position is accepted with the same probability,
      independently; a drafter pass costs a made-up {D_COST} of a plain Beam step; and verification cost grows in a straight line. None of
      these inputs is from the report.</>}>
      <Slider label="Chance each drafted token is accepted" value={p} min={0.5} max={0.95} step={0.01} onChange={setP} fmt={(v) => pct(v)} />
      <Slider label="Drafted tokens per step" value={k} min={1} max={15} step={1} onChange={setK} />
      <Slider label="Verification cost per drafted position" value={cv} min={0} max={0.2} step={0.01} onChange={setCv} fmt={(v) => v.toFixed(2)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[["tau", "Tokens per step (τ)", [0, tauTop], tauTop > 8 ? [0, 4, 8, 12, 16] : [0, 2, 4, 6, 8]], ["speed", "Speedup over plain decoding (×)", [0, top], topTicks]].map(([key, title, dom, tk]) => (
          <div key={key} className="flex min-w-0 flex-col gap-1">
            <span className="text-[12px] leading-5 text-secondary">{title}</span>
            <ChartContainer config={cfg} style={{ height: 170, width: "100%" }}>
              <LineChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <ChartGrid />
                <ChartXAxis dataKey="k" type="number" domain={[1, 15]} ticks={[1, 3, 5, 7, 9, 11, 13, 15]} />
                <ChartYAxis domain={dom} ticks={tk} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Recharts.ReferenceLine x={k} stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.6} />
                <ChartLine dataKey={key} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
        ))}
      </div>
      <Small>Horizontal axis: drafted tokens per step. The dashed line marks the current setting.</Small>
      <div className="flex flex-wrap gap-2">
        {stat("Tokens per step, τ", tau(k).toFixed(2), "of at most " + (k + 1))}
        {stat("Cost of one step", cost(k).toFixed(2) + "×", "in plain Beam decode steps")}
        {stat("Speedup", (tau(k) / cost(k)).toFixed(2) + "×", "best is " + bestK.speed.toFixed(2) + "× at " + bestK.k + " drafted")}
      </div>
    </Demo>
  );
}

// ---------------------------------------------------------------- the lesson
function Lesson() {
  const best = (row) => (row.low ? Math.min(...row.v) : Math.max(...row.v));
  const recipeRow = (row) => (
    <TableRow key={row.m}>
      <TableCell>{row.m}</TableCell>
      {row.v.map((x, i) => <Num key={i} className={x === best(row) ? "font-semibold text-primary" : "text-secondary"}>{x.toFixed(row.d || 1)}{row.unit || ""}</Num>)}
    </TableRow>
  );
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="Two ways to get more out of the same GPUs">
        <Lead>
          The earlier lessons produced the final model. This one covers what happens between that model and a user: making it small
          enough to serve cheaply, and making each expensive forward pass produce more than one token.
        </Lead>

        <H3>The problem: weights and conversations compete for GPU memory</H3>
        <P>
          Beam's weights are stored in <b>BF16</b>, a 16-bit floating-point format, and the checkpoint is 933.81 GiB. A serving
          replica (one copy of the model, split across several GPUs) has to hold those weights and also
          the <Term def="Key-value cache. While generating, a transformer stores the attention keys and values of every token it has already processed, so that it does not recompute them for each new token. Its size grows with the number of tokens held across all active requests.">KV cache</Term>,
          the per-token state the model keeps for every conversation it is in the middle of.
        </P>
        <P>
          Whatever memory the weights take is not available for KV cache, and the KV cache is what decides how long a context can
          be and how many users one replica can serve at once. In BF16 on four GPUs the weights take 234.7 GiB of each GPU and
          leave room for only 213K tokens of cache, far short of Beam's 1M-token context. So BF16 needs eight GPUs per replica.
        </P>

        <H3>Idea 1: quantization stores each weight in fewer bits</H3>
        <P>
          <b>Quantization</b> replaces each 16-bit number with a number from a much smaller menu: 256 possible values for an 8-bit
          format, 16 for a 4-bit one. To make a small menu cover whatever range a group of weights happens to have, the group
          shares one multiplier, called a <b>scale</b>. The stored value is the menu entry; the value used in the computation is the
          entry times the scale.
        </P>
        <P>
          Rounding to a menu loses information, so there are two decisions to make: which layers to round, and how to pick the
          scales. Beam ships two answers. <b>FP8</b> uses 8 bits almost everywhere and picks scales by a simple rule. <b>NVFP4</b> uses
          4 bits on the largest part of the model only, and chooses its scales by measuring their effect on real text. Both are
          produced from the finished BF16 model with no further training, which is called post-training quantization.
        </P>
        <Panel title="Size of the checkpoint's weight files"
          caption="FP8 is half the size of BF16 and NVFP4 is under a third. NVFP4 is not a quarter because only the MoE experts drop to 4 bits; the rest stays in BF16. Source: table 12.">
          <BarList data={sizes} max={1000} />
        </Panel>

        <H3>Idea 2: speculative decoding gets several tokens from one forward pass</H3>
        <P>
          Normally a language model produces one token per forward pass. The report notes that for a large mixture-of-experts
          model this step is <b>memory-bound</b>: its duration is set by how fast weights can be read from memory, and most of the
          GPU's arithmetic capacity sits idle while that happens.
        </P>
        <P>
          <b>Speculative decoding</b> puts the idle capacity to work. A small, fast model called the <b>drafter</b> guesses the next
          several tokens. Beam, called the <b>target</b>, then runs one forward pass over all the guesses together and reads off
          what it would have said at each position. It keeps the guesses up to the first one it disagrees with, and replaces that
          one with its own token. Checking several positions in one pass costs little more than producing one token, because the
          weights are read once either way.
        </P>
        <Panel title="One verification step"
          caption="Four guesses are accepted and Beam supplies the fifth token, so this pass yields five tokens instead of one. Everything after the first rejection is discarded, even if it would have matched. The sentence is a made-up example.">
          <StepFigure />
        </Panel>
        <P>
          The drafter never changes what Beam says. A wrong guess costs some wasted work, not a wrong token: with the standard
          acceptance rule (part 2), the text has exactly the distribution Beam alone would have produced.
        </P>
        <KeyIdea>
          Both techniques spend something cheap to relieve something scarce. Quantization gives up a little numerical precision to
          free memory for the KV cache. Speculative decoding spends idle GPU compute to get more tokens out of each slow,
          memory-bound pass of the big model.
        </KeyIdea>
      </Stage>

      <Stage step={2} title="How the two checkpoints are quantized and how the drafter is built">
        <P>
          This part first reads the format names, then gives the FP8 rule, then the NVFP4 procedure, and ends with the drafter:
          its acceptance rule, its wiring and its training.
        </P>

        <H3>Reading the format names</H3>
        <P>
          A small floating-point number has a sign bit, some exponent bits and some mantissa bits. <b>E4M3</b> means 4 exponent bits
          and 3 mantissa bits, 8 bits with the sign. <b>E2M1</b> means 2 exponent bits and 1 mantissa bit, 4 bits with the sign.
          The report gives the largest finite E4M3 value as 448. In the standard definition of E2M1 (not spelled out in the
          report) the only magnitudes are 0, 0.5, 1, 1.5, 2, 3, 4 and 6.
        </P>
        <P>
          <b>W8A8</b> and <b>W4A4</b> say how many bits the weights (W) and the activations (A) use. Activations are the vectors
          flowing into a layer; quantizing them as well lets the layer's matrix multiply run entirely in the small format. The
          table below sets the two checkpoints side by side. Look at which layers each one touches and at how each picks its scales.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead></TableHead><TableHead>FP8</TableHead><TableHead>NVFP4</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">Number format</TableCell><TableCell>8-bit E4M3, W8A8</TableCell><TableCell>4-bit E2M1, W4A4</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Layers quantized</TableCell><TableCell>Attention projections, dense MLPs, MoE experts, and the KV cache</TableCell><TableCell>MoE experts only</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Left alone</TableCell><TableCell>Embeddings, LM head, MoE routers, normalization layers</TableCell><TableCell>Dense MLPs, attention, embeddings and LM head stay in BF16; the MoE router stays in FP32; the KV cache stays in BF16 (FP8 is supported)</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Scales</TableCell><TableCell>Weights: one per output channel, fixed. Activations: one per token, recomputed on every pass</TableCell><TableCell>One E4M3 scale per block of 16 values, plus one FP32 scale per tensor</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">How scales are chosen</TableCell><TableCell>Round-to-nearest from the largest value in the row</TableCell><TableCell>Local Hessian: per block, the scale that minimizes output error</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Calibration data</TableCell><TableCell>None</TableCell><TableCell>32.8M tokens of agentic trajectories</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Tool</TableCell><TableCell>LLM Compressor (vLLM team)</TableCell><TableCell>Model Optimizer (NVIDIA)</TableCell></TableRow>
          </TableBody>
        </Table>
        <Small>
          Terms: in a mixture-of-experts (MoE) layer a small <b>router</b> sends each token to a few of many <b>expert</b> MLPs, so the
          experts hold most of the parameters. The LM head is the final layer that turns a hidden state into scores over the
          vocabulary. Source: table 12 and sections 4.5.1 and 4.5.2.
        </Small>

        <H3>FP8: scale by the largest value, then round</H3>
        <P>
          FP8 uses one rule for weights and activations. Take a row of numbers, divide by a scale chosen so that the row's largest
          magnitude lands exactly on 448, and round every entry to the nearest E4M3 value.
        </P>
        <Eq label="FP8 scale and rounding" note="Printed in section 4.5.1.">
          <V>s</V><sub><V>r</V></sub> = max<sub><V>j</V></sub> |<V>v</V><sub><V>r,j</V></sub>| / 448
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <V>q</V><sub><V>r,j</V></sub> = round<sub>E4M3</sub>(<V>v</V><sub><V>r,j</V></sub> / <V>s</V><sub><V>r</V></sub>)
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <V>v</V><sub><V>r,j</V></sub> ≈ <V>s</V><sub><V>r</V></sub> <V>q</V><sub><V>r,j</V></sub>
        </Eq>
        <Where items={[
          [<>v<sub>r,j</sub></>, "a weight or an input activation of the layer being quantized"],
          ["r", "the row: an output channel for weights, a token for activations"],
          ["j", "the input feature within the row"],
          [<>s<sub>r</sub></>, "the scale shared by row r"],
          [<>q<sub>r,j</sub></>, "the stored 8-bit value"],
          ["448", "the largest finite E4M3 value"],
        ]} />
        <P>
          The difference between the two cases is when the scale is computed. Weight scales are computed once, at conversion.
          Activation scales are recomputed from the actual inputs, for each token, at each quantized layer, on every forward pass.
          Because nothing has to be estimated ahead of time, FP8 needs no calibration data. A row that is entirely zero gets a
          positive fallback scale so the division is defined.
        </P>
        <CodeBlock code={fp8Code} />

        <H3>NVFP4: fifteen grid points, so the scale has to be chosen with care</H3>
        <P>
          NVFP4 stores each value in 4 bits, groups values into blocks of 16, and gives every block its own 8-bit scale. A second,
          32-bit scale covers the whole tensor. By our arithmetic that is 4 + 8/16 = 4.5 bits per value, plus one number per tensor.
        </P>
        <Eq label="What an NVFP4 value represents" note="The report lists the three parts; writing them as a product is the standard definition of the format, not an equation from the report.">
          <V>w</V><sub><V>b,i</V></sub> ≈ <V>S</V> · <V>s</V><sub><V>b</V></sub> · <V>q</V><sub><V>b,i</V></sub>
        </Eq>
        <Where items={[
          [<>w<sub>b,i</sub></>, "value i of block b (a block is 16 consecutive values)"],
          [<>q<sub>b,i</sub></>, "the stored 4-bit E2M1 number"],
          [<>s<sub>b</sub></>, "the block's scale, stored as an 8-bit E4M3 number"],
          ["S", "one FP32 scale for the whole tensor"],
        ]} />
        <P>
          With only 15 distinct values per block (seven magnitudes, both signs, and zero), where the scale places them matters far
          more than it does at 8 bits. The demo shows this on one made-up block. Start with the 4-bit format and move the scale;
          then switch to 8 bits and notice how little is left to gain.
        </P>
        <QuantDemo />
        <P>
          The simplest choice, called <b>max scale</b>, is FP8's rule: put the largest weight on the largest grid point. The released
          recipe instead uses Model Optimizer's <b>Local Hessian</b> algorithm, which for each block of 16 weights picks the scale
          that minimizes the error of the layer's <i>output</i>, not of the weights themselves. A weight that multiplies inputs
          that are usually large matters more than one whose inputs are usually near zero.
        </P>
        <Eq label="Output error of a quantized linear layer" note="Standard textbook form, shown to make “output error” concrete. The report states the goal in words and cites the Local Hessian write-up for the algorithm; it does not print this equation or say how the Hessian is restricted to a block.">
          <V>E</V> = ||(<V>W</V> − <V>Ŵ</V>) <V>X</V>||² = tr[(<V>W</V> − <V>Ŵ</V>) <V>H</V> (<V>W</V> − <V>Ŵ</V>)<sup>T</sup>]
          &nbsp;&nbsp;&nbsp;&nbsp; with <V>H</V> = <V>X</V><V>X</V><sup>T</sup>
        </Eq>
        <Where items={[
          ["W, Ŵ", "the layer's original and quantized weight matrices"],
          ["X", "the layer's inputs on the calibration data, one column per token"],
          ["H", "the second-moment matrix of those inputs, which is the Hessian of E with respect to the weights (up to a constant)"],
        ]} />
        <P>
          Measuring output error needs inputs, so NVFP4 needs calibration data, and its choice matters. The steps below are the
          procedure as the report describes it.
        </P>
        <Steps items={[
          { title: "Calibrate on the kind of text the model will serve", body: "1,000 long agentic trajectories of 32,768 tokens each (32.8M tokens), mostly software-engineering sessions, rendered in Beam's chat format. The stated reason: Beam serves long-horizon agentic work, so it is calibrated on sequences of the same kind." },
          { title: "Go one decoder layer at a time, always from clean inputs", body: "Every layer sees the BF16 model's activations, not the activations of the layers already quantized. Each layer is therefore fitted to the original model's behaviour, and the layers do not depend on the order in which they are processed." },
          { title: "Pool statistics across GPUs before searching", body: "Calibration runs across 8 GPUs (the report calls the parallel workers ranks). The input statistics are combined across ranks before the scale search, so every rank selects identical scales." },
          { title: "Search the scale for each 16-weight block", body: "Local Hessian picks the E4M3 scale with the lowest output error. The whole calibration took about 6 hours on one node of 8 B300 GPUs and used under 30 GiB of GPU memory per rank." },
        ]} />

        <H3>How fidelity to BF16 is measured</H3>
        <P>
          To compare recipes the team needed a measurement more sensitive than a benchmark score. They run the BF16 model and the
          quantized model over the same held-out text and compare their next-token distributions at every position. This
          is <Term def="Both models are fed the same recorded token sequence and each predicts the next token at every position. Neither model's own predictions are fed back in, so the two are always compared on identical inputs.">teacher-forced</Term> scoring,
          on 64 agentic sequences of 32,768 tokens (2.1M scored tokens) that were not used for calibration.
        </P>
        <Eq label="KL divergence from BF16 to NVFP4 at one position" note="Standard definition. The report averages it over the 2.1M scored positions.">
          KL(<V>P</V> || <V>Q</V>) = Σ<sub><V>x</V></sub> <V>P</V>(<V>x</V>) · log [<V>P</V>(<V>x</V>) / <V>Q</V>(<V>x</V>)]
        </Eq>
        <Where items={[
          ["P", "the BF16 model's probability distribution over the next token"],
          ["Q", "the quantized model's distribution at the same position"],
          ["x", "a token in the vocabulary"],
        ]} />
        <P>
          KL divergence is zero when the two distributions are identical and grows as they drift apart. The second
          metric, <b>top-1 agreement</b>, is the share of positions where both models rank the same token first.
        </P>

        <H3>The drafter: accepting guesses without changing the output</H3>
        <P>
          With greedy decoding (always take the most likely token) the acceptance test is simple: a drafted token is accepted
          if it is the token Beam ranks first. With sampling, the report says rejection sampling preserves the target's output
          distribution exactly and cites the original speculative-decoding papers. Their rule, which the report does not print,
          is below.
        </P>
        <Eq label="Acceptance rule for a sampled draft token" note="Standard rule from the speculative-decoding papers the report cites (its references 121 and 122).">
          accept <V>x</V> with probability min(1, <V>p</V>(<V>x</V>) / <V>q</V>(<V>x</V>))
          &nbsp;&nbsp;&nbsp;&nbsp; otherwise sample from norm(max(0, <V>p</V> − <V>q</V>))
        </Eq>
        <Where items={[
          ["x", "the token the drafter sampled at this position"],
          ["q", "the drafter's probability distribution at this position"],
          ["p", "Beam's distribution at the same position, from the verification pass"],
          ["norm(·)", "rescale so the probabilities sum to 1"],
        ]} />
        <P>
          A token the drafter likes more than Beam does is sometimes rejected, and the replacement is drawn from the part of Beam's
          distribution the drafter under-covered. Together the two branches reproduce <V>p</V> exactly. The loop is short:
        </P>
        <CodeBlock code={specCode} />
        <P>
          The quantity that drives the speedup is the <b>acceptance length τ</b>: the mean number of tokens produced per
          verification step. The released setup drafts 7 tokens per step and the report gives τ a maximum of 8, which matches the
          accounting in the sketch: up to 7 accepted guesses plus the one token Beam always contributes.
        </P>

        <H3>How the drafter is wired to Beam</H3>
        <P>
          The drafter is a DFlash 2 model. Three choices in its design keep it cheap. The figure shows them; the paragraphs after
          it explain each.
        </P>
        <Panel title="The drafter reads Beam's hidden states and proposes a block"
          caption="The drafter does not read the context itself. It reuses work Beam has already done, and only for the most recent 4,096 tokens. Source: section 4.6.1.">
          <WiringFigure />
        </Panel>
        <P>
          <b>It drafts a whole block in one pass.</b> The drafter is a block-diffusion model: instead of producing tokens one after
          another, its five layers fill in all positions of the block together, each position attending to the others in both
          directions. DFlash 2's in-block convolutions and path selector are there to keep the drafted tokens consistent with each
          other; the report names these parts without describing them further.
        </P>
        <P>
          <b>It borrows Beam's understanding of the context.</b> Through their attention keys and values, the drafter's layers
          attend to Beam's hidden states at layers 4, 16, 28, 40 and 46, which are the inputs of Beam's global-attention layers.
          The embedding table and output head are Beam's own, kept frozen. So the 1.93B parameters are spent on predicting the
          next few tokens from a representation Beam has already built.
        </P>
        <P>
          <b>Its cost does not grow with the context.</b> The drafter attends to at most the last 4,096 tokens of Beam's hidden
          states, however long the conversation. The report calls the consequence the main question for training: whether such
          a local drafter stays accurate deep into a long context.
        </P>

        <H3>How the drafter is trained</H3>
        <P>
          The drafter's only job is to predict what Beam will say, so every training target is text generated by Beam itself. Part
          of that text comes from MOPD, the distillation stage that produced the final model, which <LessonLink to="mopd" /> covers.
        </P>
        <Steps items={[
          { title: "Data: Beam's own outputs", body: <>The 1.42M PerfectBlend prompts, with responses regenerated by the released checkpoint, plus rollouts (recorded model interactions) from the MOPD stage that produced Beam, which cover the agentic and reasoning work Beam is deployed on. Only rollouts from after the first 50 MOPD steps are used: from then on, the policy's per-token likelihood of its own samples and their lengths were flat in every category.</> },
          { title: "Features: one Beam pass per sequence, 512 blocks from it", body: "Each time a sequence is used, a single forward pass of Beam captures its hidden states. 512 blocks of 16 tokens are then placed at randomly sampled anchor positions, and each block reads the features of the tokens before its anchor. The features come from the NVFP4 checkpoint, the one that is served." },
          { title: "Loss: early positions count more", body: "The loss weights each block position by the expected number of accepted tokens that depend on it. A miss at the first position throws away the whole block, while a miss at the last position costs one token." },
          { title: "Schedule: mostly short context", body: "Capturing features costs more for longer sequences, as attention does. So training is 6 epochs over 2.2M traces truncated to 8K tokens, then 2 epochs over 592K traces of up to 128K tokens." },
          { title: "Stability", body: "AdamW's β₂ was lowered to 0.95 and adaptive gradient clipping was added. Together these removed the gradient spikes that occasionally made early runs diverge even with a fixed clipping threshold." },
        ]} />
        <P>
          Both stages together took about 3.4K B300 GPU-hours.
        </P>
      </Stage>

      <Stage step={3} title="What quantization costs, what it buys, and how the drafter was sized">
        <P>
          The results come in four groups: how the NVFP4 recipe was chosen, how much quality the quantized checkpoints lose, how
          much serving capacity they gain, and what the drafter adds on top.
        </P>

        <H3>Choosing the NVFP4 recipe</H3>
        <P>
          Four recipes were run on the same BF16 checkpoint with the same data, seed and pipeline. The first three differ in how
          block scales are chosen; the fourth also quantizes the dense MLPs. In the table, the best value in each row is in bold.
          Compare how consistently the two fidelity rows point one way with how the bold moves around in the benchmark rows.
        </P>
        <Panel title="NVFP4 recipe ablation"
          caption="Local Hessian has the lowest KL and the highest top-1 agreement. The ten benchmarks do not agree on a winner: every recipe is best, or tied for best, on at least one of them. Four-over-six is a published scale-selection method that the report names without describing. Fidelity is measured on 64 held-out sequences, with a BF16 KV cache on both sides. Source: table 13.">
          <Table wrapText rowLines>
            <TableHeader><TableRow><TableHead></TableHead>{recipeCols.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {fidelity.map(recipeRow)}
              {recipeBench.map(recipeRow)}
              <TableRow><TableCell className="font-medium">Median score, relative to Local Hessian</TableCell>{recipeMedian.map((x, i) => <Num key={i}>{x}</Num>)}</TableRow>
            </TableBody>
          </Table>
        </Panel>
        <Surprise title="Benchmarks could not rank the recipes, so the recipe was chosen by KL divergence">
          One would expect to pick a quantization recipe by its benchmark scores. Here the median benchmark score differed by
          less than 0.4% between recipes, while individual benchmark scores varied noisily, by up to 3.2 points. Held-out KL
          did separate them: Local Hessian lowered it by 8% against max scale and by 6% against four-over-six, across nearly all
          held-out sequences. The released recipe was selected on KL.
        </Surprise>
        <P>
          The fourth column explains why NVFP4 stops at the experts. Quantizing the dense MLPs as well saves only 1.26 GiB, 0.5% of
          the checkpoint, and it raises KL from 0.0290 to 0.0308. That is as much damage as switching the scale method across all
          49 MoE layers, in exchange for almost no memory.
        </P>

        <H3>Quality after quantization</H3>
        <P>
          The released FP8 and NVFP4 checkpoints were then run on 22 benchmarks against BF16, at temperature 0.7, top-p 0.99,
          maximum reasoning effort and 1M context. Each row below shows the score change in percentage points. Look for a
          pattern in the direction of the bars, not at any single bar.
        </P>
        <Panel title="Score difference from BF16 on 22 benchmarks, in percentage points"
          caption="FP8 is higher on 9 benchmarks and lower on 11, a mean of +0.03 points: no measurable loss. NVFP4 is higher on 4 and lower on 16, a mean of −0.45 points: a small but consistent cost. The largest NVFP4 drops are SciCode (−2.3) and Terminal Bench v2.1 (−1.7). Both checkpoints score about 2 points above BF16 on SWE-bench Pro v2-Hard, which the report attributes to sampling variance. Source: figure 36.">
          <DiffBars />
        </Panel>
        <P>
          The report is careful about these numbers. Scores vary from run to run because sampling is random, and on small or
          long-horizon agentic benchmarks a few key tasks can move a score by 1 to 2 points. It describes the values as observed
          changes, not statistically verified shifts, and says that cases where a quantized checkpoint beats BF16 reflect that
          variance, not a quality gain. Its summary figure is the share of the median benchmark score
          recovered: <b>99.93% for FP8</b> and <b>98.98% for NVFP4</b>.
        </P>
        <P>
          Safety behaviour was checked separately on the Iris Safety Evaluations suite (<LessonLink to="align" /> covers how that
          behaviour is trained). Rounding the weights did not change how often the model refuses harmful requests or helps with
          harmless ones by more than a point.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Iris Safety Evaluations, all harm areas combined</TableHead><TableHead className="text-right">BF16</TableHead><TableHead className="text-right">FP8</TableHead><TableHead className="text-right">NVFP4</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>Harmful requests: refusal or pivot rate</TableCell><Num>88.9%</Num><Num>89.7%</Num><Num>88.5%</Num></TableRow>
            <TableRow><TableCell>Harmless requests: compliance rate</TableCell><Num>81.5%</Num><Num>81.6%</Num><Num>82.1%</Num></TableRow>
          </TableBody>
        </Table>
        <Small>Source: table 14.</Small>

        <H3>What the freed memory buys</H3>
        <P>
          Serving was measured on NVIDIA B300 GPUs with SGLang, each configuration as
          one <Term def="A single copy of the model whose weight matrices are split across several GPUs, which work together on every request.">tensor-parallel replica</Term>.
          The figure shows where each GPU's 268.6 GiB goes. Read the right-hand column: it is the number of tokens of KV cache
          the whole replica can hold.
        </P>
        <Panel title="Memory per GPU after the model is loaded, in GiB, and KV cache capacity of the replica"
          caption="Every GiB taken off the weights turns into KV cache. On 4 GPUs NVFP4 holds 8.2M tokens against FP8's 5.8M (1.41×), and BF16 has almost nothing left. Each configuration reserves 90% of GPU memory. The figure prints no KV figure in GiB for BF16 on 4 GPUs. Source: figure 37 and section 4.5.4.">
          <MemoryBars />
        </Panel>
        <P>
          More cache means more requests in flight on the same hardware. Throughput was measured on two workloads. The first is a
          fixed-length benchmark: 8,192 input and 1,024 output tokens per request, at 8 to 256 concurrent requests. Throughput is
          then compared at a fixed speed for each user, since a deployment that serves many users slowly is not comparable to
          one that serves few users quickly.
        </P>
        <Panel title="Fixed-length benchmark: output tokens per second per GPU"
          caption="Labels give the checkpoint and the number of GPUs in the replica. At 50 tokens per second per user, NVFP4 on 4 GPUs produces 1,263 tokens per second per GPU, 6.0× BF16 on 8 GPUs; FP8 on 4 GPUs reaches 1.6×. Values are interpolated between measured concurrency levels. Source: table 15.">
          <ChartContainer config={{ t50: { label: "At 50 tok/s per user", color: chartColors[0] }, t100: { label: "At 100 tok/s per user", color: chartColors[1] } }} style={{ height: 240, width: "100%" }}>
            <BarChart data={thr}>
              <ChartGrid /><ChartXAxis dataKey="d" /><ChartYAxis title="tok/s per GPU" />
              <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
              <ChartBar dataKey="t50" /><ChartBar dataKey="t100" />
            </BarChart>
          </ChartContainer>
          <Table wrapText rowLines>
            <TableHeader><TableRow><TableHead>Deployment</TableHead><TableHead className="text-right">Per-user speed at 8 concurrent (tok/s)</TableHead><TableHead className="text-right">Per GPU at 50 tok/s per user</TableHead><TableHead className="text-right">Per GPU at 100 tok/s per user</TableHead></TableRow></TableHeader>
            <TableBody>
              {thr.map((r) => (
                <TableRow key={r.d}><TableCell>{r.d} GPUs</TableCell><Num>{r.c8}</Num><Num>{r.t50.toLocaleString("en-US")} ({r.r50})</Num><Num>{r.t100} ({r.r100})</Num></TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Findings items={[
          <><b>NVFP4 gains far more than FP8.</b> On 4 GPUs it reaches 6.0× BF16's per-GPU throughput at 50 tok/s per user and 4.2× at 100, against 1.6× and 1.4× for FP8. The report gives no breakdown of where the extra gain comes from.</>,
          <><b>Fewer GPUs per replica is more efficient per GPU.</b> Going from 8 GPUs to 4 raises NVFP4's per-GPU throughput by about 43% at 50 tok/s per user and 20% at 100. For FP8 the increases are about 2% and 25%.</>,
          <><b>NVFP4 is also faster for a single user.</b> At 8 concurrent requests it reaches 199 tok/s per user on 8 GPUs and 168 on 4, against 126 for BF16 on 8 GPUs. FP8 on 4 GPUs is slower per user than BF16 on 8 (102 against 126): it wins on cost, not on speed.</>,
        ]} />
        <P>
          The second workload, AgentX, replays 393 recorded agentic coding sessions. Requests carry 80K to 100K input tokens, about
          95% of which hit the prefix cache (the KV cache of an earlier request with the same beginning, reused). This is closer to
          how Beam is used, and the ranking holds.
        </P>
        <Panel title="AgentX replay of agentic coding sessions"
          caption="NVFP4 never fell to 50 tok/s per user, even at 64 sessions, the highest load tested. Its throughput figures are therefore the measured values at 64 sessions and are lower bounds. Time to first token is nearly the same everywhere, 189 to 224 ms. Measured over a 20-minute window; ratios are relative to BF16 on 8 GPUs. Source: table 16.">
          <Table wrapText rowLines>
            <TableHeader><TableRow><TableHead>Deployment</TableHead><TableHead className="text-right">Per-user speed, 8 sessions (tok/s)</TableHead><TableHead className="text-right">Per-user speed, 64 sessions (tok/s)</TableHead><TableHead className="text-right">Output tok/s per GPU at 50 tok/s per user</TableHead><TableHead className="text-right">Median time to first token, 64 sessions</TableHead></TableRow></TableHeader>
            <TableBody>
              {agentx.map((r) => (
                <TableRow key={r.d}><TableCell>{r.d}</TableCell><Num>{r.c8}</Num><Num>{r.c64}</Num><Num>{r.t50}</Num><Num>{r.ttft} ms</Num></TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <H3>Sizing the drafter for speed</H3>
        <P>
          The speedup from speculative decoding depends on τ, but also on what a step costs: the drafter's pass, plus Beam
          verifying several positions instead of producing one. The demo below is a toy model of that trade. Raise the number
          of drafted tokens and compare the two charts.
        </P>
        <SpeedDemo />
        <Surprise title="A drafter that accepts more tokens was not faster">
          One would expect a better drafter to give a faster system. Eight drafter layers instead of five accepted 2.8% more
          tokens in replay and 1.2% more when served, but changed the speedup by only 0.5%, within noise, for 60% more
          parameters. Block size behaved the same way. Verifying 8 positions instead of 16 lowered acceptance length by 5% to 15%,
          yet was faster in 11 of 12 workload and concurrency settings. On chat the speedup rose from 1.63× to 1.93× for one
          request and from 1.46× to 2.00× at 128 concurrent requests.
        </Surprise>
        <P>
          Training has no verification cost, so the drafter still trains on blocks of 16, as DFlash does. The report cites the
          DFlash result that a drafter trained on larger blocks can be served at smaller ones with little loss, but not the
          reverse. The released drafter therefore has five layers, trains with blocks of 16 and serves with blocks of 8.
        </P>

        <H3>Does a drafter trained on short contexts work in long ones?</H3>
        <P>
          This was the open question from part 2. There was a specific reason to doubt it: Beam's hidden states shift with
          position, because its global-attention layers scale their queries with absolute position. A drafter trained only on
          positions below 8K has never seen the features Beam produces at position 100K.
        </P>
        <Surprise title="Trained only at 8K tokens, the drafter accepted slightly more beyond 64K">
          In development experiments on 43 long agentic traces, a drafter trained only on 8K-token sequences accepted 4.70 draft
          tokens per block of 16 at 4K to 8K of context, and 5.02 beyond 64K. Adding a long-context training stage helped only at
          longer contexts, by 1.6% at 8K to 16K and 3.8% beyond 64K, and the gain saturated within 4K steps. Because that is small
          relative to its cost, the long-context stage was kept short.
        </Surprise>
        <P>
          The released drafter shows the same pattern on 446 agentic coding turns from DeepSWE. Acceptance length is highest for
          short prompts, then levels off instead of continuing to fall.
        </P>
        <Panel title="Acceptance length τ of the released drafter by prompt length"
          caption="From 16K to 128K tokens of context τ stays between 4.2 and 4.6; over all 446 turns it is 4.82. The maximum is 8 (7 drafted tokens per step). Source: table 18.">
          <ChartContainer config={{ tau: { label: "Tokens per verification step (τ)", color: chartColors[0] } }} style={{ height: 210, width: "100%" }}>
            <BarChart data={tauLen} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
              <ChartGrid /><ChartXAxis dataKey="len" /><ChartYAxis title="τ" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartBar dataKey="tau" label={{ position: "top", fontSize: 11, formatter: (v) => Number(v).toFixed(2) }} />
            </BarChart>
          </ChartContainer>
        </Panel>

        <H3>The released drafter</H3>
        <P>
          The final numbers are for Beam in NVFP4 on four B300 GPUs with 7 drafted tokens per step. Over 1,562 turns of math, code,
          long-context and chat, τ is 4.38 with sampling and 4.64 with greedy decoding, out of a maximum of 8. The table breaks
          this down by benchmark; the rows are ordered from the most predictable text to the least.
        </P>
        <Panel title="Acceptance length and decode speedup by benchmark"
          caption="Speedup tracks τ: 3.03× on grade-school math, where the next tokens are easy to guess, down to 1.96× on open-ended chat. Speedups hold up under load, falling only slightly at 32 concurrent requests. Sampling uses temperature 1 and top-p 0.99; speedups are measured with greedy decoding and count decoding only. Source: table 17.">
          <Table wrapText rowLines>
            <TableHeader><TableRow><TableHead>Benchmark</TableHead><TableHead className="text-right">τ, sampled</TableHead><TableHead className="text-right">τ, greedy</TableHead><TableHead className="text-right">Speedup, 1 request</TableHead><TableHead className="text-right">Speedup, 32 concurrent</TableHead></TableRow></TableHeader>
            <TableBody>
              {drafter.map((r) => (
                <TableRow key={r.b}><TableCell>{r.b} <span className="text-secondary">({r.kind})</span></TableCell><Num>{r.ts.toFixed(2)}</Num><Num>{r.tg.toFixed(2)}</Num><Num>{r.s1.toFixed(2)}×</Num><Num>{r.s32.toFixed(2)}×</Num></TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <P>
          Dividing the greedy τ by the single-request speedup gives 1.8 to 2.1 in every row. Under the simple accounting of the
          demo, where speedup is τ divided by the cost of a step, a draft-and-verify step costs about twice a plain decode step.
          That is our arithmetic, not a figure from the report.
        </P>
        <Findings items={[
          <><b>Training data that matches deployment helps most where it matters.</b> In ablations with pre-release versions of Beam, replacing 42% of the PerfectBlend data with MOPD rollouts raised accepted draft tokens by 9.9% overall and by 21% on agentic traces.</>,
          <><b>The drafter does not care which checkpoint it reads.</b> Its training features come from the NVFP4 checkpoint. Using BF16 features instead changed accepted tokens by at most 1.5%, in training or in serving.</>,
        ]} />
        <Src>sections 4.5 and 4.6, tables 12 to 18, figures 36 to 39</Src>
      </Stage>
    </div>
  );
}
