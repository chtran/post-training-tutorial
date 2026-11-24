const meta = {
  id: "mopd",
  nav: "MOPD merge",
  title: "Merging two experts with on-policy distillation",
  question: "How do two separately trained experts become one model, with no reward signal at all?",
  minutes: 15,
  // Three to five sentences a reader should remember. Shown in a box at the end of the lesson.
  takeaways: [
    "The merged model is a third network, the student. It writes its own rollouts, one of the two frozen experts is drawn per rollout according to the task family, and the student is pulled toward that teacher's next-token distribution at every token it wrote. No reward, verifier or judge is involved.",
    "The loss is the reverse KL divergence from student to teacher, summed over the whole 151,936-token vocabulary and averaged over all trainable tokens in a step of 512 tasks × 8 rollouts.",
    "Three choices keep the loss exact: it uses the trainer's current student probabilities rather than those of the stale copy that sampled, it never truncates either distribution to the 0.99 sampling nucleus, and it sums over the vocabulary instead of estimating from the sampled token.",
    "Two engineering tricks make that affordable: teachers send hidden states instead of distributions, and the trainer computes the KL a chunk of token positions at a time. The exact loss then runs in roughly the same wall-clock time as the sampled estimate.",
    "The student scores above its supervising teacher on 11 of 15 benchmarks in a single-run comparison. Fine-tuning on the experts' data alone did not get there, and the merged model still clings to some habits of the agentic teacher.",
  ],
};

// ---- colours: agentic teacher is blue, alignment teacher is purple, everywhere in this lesson ----
const AG = "rgb(var(--text-blue))";
const AL = "rgb(var(--text-purple))";

// ---- Table 10 of the report ----
const routing = [
  { c: "Science, technology, engineering and mathematics", a: 1.0 },
  { c: "Code generation, SWE and terminal tasks", a: 1.0 },
  { c: "Search", a: 1.0 },
  { c: "General tool use: reasoning-only datasets", a: 1.0 },
  { c: "General tool use: mixed datasets", a: 0.6 },
  { c: "Instruction following (single- and multi-turn)", a: 0.5 },
  { c: "Grounded queries and long-context tasks", a: 0.5 },
  { c: "Conversational behavior", a: 0.0 },
  { c: "Knowledge calibration", a: 0.0 },
  { c: "Model identity", a: 0.0 },
  { c: "Safety", a: 0.0 },
];

// ---- Table 11 of the report ----
const merged = [
  { g: "Agentic coding", b: "DeepSWE v1.1", ag: 43.4, al: null, s: 40.2 },
  { g: "Agentic coding", b: "SWE-Bench Pro v1", ag: 62.2, al: null, s: 67.1 },
  { g: "Agentic coding", b: "Terminal-Bench v2.1", ag: 77.7, al: null, s: 80.1 },
  { g: "Agentic coding", b: "SWE Atlas Codebase QnA", ag: 29.3, al: null, s: 32.5 },
  { g: "Agentic coding", b: "SWE-bench Multilingual", ag: 75.7, al: null, s: 77.7 },
  { g: "Agentic coding", b: "SWE-bench Verified", ag: 80.6, al: null, s: 81.1 },
  { g: "Mathematics and science", b: "AIME 2026", ag: 97.3, al: null, s: 96.9 },
  { g: "Mathematics and science", b: "HLE (no tools)", ag: 36.1, al: null, s: 35.2 },
  { g: "Mathematics and science", b: "SciCode", ag: 47.2, al: null, s: 49.5 },
  { g: "Mathematics and science", b: "GPQA Diamond", ag: 90.2, al: null, s: 90.0 },
  { g: "Tool use and search", b: "τ3 Banking", ag: null, al: 26.0, s: 35.1 },
  { g: "General capabilities", b: "AA-LCR", ag: 66.3, al: 78.0, s: 78.7 },
  { g: "General capabilities", b: "LongBench v2", ag: null, al: 63.1, s: 66.8 },
  { g: "General capabilities", b: "IFBench (reasoning effort 256)", ag: null, al: 77.3, s: 79.3 },
  { g: "General capabilities", b: "AA-Omniscience v1 public (index)", ag: 0.2, al: 10.7, s: 11.3 },
].map((r) => {
  const best = Math.max(r.ag == null ? -Infinity : r.ag, r.al == null ? -Infinity : r.al);
  return { ...r, best, d: +(r.s - best).toFixed(1) };
});
const nUp = merged.filter((r) => r.d > 0).length;
const nBigUp = merged.filter((r) => r.d > 2).length;
const nBigDown = merged.filter((r) => r.d < -2).length;

// ---- small pieces ----
function LegendDot({ color, children }) {
  return (
    <span className="inline-flex items-center gap-[6px] text-[12.5px] text-secondary">
      <span className="inline-block h-[9px] w-[9px] rounded-sm" style={{ background: color }} />{children}
    </span>
  );
}
function SplitBar({ a }) {
  return (
    <div className="flex h-[10px] w-full overflow-hidden rounded-sm bg-wash" role="img"
      aria-label={"Agentic " + pct(a) + ", alignment " + pct(1 - a)}>
      <div style={{ width: a * 100 + "%", background: AG }} />
      <div style={{ width: (1 - a) * 100 + "%", background: AL }} />
    </div>
  );
}
// Student minus best supervising teacher, as a bar growing left (worse) or right (better) from a centre line.
function DeltaBar({ d }) {
  const w = Math.min(Math.abs(d) / 10, 1) * 50;
  return (
    <div className="relative h-[10px] w-[72px] shrink-0" aria-hidden="true">
      <div className="absolute left-1/2 top-[-3px] h-[16px] w-px text-secondary" style={{ background: "currentColor", opacity: 0.5 }} />
      <div className="absolute inset-y-[1px] rounded-sm"
        style={{ width: w + "%", left: d >= 0 ? "50%" : 50 - w + "%", background: d >= 0 ? "rgb(var(--text-green))" : "rgb(var(--text-red))" }} />
    </div>
  );
}

// ---- figure: the MOPD loop (report figure 30) ----
const loopNodes = [
  { id: "task", title: "Task", sub: "drawn from the training mix" },
  { id: "student", title: "Student", sub: "writes the whole rollout itself" },
  { id: "route", title: "Teacher draw", sub: "one per rollout, odds set by task family" },
  { id: "ag", title: "Agentic teacher", sub: "frozen; reasoning, coding, tools" },
  { id: "al", title: "Alignment teacher", sub: "frozen; conversation, calibration, safety" },
  { id: "loss", title: "Token-by-token comparison", sub: "how far is the student from the teacher here?" },
];
const loopEdges = [
  { from: "task", to: "student" },
  { from: "student", to: "route", label: "rollout" },
  { from: "route", to: "ag", label: "or" },
  { from: "route", to: "al", label: "or" },
  { from: "ag", to: "loss", label: "its distributions" },
  { from: "al", to: "loss", label: "its distributions" },
  { from: "loss", to: "student", label: "update", dim: true },
];

// ---- demo 1: draw the teachers for one task's 8 rollouts ----
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function RoutingDemo() {
  const [fam, setFam] = useState("4");
  const [seed, setSeed] = useState(7);
  const r = routing[Number(fam)].a;
  const draws = useMemo(() => {
    const rnd = mulberry(seed * 977 + Number(fam) * 131 + 1);
    return Array.from({ length: 8 }, () => rnd() < r);
  }, [fam, seed, r]);
  const nAg = draws.filter(Boolean).length;
  return (
    <Demo title="Draw the teachers for one task's eight rollouts"
      takeaway="The draw is made per rollout, not per task or per token. A mixed family therefore gets some rollouts graded entirely by one teacher and some entirely by the other, and no single rollout ever receives a blend of two targets. The routing probabilities are the report's (table 10); the random draws happen in your browser.">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[260px] grow">
          <SimpleSelect value={fam} onValueChange={setFam} aria-label="Task family"
            options={routing.map((x, i) => ({ value: String(i), label: x.c }))} />
        </div>
        <Button variant="secondary" onClick={() => setSeed(seed + 1)}>Draw again</Button>
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
        {draws.map((isAg, i) => (
          <div key={i} className={"flex flex-col items-center gap-[2px] rounded-md px-1 py-2 " + (isAg ? "bg-tint-blue" : "bg-tint-purple")}>
            <span className="font-mono text-[11px] text-secondary">rollout {i + 1}</span>
            <span className={"text-[12.5px] font-semibold " + (isAg ? "text-blue" : "text-purple")}>{isAg ? "Agentic" : "Alignment"}</span>
          </div>
        ))}
      </div>
      <div className="text-[13px] leading-6 text-primary">
        Probability of the agentic teacher for this family: <span className="font-mono">{r.toFixed(1)}</span>. This draw: <span className="font-mono">{nAg}</span> agentic
        and <span className="font-mono">{8 - nAg}</span> alignment, against an average of <span className="font-mono">{(8 * r).toFixed(1)}</span> and <span className="font-mono">{(8 * (1 - r)).toFixed(1)}</span>.
      </div>
    </Demo>
  );
}

// ---- demo 2: reverse KL at one token position ----
const TOKS = ["tok 1", "tok 2", "tok 3", "tok 4", "tok 5", "tok 6"];
const teacherQ = [0.6, 0.25, 0.1, 0.042, 0.006, 0.002];
const studentStart = [0.1, 0.55, 0.05, 0.28, 0.015, 0.005];
// Indices kept by nucleus (top-p) sampling: the smallest set of most likely tokens whose mass reaches p.
function nucleus(dist, p) {
  const order = dist.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
  const keep = new Set(); let cum = 0;
  for (const [v, i] of order) { keep.add(i); cum += v; if (cum >= p - 1e-9) break; }
  return keep;
}
function KLDemo() {
  const [alpha, setAlpha] = useState(0.3);
  const [target, setTarget] = useState("full");
  const p = teacherQ.map((t, i) => (1 - alpha) * studentStart[i] + alpha * t);
  const tKeep = nucleus(teacherQ, 0.99);
  const tMass = teacherQ.reduce((s, v, i) => s + (tKeep.has(i) ? v : 0), 0);
  const q = target === "full" ? teacherQ : teacherQ.map((v, i) => (tKeep.has(i) ? v / tMass : 0));
  const terms = p.map((pv, i) => (q[i] > 0 ? pv * Math.log(pv / q[i]) : Infinity));
  const kl = terms.reduce((s, v) => s + v, 0);
  const sKeep = nucleus(p, 0.99);
  const outside = TOKS.map((t, i) => ({ t, i })).filter((x) => !sKeep.has(x.i));
  const outMass = outside.reduce((s, x) => s + p[x.i], 0);
  const rows = TOKS.map((t, i) => ({ t, student: +(p[i] * 100).toFixed(2), teacher: +(q[i] * 100).toFixed(2) }));
  const cfg = { student: { label: "Student (%)", color: chartColors[0] }, teacher: { label: "Teacher target (%)", color: chartColors[1] } };
  return (
    <Demo title="Reverse KL at one token position"
      takeaway="With the full teacher as target, the loss falls smoothly to zero as the student closes the gap. Cut the teacher to its own nucleus and the loss is infinite wherever the student still gives those tokens any probability, even for a student that matches the real teacher exactly. The six-token vocabulary and both distributions are made up for this demo; 0.99 is the report's nucleus threshold.">
      <Slider label="Student moves toward the teacher" value={alpha} min={0} max={1} step={0.01} onChange={setAlpha} fmt={(v) => pct(v)} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-primary">
        <span className="shrink-0">Teacher target in the loss</span>
        <SegmentedControl value={target} onValueChange={(v) => { if (v) setTarget(v); }} size="small" aria-label="Teacher target in the loss">
          <SegmentedControlItem value="full">Full distribution</SegmentedControlItem>
          <SegmentedControlItem value="trunc">Cut to its 0.99 nucleus</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <ChartContainer config={cfg} style={{ height: 210, width: "100%" }}>
        <BarChart data={rows}>
          <ChartGrid /><ChartXAxis dataKey="t" /><ChartYAxis title="probability (%)" domain={[0, 70]} />
          <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
          <ChartBar dataKey="student" /><ChartBar dataKey="teacher" />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-wash px-3 py-2">
          <div className="text-[12px] leading-5 text-secondary">Reverse KL, student against this target</div>
          <div className={"font-mono text-[17px] leading-7 " + (Number.isFinite(kl) ? "text-primary" : "text-red")}>
            {Number.isFinite(kl) ? kl.toFixed(4) + " nats" : "infinite"}
          </div>
          <div className="text-[12px] leading-5 text-secondary">
            {Number.isFinite(kl) ? "Every one of the six tokens contributes a finite term." : "The target gives tok 5 and tok 6 zero probability; the student does not."}
          </div>
        </div>
        <div className="rounded-md bg-wash px-3 py-2">
          <div className="text-[12px] leading-5 text-secondary">Outside the student's own 0.99 sampling nucleus</div>
          <div className="font-mono text-[17px] leading-7 text-primary">
            {outside.length ? outside.map((x) => x.t).join(", ") : "none"}
          </div>
          <div className="text-[12px] leading-5 text-secondary">
            {outside.length
              ? pct(outMass, 2) + " of student probability. Never sampled, so a sampled-token estimate never compares it; the full sum does."
              : "At this setting every token can be sampled."}
          </div>
        </div>
      </div>
    </Demo>
  );
}

// ---- figure: blockwise KL (report figure 31) ----
function BlockFigure() {
  const grid = (x, label) => (
    <g>
      <rect x={x} y={34} width={150} height={150} rx={4} fill="none" stroke="currentColor" strokeOpacity={0.35} />
      {[0, 1, 2, 3, 4].map((k) => (
        <line key={k} x1={x} x2={x + 150} y1={34 + 25 * (k + 1)} y2={34 + 25 * (k + 1)} stroke="currentColor" strokeOpacity={0.12} />
      ))}
      <rect x={x} y={84} width={150} height={25} fill={AG} fillOpacity={0.28} stroke={AG} />
      <text x={x + 75} y={101} textAnchor="middle" fontSize={12} fill="currentColor">C × V in memory</text>
      <text x={x + 75} y={24} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="currentColor">{label}</text>
      <text x={x + 75} y={202} textAnchor="middle" fontSize={11.5} fill="currentColor" opacity={0.65}>V vocabulary entries wide</text>
    </g>
  );
  return (
    <svg viewBox="0 0 600 212" className="w-full text-primary" role="img"
      aria-label="Student and teacher logits are formed for one chunk of C token positions at a time, reduced to C per-token KL values, then freed.">
      <text x={14} y={109} textAnchor="middle" fontSize={11.5} fill="currentColor" opacity={0.65} transform="rotate(-90 14 109)">N token positions</text>
      {grid(34, "Student logits")}
      {grid(214, "Teacher logits")}
      <path d="M372 96.5 H452" stroke="currentColor" strokeOpacity={0.6} fill="none" />
      <path d="M446 91.5 L453 96.5 L446 101.5" stroke="currentColor" strokeOpacity={0.6} fill="none" />
      <text x={412} y={88} textAnchor="middle" fontSize={11.5} fill="currentColor" opacity={0.65}>row-wise KL</text>
      <rect x={470} y={34} width={26} height={150} rx={4} fill="none" stroke="currentColor" strokeOpacity={0.35} />
      <rect x={470} y={84} width={26} height={25} fill={AG} fillOpacity={0.28} stroke={AG} />
      <text x={483} y={24} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="currentColor">Per-token KL</text>
      <text x={506} y={101} fontSize={12} fill="currentColor">C values kept</text>
      <text x={483} y={202} textAnchor="middle" fontSize={11.5} fill="currentColor" opacity={0.65}>N values in all</text>
    </svg>
  );
}

const flowSteps = [
  { t: "Rollout worker", d: "The student samples a rollout.", out: "tokens" },
  { t: "Teacher server", d: "The selected teacher reads the same tokens and returns its hidden states.", out: "N × d_T values" },
  { t: "Trainer", d: "Rebuilds the teacher's logits with its cached copy of the frozen output head.", out: "logits, a chunk at a time" },
  { t: "Loss", d: "Blockwise reverse KL against the current student.", out: null },
];
function FlowFigure() {
  return (
    <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {flowSteps.map((s, i) => (
        <li key={s.t} className="flex flex-col gap-1 rounded-md bg-wash px-3 py-2">
          <span className="font-mono text-[11px] text-secondary">{i + 1}</span>
          <span className="text-[13px] font-semibold leading-5 text-primary">{s.t}</span>
          <span className="grow text-[12.5px] leading-5 text-secondary">{s.d}</span>
          {s.out ? (
            <span className="flex items-center gap-1 pt-1 text-[12px] font-medium leading-4 text-blue">
              <span>sends {s.out}</span>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="shrink-0">
                <path d="M1 5h11M8.5 1.5 12 5 8.5 8.5" />
              </svg>
            </span>
          ) : <span className="pt-1 text-[12px] font-medium leading-4 text-blue">N per-token KL values</span>}
        </li>
      ))}
    </ol>
  );
}

const stepCode = `# One MOPD training step. Illustrative pseudocode written for this
# lesson, not code from the report.
tasks = sample(task_mix, M=512)
for x in tasks:
    for j in range(8):                      # R = 8 rollouts per task
        # inference may be running slightly older student weights
        y = student_inference.generate(x, top_p=0.99)
        # one teacher for the whole rollout
        T = agentic if random() < r(x) else alignment
        # the frozen teacher reads the student's own tokens
        H_t[x, j] = T.hidden_states(x, y)

# trainer: CURRENT student weights, gradients on
H_s  = student_trainer.hidden_states(tasks, rollouts)
K    = blockwise_reverse_kl(H_s, W_s, H_t, W_t, C, B)   # [N] KL per token
loss = K[trainable].mean()                  # equation 4.1
loss.backward(); optimizer.step()           # no reward appears anywhere`;

const klCode = `# PyTorch-style reading of the report's Algorithm 1 (forward pass),
# written for this lesson. The report runs the inner vocabulary loop in
# custom Triton kernels and applies each model's logit softcap before the
# statistics; softcap() stands in for that step here.

def softmax_stats(z, B):                 # z: [C, V] logits for one chunk
    m = full((C,), -inf); s = zeros(C)   # running row max, shifted sum
    for b in range(0, V, B):             # B vocabulary entries at a time
        u = z[:, b:b+B]
        m_new = maximum(m, u.max(-1).values)
        s = exp(m - m_new) * s + exp(u - m_new[:, None]).sum(-1)
        m = m_new
    return m, s.log()                    # log_softmax(z) = z - m - log s

def blockwise_reverse_kl(H_s, W_s, H_t, W_t, C, B):
    # H_s: [N, d_S] student hidden states   W_s: [V, d_S] student head
    # H_t: [N, d_T] teacher hidden states   W_t: [V, d_T] frozen teacher head
    K = []
    for i in range(0, N, C):                 # C token positions at a time
        z_s = softcap(H_s[i:i+C] @ W_s.T)    # [C, V] temporary
        z_t = softcap(H_t[i:i+C] @ W_t.T)    # [C, V] temporary
        m_s, l_s = softmax_stats(z_s, B)
        m_t, l_t = softmax_stats(z_t, B)
        k = zeros(C)
        for b in range(0, V, B):
            logp = z_s[:, b:b+B] - m_s[:, None] - l_s[:, None]   # student
            logq = z_t[:, b:b+B] - m_t[:, None] - l_t[:, None]   # teacher
            k += (logp.exp() * (logp - logq)).sum(-1)
        K.append(k)          # keep C numbers (and m, l for the backward pass)
        del z_s, z_t         # free both [C, V] buffers
    return cat(K)            # [N] per-token reverse KL`;

const recipe = [
  ["Starting point", "The mid-trained checkpoint, fine-tuned on both experts' SFT data plus traces sampled from both trained experts"],
  ["Who generates", "Only the student. Teachers never write a rollout in this stage"],
  ["Training signal", "Teacher probabilities only. No external reward on student rollouts"],
  ["Context length", "256K tokens"],
  ["Batch per step", "512 tasks × 8 rollouts = 4,096 rollouts"],
  ["Learning rate", "3 × 10⁻⁶, constant, after 20 linear warm-up steps from zero"],
  ["Student sampling", "Nucleus sampling at p = 0.99, as in the RL run"],
  ["Loss support", "Full vocabulary for student and teacher; no masking, no renormalizing"],
];

function Lesson() {
  let lastGroup = null;
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="The student writes, a teacher grades every token">
        <Lead>
          By this point the pipeline has two finished models. The agentic expert (<LessonLink to="rl" />) is strong at reasoning, coding and
          tool use. The alignment expert (<LessonLink to="align" />) is strong at conversation, calibration and safety. Only one model ships,
          so the two have to become one.
        </Lead>
        <P>
          Training them apart was deliberate. The report's stated benefit is that each expert can be trained and evaluated on its own
          before anything is combined. The price is a merge step, and that step is this lesson.
        </P>

        <H3>The idea</H3>
        <P>
          The merge uses a third model, the student. The student attempts a task by itself and produces a{" "}
          <Term def="One complete attempt at a task: everything the model generates from the prompt to its final answer, including its reasoning and tool calls.">rollout</Term>.
          One of the two experts, now frozen and called a teacher, then reads that rollout. At every token the student wrote, the
          teacher reports what it would have said next in that exact situation: not a single token, but its full list of probabilities
          over every possible next token.
        </P>
        <P>
          The student is then nudged so that its own probabilities at each of those positions sit closer to the teacher's. That is the
          whole training signal. No test suite runs, no judge model scores the answer, and no reward is computed. A rollout that ends
          in a wrong answer is as useful as one that ends in a right one, because the lesson at each token is what the teacher would
          do from here.
        </P>
        <P>
          This is called{" "}
          <Term def="Training a student model to imitate a teacher model's outputs, here its next-token probabilities, instead of learning from labels or rewards.">distillation</Term>,
          and it is <b>on-policy</b> because the situations being graded are the ones the student gets itself into. The alternative,
          off-policy or offline distillation, has the student study rollouts the teacher wrote. The usual argument for on-policy, which
          is ours and not spelled out in the report, is that a student only ever shown the teacher's clean rollouts never learns what
          to do after its own slips.
        </P>
        <Panel title="The MOPD loop"
          caption="Redrawn from figure 30 of the report. Read it top to bottom, then follow the dashed edge back up: the comparison updates the student, and the next rollouts come from the updated student. The teachers never change.">
          <Diagram nodes={loopNodes} edges={loopEdges} direction="TB" />
        </Panel>

        <H3>Which teacher grades</H3>
        <P>
          Each teacher is only trusted on what it was trained for. So every task family has a fixed probability of being graded by the
          agentic teacher, and a teacher is drawn with that probability separately for each rollout. This is the "multi-teacher" part,
          and it gives the method its name: multi-teacher on-policy distillation, MOPD.
        </P>
        <P>
          In the table below, look at the three middle rows. Most families go entirely to one teacher. Three are shared, because
          the report judges that they need both kinds of skill.
        </P>
        <Panel title="Who supervises what"
          caption="Table 10 of the report. The report explains why mixed general tool use is shared: automating a workflow needs the agentic teacher's reasoning to coordinate many tools, and the alignment teacher's handling of complex instructions and preferences. It does not say how 0.6 was chosen over 0.5.">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <LegendDot color={AG}>Agentic teacher</LegendDot>
            <LegendDot color={AL}>Alignment teacher</LegendDot>
          </div>
          <Table wrapText rowLines flush>
            <TableHeader><TableRow>
              <TableHead>Task family</TableHead>
              <TableHead className="text-right">Agentic</TableHead>
              <TableHead className="text-right">Alignment</TableHead>
              <TableHead className="w-[120px]">Split</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {routing.map((r) => (
                <TableRow key={r.c}>
                  <TableCell>{r.c}</TableCell>
                  <TableCell className="text-right font-mono">{r.a.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-mono">{(1 - r.a).toFixed(1)}</TableCell>
                  <TableCell><SplitBar a={r.a} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <H3>The student does not start cold</H3>
        <P>
          Before MOPD begins, the student gets its own round of supervised fine-tuning, covered in <LessonLink to="sft" />. It is trained
          on the SFT data of both experts combined, plus example rollouts sampled from the two finished experts. The point is to
          begin MOPD with a student whose behavior is already close to both teachers, so that the rollouts it writes are worth grading.
        </P>
        <KeyIdea>
          The student does the work, a teacher marks every token of it, and the only thing the student is ever asked to do is agree
          with the teacher that was drawn for that rollout. Which teacher is drawn depends on the kind of task.
        </KeyIdea>
      </Stage>

      <Stage step={2} title="An exact loss over the whole vocabulary, and how to afford it">
        <P>
          This part makes the idea precise. It covers the loss, three places where the report chose an exact computation over a
          cheaper approximation, and the two engineering tricks that pay for those choices.
        </P>

        <H3>The loss at one token position</H3>
        <P>
          Fix one position in one rollout. Write <V>c</V> for the context there: the task prompt plus every token the student has
          produced so far. The student, with parameters <V>θ</V>, assigns a probability π<sub>θ</sub>(<V>v</V> | <V>c</V>) to each
          candidate next token <V>v</V>. The teacher assigns π<sub>T</sub>(<V>v</V> | <V>c</V>). The gap between the two is measured
          with the{" "}
          <Term def="Kullback-Leibler divergence: a non-negative measure of how different one probability distribution is from another. It is zero only when the two are identical, and it is not symmetric.">KL divergence</Term>,
          with the student written first.
        </P>
        <Eq label="Reverse KL at one position" note="The textbook definition of KL divergence, written out for this setting. The report states the loss in terms of D_KL and does not expand it.">
          D<sub>KL</sub>(π<sub>θ</sub> ‖ π<sub>T</sub>) = Σ<sub><V>v</V> = 1…<V>V</V></sub> π<sub>θ</sub>(<V>v</V> | <V>c</V>) · [ log π<sub>θ</sub>(<V>v</V> | <V>c</V>) − log π<sub>T</sub>(<V>v</V> | <V>c</V>) ]
        </Eq>
        <Where items={[
          [<span>π<sub>θ</sub></span>, "the student's next-token distribution; the only thing with gradients"],
          [<span>π<sub>T</sub></span>, "the selected teacher's next-token distribution in the same context; frozen"],
          ["V", "vocabulary size. Beam's is 151,936 tokens (table 1 of the report)"],
          ["v", "one vocabulary entry; the sum runs over all of them, not only the token that was sampled"],
        ]} />
        <P>
          Two things in this formula matter later. First, each token's term is weighted by the <i>student's</i> probability. That
          ordering is what "reverse" means; the forward KL would weight by the teacher's. Second, if the teacher gives a token zero
          probability while the student gives it any, the logarithm of zero makes the whole sum infinite.
        </P>
        <P>
          The report does not argue for reverse over forward KL. The textbook property is that reverse KL penalizes the student
          heavily for putting probability where the teacher puts almost none, and lightly for ignoring something the teacher would
          accept.
        </P>

        <H3>The loss for a training step</H3>
        <P>
          A step averages that per-position quantity over every trainable token in the batch. In the equation, look at what is
          divided by what: the total is divided by the number of tokens, not by the number of rollouts.
        </P>
        <Eq label="MOPD objective" note="Equation 4.1 of the report. The shorthand c for the context (x_i, y_ij,<t) is ours.">
          <V>L</V>(<V>θ</V>) = ( 1 / Σ<sub><V>i</V>,<V>j</V></sub> |𝒯<sub><V>ij</V></sub>| ) · Σ<sub><V>i</V> = 1…<V>M</V></sub> Σ<sub><V>j</V> = 1…<V>R</V></sub> Σ<sub><V>t</V> ∈ 𝒯<sub><V>ij</V></sub></sub> D<sub>KL</sub>( π<sub>θ</sub>(· | <V>c</V><sub><V>ijt</V></sub>) ‖ π<sub>T<sub><V>ij</V></sub></sub>(· | <V>c</V><sub><V>ijt</V></sub>) )
        </Eq>
        <Where items={[
          [<span>x<sub>i</sub></span>, <span>task <V>i</V> of the <V>M</V> = 512 tasks in a step</span>],
          [<span>y<sub>ij</sub></span>, <span>rollout <V>j</V> of the <V>R</V> = 8 rollouts the student samples for task <V>i</V></span>],
          [<span>c<sub>ijt</sub></span>, <span>the context at position <V>t</V> of that rollout: the task <V>x<sub>i</sub></V> and the rollout's tokens before <V>t</V></span>],
          [<span>𝒯<sub>ij</sub></span>, "the set of trainable token positions in that rollout. The report does not list which positions count; our reading is the tokens the student generated"],
          [<span>T<sub>ij</sub></span>, "which teacher grades that rollout, drawn at random as described next"],
        ]} />
        <P>
          Because the average is per token, a long rollout contributes more terms than a short one. The report notes that this
          token-level normalization follows DAPO, an open-source RL system for language models.
        </P>
        <P>
          The rollouts are treated as fixed data when the gradient is taken. The student did sample them, so in principle changing{" "}
          <V>θ</V> changes which contexts get visited, but no gradient flows through that choice. Only the probabilities at the
          visited contexts are differentiated.
        </P>

        <H3>Drawing the teacher</H3>
        <P>
          Let <V>r</V>(<V>x</V>) be the probability from the routing table that task <V>x</V> is graded by the agentic teacher. For
          each rollout an independent biased coin is flipped.
        </P>
        <Eq label="Teacher routing" note="Section 4.3.1 of the report. T = 1 selects the agentic teacher, T = 0 the alignment teacher. Draws are independent across rollouts.">
          <V>T</V><sub><V>ij</V></sub> ~ Bernoulli( <V>r</V>(<V>x</V><sub><V>i</V></sub>) )
        </Eq>
        <P>
          The demo below draws teachers for the eight rollouts of one task. Start with the default family, which is split 0.6 to 0.4,
          then switch to a family with probability 1.0 or 0.0 and watch the draw stop varying.
        </P>
        <RoutingDemo />

        <H3>Choice 1: grade the student as it is now</H3>
        <P>
          MOPD runs on the asynchronous RL system described in <LessonLink to="infra" />. Inference servers generate rollouts while
          the trainer keeps updating the weights, so the student that wrote a rollout is usually a slightly older copy than the
          student being updated. The loss needs student probabilities, and there are two versions to pick from.
        </P>
        <P>
          The report uses the trainer's <b>current</b> probabilities for both roles the student plays in the formula: the
          log-probability inside the bracket and the weight in front of it. The old probabilities from generation time are not used
          in the loss at all.
        </P>
        <P>
          The consequence is easiest to see in an extreme case. Suppose the older copy disagreed with the teacher in some context,
          but the current student already matches it. The KL there is zero and so is its gradient. Each update therefore works on
          the disagreement that still exists, not on one that has already been fixed.
        </P>
        <P>
          It also removes a correction that policy-gradient RL needs. The sum runs over every token using current probabilities, so
          nothing depends on which token happened to be sampled, and no importance weight is required for it. What stays stale is the
          set of contexts: they were reached by the older copy, and the report accepts that and treats them as fixed.
        </P>

        <H3>Choice 2: sample from the nucleus, but compare everything</H3>
        <P>
          Student rollouts are generated with{" "}
          <Term def="Also called top-p sampling. At each step, keep only the most likely tokens whose probabilities add up to p, rescale them to sum to 1, and sample from that set. The unlikely tail is never sampled.">nucleus sampling</Term>{" "}
          at <V>p</V> = 0.99, the same setting as the RL run. Over a long rollout there are many chances to sample a very unlikely
          token, and one of those can derail the whole attempt.
        </P>
        <P>
          In the RL stage the training loss is restricted to that same nucleus (<LessonLink to="rl" />). MOPD does the opposite. The
          loss is evaluated over the full vocabulary for both student and teacher, with no masking and no renormalizing. The report
          gives two reasons.
        </P>
        <Findings items={[
          <span><b>Masking changes the target.</b> Cutting either distribution to the rollout's nucleus would mean matching something other than the teacher's real distribution.</span>,
          <span><b>Truncating the teacher can make the loss infinite.</b> If the teacher is cut to its own nucleus, it assigns zero probability to tokens the student may still consider, and the reverse KL diverges.</span>,
        ]} />
        <P>
          In the demo, drag the slider to move the student toward the teacher and watch the loss shrink. Then switch the teacher
          target to its nucleus. Also watch the right-hand box: it lists tokens the student could never sample, which matters for the
          next choice.
        </P>
        <KLDemo />

        <H3>Choice 3: sum over the vocabulary instead of estimating</H3>
        <P>
          There is a cheaper way to get a reverse KL. Since the rollout's tokens were sampled from the student, the difference
          log π<sub>θ</sub> − log π<sub>T</sub> at the sampled token is a one-sample estimate of the sum. This sampled-token
          estimator needs only the teacher's log-probability of one token per position.
        </P>
        <P>
          The report keeps the full sum, for a reason tied to nucleus sampling. With the estimator, the same samples decide both
          which contexts are visited and what is compared inside each context. A token outside the nucleus can never be sampled, so
          it never gets compared with the teacher there. The full sum compares every token at every visited context, which keeps the
          sampling truncation out of the loss.
        </P>

        <H3>Paying for it, part 1: send hidden states, not distributions</H3>
        <P>
          An exact full-vocabulary loss needs the teacher's whole distribution at every position. For <V>N</V> token positions that
          is <V>N</V> × <V>V</V> numbers to move from the teacher servers to the trainer.
        </P>
        <P>
          The report moves much less. A model's distribution is computed from its final{" "}
          <Term def="The vector the network produces at a token position just before the output layer. Its length is the model's hidden width.">hidden state</Term>{" "}
          by one matrix multiplication with the{" "}
          <Term def="The final linear layer, a V × d matrix, that turns a hidden state into one score (logit) per vocabulary entry.">output head</Term>.
          The teacher is frozen, so its head never changes and the trainer can keep a copy. The teacher servers send only hidden
          states, <V>N</V> × <V>d</V><sub>T</sub> numbers where <V>d</V><sub>T</sub> is the teacher's hidden width, and the trainer
          rebuilds the{" "}
          <Term def="The raw per-token scores a model outputs before softmax turns them into probabilities.">logits</Term> itself. The
          report notes DeepSeek-V4 does the same.
        </P>
        <Panel title="Where the teacher's numbers travel"
          caption="From sections 4.3.2 and 6 of the report. If the teachers have Beam's published shape (hidden width 5,120, vocabulary 151,936; table 1), hidden states are about 30 times smaller than full distributions. That ratio is our arithmetic; the report gives only the O(NV) and O(N·d_T) forms.">
          <FlowFigure />
        </Panel>
        <P>
          Two details keep this faithful. Sequence packing and sharding preserve each position's index and teacher identity, so every
          teacher hidden state stays lined up with the student token it grades. And each model's logits pass through that model's own{" "}
          <Term def="A soft limit on the size of the output logits, applied before softmax. The report says Beam soft-caps its final logits at 30 and does not print the formula.">softcap</Term>{" "}
          before the softmax. Student and teacher softcaps may differ, and applying each model's own preserves its native output
          distribution.
        </P>

        <H3>Paying for it, part 2: compute the KL in blocks</H3>
        <P>
          Rebuilding logits on the trainer moves the problem from the network to GPU memory. Student and teacher logits for all{" "}
          <V>N</V> positions would again be <V>N</V> × <V>V</V> numbers each. The report never holds them all. It processes{" "}
          <V>C</V> token positions at a time: form two <V>C</V> × <V>V</V> logit buffers, reduce them to <V>C</V> KL values, free
          the buffers, move on.
        </P>
        <Panel title="Blockwise reverse KL"
          caption="Redrawn from figure 31 of the report. Only the highlighted band exists in memory at any moment, so temporary logit memory drops from O(NV) to O(CV) while every vocabulary entry is still summed. Hidden states and output heads stay in memory throughout. The report does not give the values of C or B.">
          <BlockFigure />
        </Panel>
        <P>
          The code below follows the report's Algorithm 1. Notice the two nested levels. The outer loop walks over chunks of
          positions. Inside a chunk, the vocabulary is walked in tiles of <V>B</V> entries, first to collect each row's maximum and
          log normalizer in one streaming pass, then to accumulate the KL. No full-size probability or log-probability tensor is
          ever created.
        </P>
        <CodeBlock code={klCode} />
        <P>
          The backward pass makes the same chunked traversal. It recomputes each chunk's logits and combines them with the statistics
          saved in the forward pass, the per-token KL and the softmax normalizers, to accumulate the student's gradient. The report
          compares the design to FlashAttention: tiled reductions, compact saved statistics, and recomputation in the backward pass.
        </P>
        <Small>
          Why those saved numbers are enough (a standard derivation, not printed in the report): the gradient of one position's
          reverse KL with respect to student logit <V>v</V> is π<sub>θ</sub>(<V>v</V>) · [ log π<sub>θ</sub>(<V>v</V>) − log π<sub>T</sub>(<V>v</V>) − D<sub>KL</sub> ].
          Given recomputed logits, the normalizers supply the log-probabilities and the saved KL supplies the last term.
        </Small>

        <H3>The whole step, and the recipe</H3>
        <P>
          Put together, one training step looks like this. The sketch is ours; it shows where each choice above sits.
        </P>
        <CodeBlock code={stepCode} />
        <P>
          Rollout generation, weight synchronization and{" "}
          <Term def="Beam is a mixture-of-experts model: each token is processed by a few of many expert sub-networks. Routing replay makes the trainer reuse the expert choices made when the rollout was generated.">MoE routing replay</Term>{" "}
          are reused unchanged from the RL stack. MOPD adds two things to it: the teacher annotation pass and the distillation loss.
        </P>
        <Panel title="MOPD training recipe" caption="Section 4.3.3 of the report. The report does not state how many steps MOPD ran, or the chunk size C and tile size B.">
          <Table wrapText rowLines flush>
            <TableBody>
              {recipe.map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="w-[150px] align-top text-secondary">{k}</TableCell>
                  <TableCell>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Stage>

      <Stage step={3} title="Does one student recover two teachers?">
        <P>
          The test of a merge is whether the student is as good as each teacher on that teacher's ground. The report compares the
          three models on 15 benchmarks, and separately probes for a failure it calls split-braining.
        </P>

        <H3>Student against teachers</H3>
        <P>
          In the table, the last column is the student's score minus the best teacher that supervises that benchmark's lane. Bars to
          the right are gains, bars to the left are losses. Look at how many bars point right, and how short most of them are.
        </P>
        <Panel title="Merged student against its two teachers"
          caption="Table 11 of the report; the difference column is computed here. Temperature 1.0 and reasoning effort 512 unless noted. A dash marks a teacher that does not supervise that lane. The report gives one score per cell with no confidence intervals. Elsewhere (section 4.5.3) it notes that long-horizon agentic benchmarks can move by 1 to 2 points between runs.">
          <Table wrapText rowLines flush>
            <TableHeader><TableRow>
              <TableHead>Benchmark</TableHead>
              <TableHead className="text-right">Agentic teacher</TableHead>
              <TableHead className="text-right">Alignment teacher</TableHead>
              <TableHead className="text-right">Student</TableHead>
              <TableHead className="text-right">Student − best teacher</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {merged.map((r) => {
                const head = r.g !== lastGroup; lastGroup = r.g;
                return (
                  <React.Fragment key={r.b}>
                    {head ? (
                      <TableRow><TableCell colSpan={5} className="bg-wash text-[12px] font-semibold text-secondary">{r.g}</TableCell></TableRow>
                    ) : null}
                    <TableRow>
                      <TableCell>{r.b}</TableCell>
                      <TableCell className="text-right font-mono">{r.ag == null ? "–" : r.ag.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono">{r.al == null ? "–" : r.al.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{r.s.toFixed(1)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <DeltaBar d={r.d} />
                          <span className={"w-[38px] text-right font-mono " + (r.d >= 0 ? "text-green" : "text-red")}>{r.d >= 0 ? "+" : "−"}{Math.abs(r.d).toFixed(1)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
        <P>
          The report's own summary is measured: the student "broadly recovers" the teachers, is competitive with the agentic teacher
          on coding, mathematics and science, matches or exceeds the alignment teacher on its lanes, and exceeds the stronger teacher
          where both supervise, "with some remaining performance gaps". The one clear gap is DeepSWE, from 43.4 to 40.2.
        </P>
        <Surprise title={"A student trained only to imitate scores above its teacher on " + nUp + " of 15 benchmarks"}>
          Distillation asks the student to match the teacher and nothing else, so the natural expectation is a student slightly
          below its teacher everywhere. Instead the student scores higher on {nUp} benchmarks, by more than 2 points on {nBigUp} of
          them, and lower by more than 2 points on only {nBigDown}. The largest gains are τ3 Banking (26.0 to 35.1) and SWE-Bench Pro
          (62.2 to 67.1). The report offers no explanation, and with one run per cell the small differences should be read as ties.
        </Surprise>

        <H3>What it took to get there</H3>
        <Findings items={[
          <span><b>Fine-tuning alone was not enough.</b> SFT on both experts' data did not recover the performance of both experts, even with the extra expert-generated traces. MOPD closed the remaining gap.</span>,
          <span><b>The traces still mattered.</b> Adding traces sampled from the two experts to the student's SFT data was, in the report's words, important for reaching teacher-level performance after MOPD.</span>,
          <span><b>Shared starting data sped up the merge.</b> Giving the alignment teacher the same SWE, STEM and terminal-use demonstrations as the agentic teacher improved MOPD's convergence speed (<LessonLink to="sft" />).</span>,
          <span><b>Safety behavior shifted back during the merge.</b> RL moved the alignment teacher toward more refusal of harmful requests and less compliance with harmless ones; MOPD moved the student the other way on both. The numbers are in <LessonLink to="align" />.</span>,
        ]} />
        <Surprise title="The exact loss costs about the same as the approximation">
          Summing over 151,936 vocabulary entries at every position sounds far more expensive than looking up one teacher
          log-probability per position. In the report's system, the blockwise full-vocabulary implementation runs in roughly the
          same wall-clock time as their sampled-token implementation. No timings are printed, only that statement.
        </Surprise>

        <H3>Split-braining</H3>
        <P>
          Routing by task family creates a specific risk. The student could learn two modes, each triggered by what the prompt looks
          like: act like the agentic teacher on prompts that resemble its tasks, and like the alignment teacher on prompts that
          resemble a conversation. It would then pass both teachers' benchmarks without having combined anything. The report calls
          this split-braining.
        </P>
        <P>
          To test for it, the team wrote hybrid tasks that mix the two prompt styles: hard reasoning problems embedded in
          conversational prompts. If the student were split, reasoning should get worse once the prompt looks conversational.
        </P>
        <Surprise title="The expected failure did not appear; a different one did">
          Reasoning held up. The report saw no significant drop on the hybrid tasks, including when stronger alignment-style cues were
          added. What it found instead came up while building the tasks: the model sometimes ignored small changes to the prompt,
          such as a different requested output format, and needed stronger cues before it showed alignment-style behavior. The
          report's reading is that some features tied to the agentic teacher's prompt distribution are deeply ingrained. It gives no
          numbers for either observation.
        </Surprise>

        <H3>What the report leaves open</H3>
        <Findings items={[
          "How long MOPD ran, and how the loss or the benchmark scores evolved during it.",
          "Any ablation of the routing table, of reverse against forward KL, or of full-vocabulary against sampled-token loss on final quality.",
          "Why the student exceeds its teachers on several benchmarks, and how much of that is run-to-run noise.",
        ]} />
        <Src>section 4.3 (figures 30 and 31, tables 10 and 11, algorithm 1, equation 4.1), with one sentence each from sections 4.2.2, 4.5.3, 6 and 7.2.3</Src>
      </Stage>
    </div>
  );
}
