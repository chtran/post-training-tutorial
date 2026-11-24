const meta = {
  id: "infra",
  nav: "RL infrastructure",
  title: "The asynchronous RL stack",
  question: "How do you keep a trainer fed by agent rollouts that take anywhere from minutes to hours, when the weights change underneath them?",
  minutes: 14,
  // Three to five sentences a reader should remember. Shown in a box at the end of the lesson.
  takeaways: [
    "Training, policy inference and tool execution run as separate services that scale independently. A control service coordinates them by passing metadata and references, while batches and weights move directly between the machines that need them.",
    "A policy update never restarts a rollout. A running turn keeps its KV cache and continues under the new weights; at the next turn the whole context is recomputed under those weights, replaying the expert selections recorded earlier.",
    "Admission limits and bounded buffers trade trainer supply against policy staleness. They slow admission when training slows, but they do not put a hard bound on how old a token can be.",
    "Every generated token carries its policy version into training. Those records showed that the largest source of staleness was rollouts of the same group finishing at different times, ahead of queueing before training.",
    "The obvious dashboards were not enough: memory ran out inside the sequence-length limit when tokens piled onto a few MoE experts, and cache-hit rates above 94% still left more fresh input tokens than generated tokens through much of the run.",
  ],
};

// ---------- Part 1: architecture (report figure 32) ----------
const services = {
  ctl: {
    title: "Control service", sub: "coordinates the job",
    does: "Manages the job lifecycle and runs three activities concurrently: rollout generation, batch assembly and policy updates. It decides how many rollouts are admitted, and it coordinates when a new policy version is published and adopted.",
    moves: "Only metadata and references pass through it. Trainer nodes fetch their own batch data, and serving instances pull weights themselves.",
    fails: "A control failure restarts the whole job from the last completed checkpoint.",
  },
  roll: {
    title: "Rollout workers", sub: "run agent and environment",
    does: "Each worker drives one agent-environment interaction: it asks policy inference for the next model response, sends tool calls to a sandbox, and evaluates the task outcome at the end.",
    moves: "Completed rollout data goes to the training service; execution records go to storage.",
    fails: "An isolated worker failure is recovered locally, without restarting the job.",
  },
  inf: {
    title: "Policy inference", sub: "generates model responses",
    does: "Built on SGLang, an open-source serving engine. Each serving instance spreads one copy of the model over several GPUs: attention and the KV cache of a request live on one GPU (a rank), while the expert layers are shared across the instance.",
    moves: "Receives inference requests from rollout workers and updated weights from the trainer. Different instances can be serving different policy versions at the same moment.",
    fails: "A failed serving pod is replaced on a healthy node and unhealthy routing targets are excluded. The job keeps running.",
  },
  sbx: {
    title: "Sandbox service", sub: "executes tools",
    does: "Runs the commands the agent issues, in a sandbox created from a task-specific OCI (Open Container Initiative) container image. A sandbox keeps its own files and processes across the turns of a rollout.",
    moves: "Returns tool results and structured failure details to the rollout worker. The rollout environment, not the sandbox, defines task behavior and reward.",
    fails: "The sandbox fleet scaled independently of training and inference. The report groups it with the shared services outside the core RL stack.",
  },
  judge: {
    title: "Judge service", sub: "vetoes false passes",
    does: "A separately served, fixed judge model reviews rollouts that already passed the automated task checks, against versioned assessment criteria. It can veto a pass before the reward reaches training.",
    moves: "Receives review requests and returns assessments. It never receives policy weight updates, and its endpoint scales on its own.",
    fails: "Under the fail-closed configuration, a judge request that still fails after retries fails the rollout, so an unreviewed pass cannot become a positive reward.",
  },
  train: {
    title: "Training service", sub: "updates the policy",
    does: "Consumes completed batches and takes optimizer steps. The next batch is prepared while the current one is being trained on, and updated weights are published to inference as training progresses.",
    moves: "Fetches its assigned batch data directly, serves new weights to inference from its own memory, and writes checkpoints to storage.",
    fails: "A trainer failure restarts the job from the last completed checkpoint. Work generated after that checkpoint may be discarded and regenerated.",
  },
  store: {
    title: "Storage", sub: "checkpoints and records",
    does: "Preserves checkpoints and execution records.",
    moves: "A checkpoint holds the model, the optimizer state, the training counters and the matching data-pipeline state, so that a restored job resumes a consistent point in both training and data.",
    fails: "It is what recovery restores from after a trainer or control failure.",
  },
};
// Hand-laid positions on a 600 x 400 canvas, following the layout of figure 32.
const boxes = {
  ctl: { x: 215, y: 0, w: 200, h: 54 },
  sbx: { x: 0, y: 96, w: 132, h: 54 },
  judge: { x: 0, y: 172, w: 132, h: 54 },
  roll: { x: 235, y: 96, w: 160, h: 130 },
  train: { x: 465, y: 120, w: 135, h: 82 },
  inf: { x: 270, y: 264, w: 170, h: 54 },
  store: { x: 270, y: 346, w: 170, h: 54 },
};
const archOrder = ["ctl", "sbx", "judge", "roll", "train", "inf", "store"];
// d: path; both: arrowheads at both ends; label lines with position and anchor.
const wires = [
  { d: "M315 58 V92", both: true, t: ["task scheduling /", "completion metadata"], x: 307, y: 72, a: "end" },
  { d: "M415 27 H532 V116", t: ["batch metadata"], x: 474, y: 20, a: "middle" },
  { d: "M136 123 H231", both: true, t: ["tool calls / results"], x: 183, y: 115, a: "middle" },
  { d: "M136 199 H231", both: true, t: ["review requests /", "assessments"], x: 183, y: 180, a: "middle" },
  { d: "M399 161 H461", t: ["rollout data"], x: 430, y: 153, a: "middle" },
  { d: "M340 230 V260", both: true, t: ["inference requests / responses"], x: 348, y: 249, a: "start" },
  { d: "M520 206 V291 H444", t: ["updated weights"], x: 514, y: 228, a: "end" },
  { d: "M252 230 V373 H266", t: ["execution records"], x: 245, y: 368, a: "end" },
  { d: "M570 206 V373 H444", t: ["checkpoints"], x: 563, y: 366, a: "end" },
];
function Architecture() {
  const [sel, setSel] = useState("ctl");
  const s = services[sel];
  return (
    <Demo title="The seven services of the stack: select one"
      takeaway="Redrawn from figure 32 of the report. Arrows are logical interactions, not transport protocols. Notice that the control service touches only scheduling and metadata: rollout data and weights travel on the other arrows.">
      <div className="overflow-x-auto">
        <div className="relative mx-auto h-[400px] w-[600px] shrink-0">
          <svg viewBox="0 0 600 400" width="600" height="400" className="absolute left-0 top-0 text-secondary" aria-hidden="true">
            <defs>
              <marker id="infra-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0.5 L7.5 4 L0 7.5 Z" fill="currentColor" />
              </marker>
            </defs>
            {wires.map((w, i) => (
              <g key={i}>
                <path d={w.d} fill="none" stroke="currentColor" strokeWidth="1.2" markerEnd="url(#infra-arrow)" markerStart={w.both ? "url(#infra-arrow)" : undefined} />
                {w.t.map((line, j) => (
                  <text key={j} x={w.x} y={w.y + j * 13} textAnchor={w.a} fontSize="11" fill="currentColor">{line}</text>
                ))}
              </g>
            ))}
          </svg>
          {archOrder.map((id) => {
            const b = boxes[id];
            return (
              <Button key={id} variant="secondary" aria-pressed={id === sel} onClick={() => setSel(id)}
                style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                className={"!absolute !flex-col !items-start !justify-center !gap-0 !px-3 !py-1 text-left " + (id === sel ? "bg-tint-blue" : "")}>
                <span className="text-[13px] font-semibold leading-5 text-primary">{services[id].title}</span>
                <span className="text-[11.5px] font-normal leading-4 text-secondary">{services[id].sub}</span>
              </Button>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg bg-wash px-4 py-3">
        <div className="text-[14px] font-semibold leading-6 text-primary">{s.title}</div>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 pt-1 text-[13.5px] leading-6">
          <dt className="text-secondary">What it does</dt><dd className="text-primary">{s.does}</dd>
          <dt className="text-secondary">Data</dt><dd className="text-primary">{s.moves}</dd>
          <dt className="text-secondary">On failure</dt><dd className="text-primary">{s.fails}</dd>
        </dl>
      </div>
    </Demo>
  );
}

// ---------- Part 2: overlap timeline (report figure 34) ----------
const lanes = [
  { name: "Published version", segs: [{ w: 28, t: "v", c: "bg-wash" }, { w: 50, t: "v+1", c: "bg-tint-purple" }, { w: 22, t: "v+2", c: "bg-tint-blue" }] },
  { name: "Trainer", segs: [{ w: 28, t: "train t", c: "bg-tint-green" }, { w: 22, t: "wait", c: "" }, { w: 28, t: "train t+1", c: "bg-tint-green" }, { w: 22, t: "wait", c: "" }] },
  { name: "Batch preparation", segs: [{ w: 50, t: "assemble t+1", c: "bg-tint-blue" }, { w: 50, t: "assemble t+2", c: "bg-tint-blue" }] },
  { name: "Generation", segs: [{ w: 50, t: "rollouts in flight, batch t+1 completing", c: "bg-tint-orange" }, { w: 50, t: "rollouts in flight, batch t+2 completing", c: "bg-tint-orange" }] },
];
function Lane({ name, children }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-[112px] shrink-0 items-center text-[12px] leading-4 text-secondary">{name}</div>
      <div className="flex min-w-0 grow gap-[2px]">{children}</div>
    </div>
  );
}
function Seg({ w, c, children }) {
  return (
    <div style={{ flexGrow: w, flexBasis: 0 }}
      className={"flex min-h-[34px] min-w-0 items-center justify-center rounded px-1 py-1 text-center text-[11.5px] leading-[14px] text-primary " + (c || "border border-dashed border-primary text-secondary")}>
      {children}
    </div>
  );
}
function OverlapTimeline() {
  return (
    <Panel title="Three activities overlap in time (schematic)"
      caption="Redrawn from figure 34 of the report; widths are schematic. While the trainer works on batch t, batch t+1 is already being assembled from rollouts that are finishing, and other rollouts are still running. Each finished step publishes a new version. The one-batch lookahead is only an illustration: it does not limit policy age to one version.">
      <div className="overflow-x-auto">
        <div className="flex min-w-[520px] flex-col gap-[6px]">
          {lanes.map((l) => (
            <Lane key={l.name} name={l.name}>{l.segs.map((s, i) => <Seg key={i} w={s.w} c={s.c}>{s.t}</Seg>)}</Lane>
          ))}
          <Lane name=""><div className="flex grow justify-between pt-1 text-[11px] text-secondary"><span>time</span><span>later</span></div></Lane>
        </div>
      </div>
    </Panel>
  );
}

// ---------- Part 2: a weight update inside a multi-turn rollout (report figure 33) ----------
const P1 = { w: 14, t: "prefill", c: "bg-tint-blue" };
const D = (t, c) => ({ w: 16, t: t || "decode", c: c || "bg-tint-green" });
const TOOL = { w: 8, t: "tool", tool: true };
const DELTA = { w: 4, t: "Δ", c: "bg-tint-blue" };
const FULL = { w: 18, t: "full prefill + expert replay", c: "bg-tint-purple" };
const scenarios = {
  none: {
    label: "No update",
    segs: [P1, D(), TOOL, DELTA, D(), TOOL, DELTA, D()],
    cut: null,
    text: "All three turns run under one policy version. Turn 1 processes the prompt once. Turns 2 and 3 reuse the cached context and prefill only the tokens added since, marked Δ: the previous tool result.",
  },
  decode: {
    label: "Update during turn 2",
    segs: [P1, D(), TOOL, DELTA, { w: 8, t: "decode", c: "bg-tint-green" }, { w: 8, t: "decode, old cache", c: "bg-tint-orange" }, TOOL, FULL, D()],
    cut: 5,
    text: "New weights arrive while turn 2 is decoding. The turn is not restarted: it keeps its KV cache and continues, so the rest of turn 2 (orange) is produced by new weights attending to state computed under old weights. At turn 3 the whole context is recomputed under the new weights, with the recorded expert selections replayed, and decoding is consistent again.",
  },
  tool: {
    label: "Update during a tool call",
    segs: [P1, D(), TOOL, DELTA, D(), TOOL, FULL, D()],
    cut: 5,
    text: "New weights arrive while the sandbox is running a tool, so no turn is decoding at that moment. The next turn still cannot reuse its cache, because the cache was computed under the old weights: the whole context is recomputed under the new weights with expert replay. No turn mixes versions here.",
  },
};
function UpdateDemo() {
  const [k, setK] = useState("decode");
  const sc = scenarios[k];
  const total = sc.segs.reduce((a, s) => a + s.w, 0);
  const before = sc.cut == null ? total : sc.segs.slice(0, sc.cut).reduce((a, s) => a + s.w, 0);
  return (
    <Demo title="What one rollout does when new weights arrive"
      takeaway="Redrawn from figure 33 of the report, which shows the middle case; widths are schematic. The third case is our application of the same rule (recompute at the next turn after an update), not a case the report draws. An update never restarts a rollout. Its cost is a stretch of mixed-version decoding in the running turn, if any, and one full prefill at the next turn.">
      <div className="flex"><SegmentedControl value={k} onValueChange={(v) => v && setK(v)} aria-label="When the update arrives">
        {Object.keys(scenarios).map((id) => <SegmentedControlItem key={id} value={id}>{scenarios[id].label}</SegmentedControlItem>)}
      </SegmentedControl></div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[540px] flex-col gap-[6px]">
          <Lane name="Weights">
            <Seg w={before} c="bg-wash">version v</Seg>
            {sc.cut == null ? null : <Seg w={total - before} c="bg-tint-purple">version v+1</Seg>}
          </Lane>
          <Lane name="Model inference">
            {sc.segs.map((s, i) => s.tool ? <div key={i} style={{ flexGrow: s.w, flexBasis: 0 }} /> : <Seg key={i} w={s.w} c={s.c}>{s.t}</Seg>)}
          </Lane>
          <Lane name="Tools">
            {sc.segs.map((s, i) => s.tool ? <Seg key={i} w={s.w} c="bg-wash">{s.t}</Seg> : <div key={i} style={{ flexGrow: s.w, flexBasis: 0 }} />)}
          </Lane>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-5 text-secondary">
        <span><span className="mr-1 inline-block h-[10px] w-[10px] rounded-sm border border-primary bg-tint-blue align-middle" />prefill: process input tokens</span>
        <span><span className="mr-1 inline-block h-[10px] w-[10px] rounded-sm border border-primary bg-tint-green align-middle" />decode: generate tokens</span>
        <span><span className="mr-1 inline-block h-[10px] w-[10px] rounded-sm border border-primary bg-tint-orange align-middle" />decode on a cache from older weights</span>
        <span><span className="mr-1 inline-block h-[10px] w-[10px] rounded-sm border border-primary bg-tint-purple align-middle" />recompute the whole context</span>
      </div>
      <P>{sc.text}</P>
    </Demo>
  );
}

// ---------- Part 2: policy-age decomposition (toy) ----------
const ageParts = [
  { key: "within", label: "Within one rollout", color: chartColors[0] },
  { key: "across", label: "Across rollouts in a group", color: chartColors[1] },
  { key: "groups", label: "Across groups for a task", color: chartColors[2] },
  { key: "gap", label: "Remaining gap at consumption", color: chartColors[3] },
];
function AgeDemo() {
  const [a, setA] = useState(2);
  const [b, setB] = useState(8);
  const [g, setG] = useState(1);
  const [q, setQ] = useState(1);
  const d = [a, a, a, b];
  const end = Math.max(a, b);
  const span = end + g + q;
  const vals = {
    within: d.reduce((s, x) => s + x / 2, 0) / 4,
    across: d.reduce((s, x) => s + (end - x), 0) / 4,
    groups: g,
    gap: q,
  };
  const total = vals.within + vals.across + vals.groups + vals.gap;
  const big = ageParts.reduce((m, p) => (vals[p.key] > vals[m.key] ? p : m), ageParts[0]);
  const w = (x) => (x / span) * 100 + "%";
  return (
    <Demo title="Where the policy age of one group comes from"
      takeaway="A toy group of four rollouts, with made-up durations, using the illustrative decomposition above (averaged per rollout, tokens spread evenly over each rollout). Set all four rollouts to the same length and the second component vanishes. Make one rollout slow and the three fast ones sit finished, ageing, until it is done.">
      <Slider label="Three rollouts each last" value={a} min={1} max={12} step={1} onChange={setA} fmt={(v) => v + " ver."} />
      <Slider label="The fourth rollout lasts" value={b} min={1} max={12} step={1} onChange={setB} fmt={(v) => v + " ver."} />
      <Slider label="Wait for the task's other groups" value={g} min={0} max={6} step={1} onChange={setG} fmt={(v) => v + " ver."} />
      <Slider label="Wait until the trainer uses it" value={q} min={0} max={6} step={1} onChange={setQ} fmt={(v) => v + " ver."} />
      <div className="flex flex-col gap-[5px] pt-1">
        {d.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-[64px] shrink-0 text-[12px] text-secondary">Rollout {i + 1}</div>
            <div className="flex h-[18px] min-w-0 grow overflow-hidden rounded bg-wash">
              <div style={{ width: w(x), background: chartColors[0] }} />
              <div style={{ width: w(end - x), background: chartColors[1], opacity: 0.75 }} />
              <div style={{ width: w(g), background: chartColors[2], opacity: 0.75 }} />
              <div style={{ width: w(q), background: chartColors[3], opacity: 0.75 }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-[64px] shrink-0" />
          <div className="flex grow justify-between text-[11px] text-secondary"><span>admitted at version 0</span><span>trained on at version {span}</span></div>
        </div>
      </div>
      <Small>Each bar is one rollout on a shared axis of policy versions: generating, then finished and waiting for the group, then for the task's other groups, then for the trainer.</Small>
      <SegmentedBar separated
        segments={ageParts.map((p) => ({ label: p.label, value: vals[p.key], color: p.color, valueLabel: vals[p.key].toFixed(2) + " versions" }))} />
      <div className="text-[13.5px] leading-6 text-primary">
        Mean policy age <span className="font-mono">{total.toFixed(2)}</span> versions. Largest part: <b>{big.label.toLowerCase()}</b> ({pct(vals[big.key] / total)}).
      </div>
    </Demo>
  );
}

const loopCode = `# Illustrative sketch of the data flow.
# Not code from the report; every name is made up.

async def rollout(task):          # many run at once, one per admitted slot
    traj = Trajectory(task)
    while not traj.done:
        if traj.elapsed > task.deadline:
            return                # past its deadline: discarded

        if server.version != traj.cache_version:
            # Weights changed since this context was cached: recompute ALL
            # of it under the new weights, replaying recorded experts.
            server.prefill(traj.context, experts=traj.recorded_experts)
            traj.cache_version = server.version
        else:
            server.prefill(traj.new_tokens)     # only what was added

        # Each generated token is stored with its policy version,
        # its sampling nucleus and its expert selections.
        out = await server.decode(traj)
        traj.append(out, await sandbox.run(out.tool_calls))

    traj.reward = task.verify(traj)             # automated task checks
    if traj.reward > 0 and task.judge_enabled:
        verdict = await judge.review(traj)      # fixed model, never updated
        if verdict.veto or verdict.failed_after_retries:
            traj.reward = 0                     # fail closed
    buffer.put(traj)              # bounded: when full, admission slows

def train():
    while not finished:
        # A group is usable once enough of its rollouts have finished.
        # This batch was packed while the previous step was running.
        batch = pack_by_length(buffer.take_complete_groups())
        trainer.step(batch)       # replays experts, normalizes over nuclei
        trainer.publish()         # servers pull from trainer memory, verify,
                                  # then adopt, each at its own time`;

// ---------- Part 3: fresh input vs generated tokens (toy) ----------
const PROMPT = 4000;
const fmtK = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e5 ? 0 : 1) + "k" : String(x));
function CacheDemo() {
  const [n, setN] = useState(40);
  const [f, setF] = useState(1500);
  const [o, setO] = useState(500);
  const [u, setU] = useState(1);
  const upd = new Set();
  const uu = Math.min(u, n - 1);
  for (let j = 1; j <= uu; j++) upd.add(1 + Math.ceil((j * (n - 1)) / (uu + 1)));
  let input = 0, fresh = 0;
  for (let k = 1; k <= n; k++) {
    const ctx = PROMPT + (k - 1) * (o + f);
    input += ctx;
    fresh += k === 1 || upd.has(k) ? ctx : f;
  }
  const gen = n * o;
  const hit = 1 - fresh / input;
  const ratio = fresh / gen;
  const m = Math.max(fresh, gen);
  const Row = ({ label, v, color }) => (
    <div className="flex items-center gap-2">
      <div className="w-[150px] shrink-0 text-[12.5px] text-primary">{label}</div>
      <div className="h-[16px] min-w-0 grow rounded bg-wash"><div className="h-full rounded" style={{ width: (v / m) * 100 + "%", background: color }} /></div>
      <div className="w-[52px] shrink-0 text-right font-mono text-[12.5px]">{fmtK(v)}</div>
    </div>
  );
  return (
    <Demo title="A high cache-hit rate next to a large prefill bill"
      takeaway={"A toy rollout with made-up sizes: a " + PROMPT.toLocaleString() + "-token prompt, then every turn adds the model's output and one tool result (the new input) to the history. Because each turn resubmits the whole history, the cached total grows with the square of the number of turns and dominates the hit rate. The fresh tokens are a small share of that total and can still outnumber the generated tokens several times over. One full recompute after a policy update adds a whole context's worth of fresh tokens at once."}>
      <Slider label="Turns in the rollout" value={n} min={5} max={80} step={1} onChange={setN} />
      <Slider label="New input tokens per turn" value={f} min={100} max={4000} step={100} onChange={setF} fmt={(v) => v.toLocaleString()} />
      <Slider label="Generated tokens per turn" value={o} min={100} max={2000} step={100} onChange={setO} fmt={(v) => v.toLocaleString()} />
      <Slider label="Full prefills after policy updates" value={u} min={0} max={8} step={1} onChange={setU} />
      <StatsRow columns={3}>
        <StatCard label="Cache-hit rate"><StatCardValue>{pct(hit, 1)}</StatCardValue><StatCardCaption>of {fmtK(input)} input tokens submitted</StatCardCaption></StatCard>
        <StatCard label="Fresh input tokens"><StatCardValue>{fmtK(fresh)}</StatCardValue><StatCardCaption>had to be prefilled</StatCardCaption></StatCard>
        <StatCard label="Fresh input per generated token"><StatCardValue>{ratio.toFixed(1)}×</StatCardValue><StatCardCaption>{ratio > 1 ? "more input processed than output produced" : "less input processed than output produced"}</StatCardCaption></StatCard>
      </StatsRow>
      <div className="flex flex-col gap-[6px]">
        <Row label="Fresh input tokens" v={fresh} color={chartColors[0]} />
        <Row label="Generated tokens" v={gen} color={chartColors[1]} />
      </div>
    </Demo>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="Never wait for the slowest rollout">
        <Lead>
          Reinforcement learning on agent tasks needs a steady stream of finished attempts, but the attempts finish on wildly
          different schedules. This lesson is about the system that keeps training going anyway, and about what that freedom costs.
        </Lead>
        <P>
          A <b>rollout</b> is one complete attempt at a task: the model (the <b>policy</b>) reads the task, thinks, calls tools,
          reads the results, and repeats until it submits. Each round of "model responds, tools run" is a <b>turn</b>. Most rollouts
          finish in minutes, a few run for hours (<LessonLink to="rl" /> has the distribution). A trainer that waited for every
          rollout of a batch would lose a large part of its time to waiting.
        </P>
        <P>
          Beam's stack is therefore <b>asynchronous</b>: rollout generation and training run at the same time instead of taking turns. The trainer takes whatever has finished, updates the weights, and publishes them. Rollouts that are still
          running pick up the new weights and carry on.
        </P>
        <P>
          The price is <b>policy staleness</b>. By the time a rollout is used for training, the weights have moved on from the ones
          that produced it, and a long rollout may have been produced by several versions in a row. The trainer is then learning
          from the behavior of a slightly older model.
        </P>
        <KeyIdea>
          The whole design is a trade between two goals that pull apart: keep the trainer supplied with data, and keep that data
          fresh. Everything else in the stack exists to move work along that path quickly and to measure where it gets old.
        </KeyIdea>

        <H3>Three workloads, three fleets</H3>
        <P>
          Training, model inference and tool execution want different hardware and fail in different ways, so the stack runs them
          as separate services that scale independently. A control service coordinates them. Select a service below to see what
          it does, what data it handles and what happens when it fails.
        </P>
        <Architecture />
        <P>
          Two design choices in this picture matter for the rest of the lesson. First, the control service exchanges only
          metadata and references. The heavy traffic, batches and weights, moves directly between the machines that need it, so
          data movement grows with the training and inference fleets instead of squeezing through one coordinator.
        </P>
        <P>
          Second, the <b>learning recipe is separate from the execution machinery</b>. Researchers decide which tasks run and how
          their results count towards learning, through stable interfaces for rollout generation, sampling and preparation of
          training samples. The infrastructure handles placement, scheduling, data movement and recovery. The report credits
          this split with enabling rapid experimentation during the campaign.
        </P>

        <H3>Two valves control the flow</H3>
        <P>
          The control service has two ways to regulate how much work is in the system. An <b>admission limit</b> caps how many
          rollouts may run at once. A <b>bounded buffer</b> caps how many finished samples may wait for the trainer. When training
          slows down, the buffer fills and fewer new rollouts are admitted, so finished work does not pile up and grow old.
        </P>
        <P>
          These valves limit staleness on average, not in the worst case. A rollout that is already running can live through
          many policy updates, and the report says plainly that the controls do not impose a hard bound on how old a token can be.
        </P>
        <Src>section 4.4 introduction and 4.4.1 (overview, control service, shared infrastructure services), figure 32</Src>
      </Stage>

      <Stage step={2} title="Following one rollout through the stack">
        <Lead>
          This part follows the data: what happens to a rollout when the weights change under it, what is recorded about every
          token, how staleness is measured, and how the trainer and the recovery path are built. The report gives no equations
          for this section, so the notation below is ours and is marked as such.
        </Lead>

        <H3>Generation, batch assembly and training overlap</H3>
        <P>
          The figure below shows the three concurrent activities on one time axis. Read it from the bottom up: rollouts finish
          continuously, finished rollouts are assembled into the next batch, and the trainer consumes one batch per step. Look at
          how the next batch is being assembled while the current one is still being trained on.
        </P>
        <OverlapTimeline />
        <P>
          The trainer publishes new weights after each optimizer step. Inference instances adopt them <b>asynchronously</b>: each
          one pulls the update, verifies it, and only then resumes generating. At any moment different instances may therefore be
          serving different versions.
        </P>

        <H3>When the weights change in the middle of a rollout</H3>
        <P>
          Two terms first. <b>Prefill</b> is the forward pass over input tokens the model has not processed yet; <b>decode</b> is
          generating new tokens one at a time. The <Term def="Key-value cache: the attention keys and values of every token already processed, stored per layer, so that a later token can attend to them without recomputing them.">KV cache</Term> stores
          the attention state of everything processed so far, which is why a later turn normally prefills only what was added
          since the previous one.
        </P>
        <P>
          A cache is only exact for the weights that computed it. So a policy update raises a question for every running
          rollout: throw the cache away and stall, or keep going on a cache that is now slightly wrong. Beam does the second for
          the running turn and repairs the cache at the next turn. Switch between the cases to see each one.
        </P>
        <UpdateDemo />
        <P>
          <b>Expert replay</b> needs a word. Beam is a{" "}
          <Term def="Mixture of experts: each layer holds many feed-forward 'expert' sub-networks, and a small router picks a few of them for each token. Which experts a token is routed to is a discrete choice.">mixture-of-experts (MoE)</Term>{" "}
          model, so each token is routed to a few expert sub-networks. The inference engine records which experts every token
          used. When earlier context is recomputed under new weights, those recorded choices are reused instead of asking the
          router again, so the recomputed context follows the same expert path as the original generation. The trainer reuses the
          same records, for reasons explained in <LessonLink to="rl" />.
        </P>
        <P>
          To make cached context reusable at all, request routing keeps a rollout in one place. A new rollout is assigned to the
          healthy attention rank with the fewest active requests, and keeps that assignment across its tool-use turns.
        </P>

        <H3>What travels with every token</H3>
        <P>
          Because the model that trains on a token is not the model that sampled it, the stack records at generation time what
          the trainer will need to reconstruct the sampling conditions. The table lists each record and who reads it.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead className="w-[150px]">Recorded</TableHead><TableHead>Used by inference</TableHead><TableHead>Used by the trainer</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>Policy version of each generated token</TableCell><TableCell>Not used</TableCell><TableCell>Kept through batch preparation for staleness monitoring and for diagnosing training behavior</TableCell></TableRow>
            <TableRow><TableCell>Expert selections of each token</TableCell><TableCell>Replayed when context is recomputed after an update</TableCell><TableCell>Reused as the routing; activations and routing scores are recomputed under current weights</TableCell></TableRow>
            <TableRow><TableCell>Sampling nucleus of each generation step</TableCell><TableCell>It is the set the token was sampled from</TableCell><TableCell>Token probabilities are normalized over this same set</TableCell></TableRow>
            <TableRow><TableCell>Sample weights</TableCell><TableCell>Not used</TableCell><TableCell>Preserved through packing and placement, so neither changes a sample's contribution to the objective</TableCell></TableRow>
          </TableBody>
        </Table>
        <Small>
          The <Term def="Nucleus (top-p) sampling draws the next token only from the smallest set of most likely tokens whose probabilities add up to p. That set is the nucleus.">nucleus</Term> is
          the truncated set of tokens the sampler was allowed to pick from. Why the trainer must normalize over it, and why
          routing is replayed, belongs to <LessonLink to="rl" />; this lesson only covers how the records are carried.
        </Small>

        <H3>Measuring staleness: policy age</H3>
        <P>
          The per-token version records make staleness measurable. <b>Policy age</b> is a difference between version numbers, not
          a length of time: how many updates separate the weights that generated a token from the weights that train on it.
        </P>
        <Eq label="Policy age of a token (our notation)">
          age = <V>V</V><sub>train</sub> − <V>v</V><sub>token</sub>
        </Eq>
        <P>
          The report splits this age into four named sources: within one rollout, across rollouts in a group, across groups for
          a task, and the remaining gap at consumption. A <b>group</b> is the set of rollouts of the same task that are scored
          against each other (<LessonLink to="rl" />). The report names the four parts but does not print their formulas. One
          decomposition that fits the names and adds up exactly is the telescoping sum below; treat it as our reading.
        </P>
        <Eq label="Four sources (illustrative decomposition, not from the report)">
          age = (<V>v</V><sub>rollout</sub> − <V>v</V><sub>token</sub>) + (<V>v</V><sub>group</sub> − <V>v</V><sub>rollout</sub>) + (<V>v</V><sub>task</sub> − <V>v</V><sub>group</sub>) + (<V>V</V><sub>train</sub> − <V>v</V><sub>task</sub>)
        </Eq>
        <Where items={[
          [<span>v<sub>token</sub></span>, "version of the weights that generated the token (recorded per token)"],
          [<span>v<sub>rollout</sub></span>, "version in use when the token's rollout finished. The first term is staleness within one rollout: early tokens are older than late ones."],
          [<span>v<sub>group</sub></span>, "version when the last rollout of the group finished. The second term is how long a finished rollout waited for its slower siblings."],
          [<span>v<sub>task</sub></span>, "version when the last of the task's groups was complete. The third term is the wait across groups for a task."],
          [<span>V<sub>train</sub></span>, "version of the weights the trainer holds when it consumes the sample. The fourth term is the remaining gap: buffering and batch preparation."],
        ]} />
        <P>
          The demo applies this decomposition to one toy group. Before moving the sliders, look at the default: three rollouts
          finish quickly, one is slow, and the largest slice is not the queue in front of the trainer.
        </P>
        <AgeDemo />
        <P>
          Two rules from the RL recipe keep the slow tail from growing without limit: each task has a rollout deadline after
          which a rollout is discarded, and a group is kept only when enough of its rollouts have completed
          (<LessonLink to="rl" />).
        </P>

        <H3>The whole loop in code</H3>
        <P>
          The sketch below puts the pieces in order: the per-turn check that decides between a small prefill and a full one, the
          judge that can veto a pass, the bounded buffer, and the trainer loop. It is our illustration of the flow the report
          describes, not code from the report.
        </P>
        <CodeBlock code={loopCode} />

        <H3>Serving: keeping prefill out of the way of decode</H3>
        <P>
          Long multi-turn rollouts need a lot of prefill, including the full recomputes after policy updates. In a serving
          instance each attention rank has its own GPU, but the expert layers are shared across all ranks. A large prefill on
          one rank therefore competes for the shared experts and can delay token generation on the others.
        </P>
        <P>
          The fix is scheduling. Prefills are held back briefly and released together in <b>waves</b> across ranks, which leaves
          the decode steps in between free to use a low-latency path for dispatching tokens to experts (DeepEP). The report's
          infrastructure section gives the settings: prefills are chunked into 8,192 tokens per rank, and a prefill is delayed
          by at most 64 forward passes.
        </P>
        <P>
          Memory is the other constraint. Every running request holds a KV cache, so the number of concurrent requests per
          instance is capped to leave room for them, and a rollout keeps its admission reservation while it waits for a tool.
        </P>

        <H3>Training on long, uneven sequences</H3>
        <P>
          The trainer receives rollouts of very different lengths and has to fit them into GPU memory without changing what
          each one contributes. It uses Megatron-style distributed training, which combines three ways of splitting the work
          (tensor, expert and data parallelism), plus the measures below.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead className="w-[190px]">Measure</TableHead><TableHead>What it does</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>Packing by length</TableCell><TableCell>Rollouts of similar length share a packed sequence to reduce padding, and packs are spread across training replicas to limit imbalance. Sequence boundaries are kept, attention never crosses from one rollout to another, and token-level metadata stays aligned.</TableCell></TableRow>
            <TableRow><TableCell>Activation recomputation</TableCell><TableCell>Intermediate activations are not stored for the backward pass; they are recalculated during it. This trades compute for memory, and long-context RL uses it in full.</TableCell></TableRow>
            <TableRow><TableCell>No full-vocabulary logits</TableCell><TableCell>The trainer needs each token's probability only within its recorded nucleus, so it computes those probabilities without ever materializing the tensor of logits over the whole vocabulary.</TableCell></TableRow>
          </TableBody>
        </Table>

        <H3>Moving weights without checkpoints</H3>
        <P>
          Weights change after every optimizer step, and the inference fleet may shard the model differently from the trainer.
          Instead of writing a durable checkpoint and reloading it for each update, serving instances pull the
          weights straight from trainer memory (using NIXL, a transfer library), and the transfer converts between the two
          layouts.
        </P>
        <P>
          To keep load off the trainer, weights are relayed through serving peers in a hierarchy, with a direct read from the
          trainer as the fallback. Each instance pauses generation, verifies what it received, and only then adopts the version.
          Nothing forces the fleet to switch at the same instant.
        </P>

        <H3>Recovery: local when possible, checkpoint when not</H3>
        <P>
          The stack distinguishes failures it can absorb from failures that break consistency. The table lists each case. The
          last row is the expensive one, and the reason checkpoints include the data pipeline: generation and batch preparation
          run ahead of the optimizer, so restoring the model alone would leave the data stream out of step.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead className="w-[190px]">What fails</TableHead><TableHead>Response</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>A rollout worker</TableCell><TableCell>Recovered locally.</TableCell></TableRow>
            <TableRow><TableCell>A serving pod</TableCell><TableCell>Replaced on a healthy node; unhealthy routing targets are excluded. If a rack lacks enough healthy nodes, the scheduler relocates the affected inference group.</TableCell></TableRow>
            <TableRow><TableCell>Verification of received weights, after retries</TableCell><TableCell>The serving instance is failed instead of serving unverified weights.</TableCell></TableRow>
            <TableRow><TableCell>A judge request, after retries</TableCell><TableCell>Under fail-closed configuration the rollout is failed, so an unreviewed verifier pass never becomes a positive reward.</TableCell></TableRow>
            <TableRow><TableCell>The trainer or the control service</TableCell><TableCell>Coordinated restart from a completed checkpoint: model, optimizer, training counters and data-pipeline state. The restored policy is loaded into inference before generation resumes. Work past the checkpoint may be discarded and regenerated; rollouts are not replayed exactly.</TableCell></TableRow>
          </TableBody>
        </Table>
        <Src>section 4.4.1, figures 33 and 34; section 6.4.3 (memory optimization) and 6.4.6 (inference and judge execution), to which 4.4.1 refers; rollout deadlines from section 4.1.2</Src>
      </Stage>

      <Stage step={3} title="Four lessons from twelve production jobs">
        <Lead>
          The report closes the section with what running the stack taught the team. All four lessons have the same shape: an
          obvious metric looked fine, or looked like the thing to tune, and the real constraint was somewhere else.
        </Lead>
        <StatsRow columns={4}>
          <StatCard label="Production jobs"><StatCardValue>12</StatCardValue><StatCardCaption>on this stack</StatCardCaption></StatCard>
          <StatCard label="Rollout executions"><StatCardValue>80M+</StatCardValue><StatCardCaption>100M+ with derisking and MOPD</StatCardCaption></StatCard>
          <StatCard label="Trainer GPUs"><StatCardValue>1,920</StatCardValue><StatCardCaption>peak configured capacity</StatCardCaption></StatCard>
          <StatCard label="Inference GPUs"><StatCardValue>8,576</StatCardValue><StatCardCaption>peak configured capacity</StatCardCaption></StatCard>
        </StatsRow>
        <Small>
          Each job runs in its own Ray cluster (Ray is a framework for distributed Python programs). MOPD, the distillation
          stage of <LessonLink to="mopd" />, reuses this infrastructure.
        </Small>

        <H3>1. Where staleness comes from</H3>
        <P>
          The team broke policy age into its four sources for eleven of the twelve jobs, in 30-minute windows
          (one job has no recorded breakdown). The report shows this as a stacked area chart, figure 35, normalized so that the mean
          total policy age is 1. It prints no per-component numbers, so the chart is not reproduced here; its one stated result
          is below.
        </P>
        <Surprise title="Most staleness came from siblings finishing at different times, not from the queue">
          The natural suspect for stale data is waiting: samples sitting in a buffer until the trainer gets to them. Instead,
          across the instrumented jobs, version differences between rollouts of the same group were the largest component of
          policy age. Managing staleness therefore meant paying attention to uneven progress of trajectories, as well as to
          queueing. The team used these measurements, together with execution traces and queue metrics, to adjust rollout
          admission and to diagnose delays.
        </Surprise>

        <H3>2. Concurrency has to be retuned as the workload changes</H3>
        <P>
          The number of concurrent rollouts needed to keep the trainer supplied depended on how long rollouts ran and on the
          task mix. The team raised admission when the trainer was left waiting for batches, and lowered it when generation
          outpaced consumption or policy age rose.
        </P>
        <P>
          There is also a ceiling. In a tuning sweep before the run, pushing concurrency beyond serving capacity added latency
          and did not improve generation throughput. Past that point, more rollouts in flight only made each one slower. The right setting moved with the workload and was revisited throughout training.
        </P>

        <H3>3. Memory is not a function of sequence length alone</H3>
        <Surprise title="Out-of-memory failures inside the configured sequence-length limit">
          One would expect a length limit to bound the trainer's memory. It did not. In some cases the generated content routed
          a large share of tokens to a small subset of MoE experts, and the trainer ran out of memory even though the sequences
          were within the limit. Some incidents involved repetitive output, but another followed a change in the task mixture
          with no repetition at all. Token counts and aggregate memory metrics did not show the pressure building; the team
          concluded that expert-routing concentration had to be monitored as well.
        </Surprise>

        <H3>4. A high cache-hit rate hides a large prefill workload</H3>
        <Surprise title="Cache-hit rates above 94%, and still more fresh input than output">
          A cache-hit rate above 94% suggests input processing is almost free. Yet fresh input tokens, the ones that had to be
          prefilled, outnumbered generated tokens through much of the run. Multi-turn rollouts resubmit a growing history on
          every turn, so even a small uncached share of a very large total is a lot of tokens. The report adds a caution: these
          are token volumes and do not directly measure the relative compute cost of prefill and decode.
        </Surprise>
        <P>
          The demo below reproduces the arithmetic with a toy rollout. With the default settings the hit rate is about 94% and
          the model still processes several fresh input tokens for every token it generates.
        </P>
        <CacheDemo />
        <P>
          This is why the serving layer measures fresh prefill separately from decoding and schedules the two together, as
          described in part 2.
        </P>

        <H3>What to monitor, in one table</H3>
        <P>The four lessons, restated as the metric that seemed sufficient and the one that turned out to be needed.</P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Concern</TableHead><TableHead>Obvious metric</TableHead><TableHead>What it missed</TableHead><TableHead>Also watch</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>Staleness</TableCell><TableCell>Queue before training</TableCell><TableCell>Siblings in a group finishing at different versions</TableCell><TableCell>Policy age by source, from per-token version records</TableCell></TableRow>
            <TableRow><TableCell>Throughput</TableCell><TableCell>Rollouts in flight</TableCell><TableCell>Beyond serving capacity, more concurrency only adds latency</TableCell><TableCell>Trainer waiting, policy age, and the task mix</TableCell></TableRow>
            <TableRow><TableCell>Trainer memory</TableCell><TableCell>Sequence length, aggregate memory</TableCell><TableCell>Tokens concentrating on a few experts</TableCell><TableCell>Expert-routing concentration</TableCell></TableRow>
            <TableRow><TableCell>Input processing</TableCell><TableCell>Cache-hit rate</TableCell><TableCell>Fresh input volume larger than generated volume</TableCell><TableCell>Fresh prefill tokens, separately from decode</TableCell></TableRow>
          </TableBody>
        </Table>
        <Src>section 4.4 introduction, section 4.4.2, figure 35</Src>
      </Stage>
    </div>
  );
}
