const meta = {
  id: "rl",
  nav: "Agentic RL",
  title: "High-compute RL for the agentic expert",
  question: "How do you keep policy-gradient RL stable when one rollout takes 12 minutes, another takes six hours, and the weights change while both are still running?",
  minutes: 16,
  // Three to five sentences a reader should remember. Shown in a box at the end of the lesson.
  takeaways: [
    "Rollout durations are heavy-tailed (median about 12 minutes, about 2% over an hour), so generation is decoupled from optimization: inference workers take new weights after every optimizer step and rollouts in flight keep going, which means one trajectory can be written by several policy versions.",
    "Asynchrony is only safe if the trainer scores each sampled token the way the sampler did. Beam records, per token, the policy version, the nucleus it was sampled from and the MoE experts it used, renormalizes the training policy over that nucleus, replays those experts, and runs the LM head, router and residual stream in FP32 on both sides.",
    "What is left over was measured: a median sampler-trainer KL of 2.2e-4 nats per token against 8.7e-5 right after a restart, with tokens on average five policy versions behind the trainer, and a gradient norm that stayed in a narrow band for the whole run.",
    "The reward is binary correctness minus a linear length cost. A judge zeroes the correctness of verifier-passing rollouts that it flags as reward hacks, and a rollout that exhausts its reasoning-effort budget gets no correctness reward.",
    "The policy did not simply sharpen: final-answer tokens became much more predictable (NLL 0.25 to 0.06 nats) while reasoning tokens became slightly less so (0.63 to 0.69). Skills held through single-domain phases, and BrowseComp rose from 50.1 to 57.9 before any search task was trained.",
  ],
};

// ---------------------------------------------------------------------
// Demo 1: waiting for the batch versus asynchronous generation (toy).
// ---------------------------------------------------------------------
const SLOTS = 6;
const HORIZON = 120;
const STEP_EVERY = 4;
const toyDuration = (slot, k) => (slot === 2 && k === 0 ? 78 : 8 + ((slot * 7 + k * 5 + slot * k * 3) % 8));

function simulateSchedule(mode) {
  const rollouts = [];
  const steps = [];
  if (mode === "sync") {
    let t = 0, k = 0;
    while (t < HORIZON) {
      let longest = 0;
      for (let s = 0; s < SLOTS; s++) {
        const d = toyDuration(s, k);
        rollouts.push({ slot: s, start: t, end: t + d });
        longest = Math.max(longest, d);
      }
      t += longest; k += 1;
      if (t <= HORIZON) steps.push(t);
    }
  } else {
    const ends = [];
    for (let s = 0; s < SLOTS; s++) {
      let t = 0, k = 0;
      while (t < HORIZON) {
        const d = toyDuration(s, k);
        rollouts.push({ slot: s, start: t, end: t + d });
        if (t + d <= HORIZON) ends.push(t + d);
        t += d; k += 1;
      }
    }
    ends.sort((a, b) => a - b);
    for (let i = STEP_EVERY - 1; i < ends.length; i += STEP_EVERY) steps.push(ends[i]);
  }
  let busy = 0, maxSpan = 1;
  const segments = [];
  const bars = [];
  rollouts.forEach((r) => {
    const end = Math.min(r.end, HORIZON);
    busy += end - r.start;
    const cuts = [r.start, ...steps.filter((x) => x > r.start && x < end), end];
    maxSpan = Math.max(maxSpan, cuts.length - 1);
    for (let i = 0; i < cuts.length - 1; i++) {
      const version = steps.filter((x) => x <= cuts[i]).length;
      segments.push({ from: cuts[i] - r.start, to: cuts[i + 1] - r.start, version });
    }
    bars.push({ slot: r.slot, start: r.start, end, segments: segments.splice(0) });
  });
  return { bars, steps, utilisation: busy / (SLOTS * HORIZON), maxSpan };
}

function ReadOut({ label, value, note }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-wash px-3 py-2">
      <span className="text-[11.5px] leading-4 text-secondary">{label}</span>
      <span className="font-mono text-[17px] leading-7 text-primary">{value}</span>
      {note ? <span className="text-[11.5px] leading-4 text-secondary">{note}</span> : null}
    </div>
  );
}

function AsyncDemo() {
  const [mode, setMode] = useState("async");
  const sim = useMemo(() => simulateSchedule(mode), [mode]);
  const left = (t) => (t / HORIZON) * 100 + "%";
  return (
    <Demo title="Six inference slots, two hours, one slow rollout"
      takeaway={mode === "sync"
        ? "Waiting for the batch: every slot sits idle until the slowest rollout of its batch finishes, and the optimizer gets very few steps. Each rollout is written by exactly one policy version, which is the only thing this schedule has going for it."
        : "Asynchronous: no slot ever waits and the optimizer steps many times, but the weights change under rollouts that are still running. Follow the long bar in slot 3: its colour changes at every optimizer step, so its tokens come from many policy versions."}>
      <SegmentedControl value={mode} onValueChange={(v) => v && setMode(v)} size="small" aria-label="Schedule">
        <SegmentedControlItem value="sync">Wait for the whole batch</SegmentedControlItem>
        <SegmentedControlItem value="async">Asynchronous</SegmentedControlItem>
      </SegmentedControl>
      <div className="flex flex-col gap-[6px]">
        {Array.from({ length: SLOTS }, (_, s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="w-[44px] shrink-0 text-[11.5px] leading-4 text-secondary">slot {s + 1}</span>
            <div className="relative h-[20px] grow overflow-hidden rounded bg-wash">
              {sim.bars.filter((b) => b.slot === s).map((b, i) => (
                <div key={i} className="absolute top-0 h-full pr-[3px]" style={{ left: left(b.start), width: left(b.end - b.start) }}>
                  <div className="relative h-full w-full overflow-hidden rounded-[3px]">
                    {b.segments.map((g, j) => (
                      <div key={j} className="absolute top-0 h-full"
                        style={{ left: (g.from / (b.end - b.start)) * 100 + "%", width: ((g.to - g.from) / (b.end - b.start)) * 100 + "%", background: chartColors[g.version % chartColors.length] }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-[44px] shrink-0 text-[11.5px] leading-4 text-secondary">steps</span>
          <div className="relative h-[14px] grow">
            {sim.steps.map((t, i) => (
              <div key={i} className="absolute top-0 h-full w-[2px] rounded bg-elevated" style={{ left: left(t), background: "rgb(var(--text-primary))" }} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[44px] shrink-0" />
          <div className="flex grow justify-between font-mono text-[11px] leading-4 text-secondary">
            <span>0</span><span>30</span><span>60</span><span>90</span><span>120 min</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ReadOut label="Optimizer steps in two hours" value={sim.steps.length} />
        <ReadOut label="Share of slot time spent generating" value={pct(sim.utilisation)} />
        <ReadOut label="Most policy versions in one rollout" value={sim.maxSpan} />
      </div>
      <Small>How to read it: each rounded bar is one rollout. Its colour is the policy version that generated those tokens, so a
      bar with several colours was written by several versions. A tick in the bottom row is an optimizer step, and grey is an
      idle slot. The durations, the six slots and the rule "step after every
      four finished rollouts" are made up for the picture; only the shape of the problem is the report's.</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 2: nucleus sampling and the renormalized training policy (toy).
// ---------------------------------------------------------------------
const toyTokens = [
  { tok: "return", p: 0.55 }, { tok: "result", p: 0.2 }, { tok: "yield", p: 0.1 }, { tok: "print", p: 0.06 },
  { tok: "raise", p: 0.04 }, { tok: "pass", p: 0.03 }, { tok: "del", p: 0.015 }, { tok: "junk", p: 0.005 },
];
function NucleusDemo() {
  const [p, setP] = useState(0.99);
  const { rows, z, kept } = useMemo(() => {
    let cum = 0, closed = false;
    const keep = toyTokens.map((t) => { const k = !closed; cum += t.p; if (cum >= p - 1e-9) closed = true; return k; });
    const mass = toyTokens.reduce((s, t, i) => s + (keep[i] ? t.p : 0), 0);
    return {
      z: mass, kept: keep.filter(Boolean).length,
      rows: toyTokens.map((t, i) => ({ tok: t.tok, raw: +(t.p * 100).toFixed(2), renorm: keep[i] ? +((t.p / mass) * 100).toFixed(2) : 0 })),
    };
  }, [p]);
  const cfg = {
    raw: { label: "Full-vocabulary probability (%)", color: chartColors[0] },
    renorm: { label: "Renormalized over the nucleus (%)", color: chartColors[1] },
  };
  return (
    <Demo title="What the sampler really draws from"
      takeaway={"At the default p = 0.99 only the rarest toy token is cut, and every kept token's probability is divided by " + z.toFixed(3) +
        ". Lower p to see the effect grow: the second bar is the distribution the sampler used, and it is the one the trainer must differentiate. Bars at zero are tokens that could not have been sampled, so they get no gradient from this position."}>
      <Slider label="Nucleus threshold p" value={p} min={0.5} max={1} step={0.01} onChange={setP} fmt={(v) => v.toFixed(2)} />
      <ChartContainer config={cfg} style={{ height: 230, width: "100%" }}>
        <BarChart data={rows}>
          <ChartGrid /><ChartXAxis dataKey="tok" interval={0} /><ChartYAxis title="probability (%)" />
          <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
          <ChartBar dataKey="raw" /><ChartBar dataKey="renorm" />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-3 gap-2">
        <ReadOut label="Tokens in the nucleus" value={kept + " of " + toyTokens.length} />
        <ReadOut label="Probability mass kept, Z" value={z.toFixed(3)} />
        <ReadOut label="Shift in each kept log-prob" value={"+" + (-Math.log(z)).toFixed(4)} note="nats, equal to -ln Z" />
      </div>
      <Small>The eight tokens and their probabilities are made up. Beam samples with p = 0.99 at temperature 1.0.</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 3: routing replay (toy).
// ---------------------------------------------------------------------
const toyRouter = [1.2, 0.35, 2.1, -0.4, 2.07, 0.9, 2.6, 0.1];
const toyNoise = [0.3, -0.5, -1, 0.2, 1, -0.4, 0.1, 0.6];
const TOP_K = 2;
const topK = (scores) => scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).slice(0, TOP_K).map((x) => x[1]);
function RoutingDemo() {
  const [eps, setEps] = useState(0.02);
  const [replay, setReplay] = useState("off");
  const trainer = toyRouter.map((s, i) => s + eps * toyNoise[i]);
  const samplerSet = topK(toyRouter);
  const trainerOwn = topK(trainer);
  const used = replay === "on" ? samplerSet : trainerOwn;
  const same = samplerSet.every((i) => used.includes(i));
  const zs = used.reduce((s, i) => s + Math.exp(trainer[i]), 0);
  const names = (set) => [...set].sort((a, b) => a - b).map((i) => "E" + (i + 1)).join(" and ");
  return (
    <Demo title="One token at one MoE layer: which experts does the trainer run?"
      takeaway={replay === "on"
        ? "With replay the trainer skips its own top-k choice and runs the experts the sampler recorded. Only the gate weights are recomputed from the trainer's scores, so they stay differentiable and track the current weights. Move the slider: the experts no longer change."
        : same
          ? "The two engines agree here. Raise the difference past about 0.015 and the near-tie between E3 and E5 flips."
          : "A score difference of a few hundredths flips the near-tie between E3 and E5. The trainer would now push this token through an expert the sampler never used, and compute a log-probability for a forward pass that never happened."}>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl value={replay} onValueChange={(v) => v && setReplay(v)} size="small" aria-label="Routing replay">
          <SegmentedControlItem value="off">Trainer picks its own top-2</SegmentedControlItem>
          <SegmentedControlItem value="on">Routing replay</SegmentedControlItem>
        </SegmentedControl>
        <Badge variant={same ? "success" : "destructive"}>{same ? "Same experts as the sampler" : "Different experts from the sampler"}</Badge>
      </div>
      <Slider label="Score difference between engines" value={eps} min={0} max={0.05} step={0.005} onChange={setEps} fmt={(v) => v.toFixed(3)} />
      <div className="grid grid-cols-4 gap-2">
        {toyRouter.map((s, i) => {
          const bySampler = samplerSet.includes(i), byTrainer = used.includes(i);
          const tone = bySampler && byTrainer ? "bg-tint-green" : byTrainer ? "bg-tint-red" : bySampler ? "bg-tint-orange" : "bg-wash";
          return (
            <div key={i} className={"flex min-w-0 flex-col gap-[2px] rounded-lg px-2 py-2 " + tone}>
              <span className="text-[12px] font-semibold leading-4 text-primary">E{i + 1}</span>
              <span className="font-mono text-[11.5px] leading-4 text-secondary">sampler {s.toFixed(2)}</span>
              <span className="font-mono text-[11.5px] leading-4 text-secondary">trainer {trainer[i].toFixed(2)}</span>
              <span className="min-h-[16px] text-[11.5px] leading-4 text-primary">
                {bySampler && byTrainer ? "used by both" : byTrainer ? "trainer only" : bySampler ? "sampler only" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ReadOut label="Sampler ran" value={names(samplerSet)} />
        <ReadOut label="Trainer runs" value={names(used)} />
        <ReadOut label="Trainer gate weights" value={[...used].sort((a, b) => a - b).map((i) => (Math.exp(trainer[i]) / zs).toFixed(2)).join(" / ")} />
      </div>
      <Small>Made up for the demo: eight experts, top-2 selection, the router scores, and gate weights taken as a softmax over
      the selected scores. The report gives none of these details here; it says only that the selected experts are recorded and
      reused while the gate values are recomputed.</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 4: from outcomes to rewards to group-relative advantages (toy).
// ---------------------------------------------------------------------
const toyGroup = [
  { id: "A", pass: true, ktok: 12 }, { id: "B", pass: true, ktok: 30 }, { id: "C", pass: true, ktok: 9 },
  { id: "D", pass: false, ktok: 14 }, { id: "E", pass: false, ktok: 36 }, { id: "F", pass: false, ktok: 6 },
];
function GroupDemo() {
  const [hack, setHack] = useState(true);
  const [lam, setLam] = useState(0.004);
  const [budget, setBudget] = useState(40);
  const rows = useMemo(() => {
    const r = toyGroup.map((g) => {
      const cut = g.ktok >= budget;
      const flagged = hack && g.id === "C" && !cut;
      const ktok = cut ? budget : g.ktok;
      const outcome = cut ? "budget exhausted" : !g.pass ? "verifier fails" : flagged ? "passes, judged a hack" : "passes, judged clean";
      const correct = !cut && g.pass && !flagged ? 1 : 0;
      return { id: g.id, ktok, outcome, correct, bad: cut || flagged, reward: correct - lam * ktok };
    });
    const mean = r.reduce((s, x) => s + x.reward, 0) / r.length;
    const sd = Math.sqrt(r.reduce((s, x) => s + (x.reward - mean) ** 2, 0) / r.length) || 1;
    return r.map((x) => ({ ...x, adv: (x.reward - mean) / sd }));
  }, [hack, lam, budget]);
  return (
    <Demo title="One group of six rollouts on the same task"
      takeaway="Three things to try. Turn the judge off and rollout C, the shortest pass, becomes the best in the group; turn it on and C scores exactly like a failed attempt of 9K tokens. Raise the length cost and the gap between A and B widens although both are correct. Lower the budget to 30K or less and B is cut off before it finishes, so it loses its correctness reward.">
      <div className="flex items-center gap-3 text-[13px] text-primary">
        <Switch checked={hack} onCheckedChange={setHack} aria-label="Judge flags rollout C" />
        <span>The judge flags rollout C as a reward hack (its patch edited the tests)</span>
      </div>
      <Slider label="Length cost λ per 1K output tokens" value={lam} min={0} max={0.01} step={0.001} onChange={setLam} fmt={(v) => v.toFixed(3)} />
      <Slider label="Effort budget (K output tokens)" value={budget} min={10} max={40} step={2} onChange={setBudget} fmt={(v) => v + "K"} />
      <Table wrapText rowLines>
        <TableHeader><TableRow>
          <TableHead>Rollout</TableHead><TableHead>Outcome</TableHead>
          <TableHead className="text-right">Output (K tokens)</TableHead><TableHead className="text-right">Reward</TableHead>
          <TableHead className="text-right">Advantage</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.id}</TableCell>
              <TableCell><span className={r.bad ? "text-red" : ""}>{r.outcome}</span></TableCell>
              <TableCell className="text-right font-mono">{r.ktok}</TableCell>
              <TableCell className="text-right font-mono">{r.reward.toFixed(3)}</TableCell>
              <TableCell className={"text-right font-mono " + (r.adv >= 0 ? "text-green" : "text-red")}>{r.adv >= 0 ? "+" : ""}{r.adv.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Small>The six rollouts, the cost coefficient and the budget in thousands of tokens are made up. The report publishes
      neither the coefficient nor the group size, and it does not say how an effort value maps to a token budget. The advantage
      column uses the textbook group normalization shown above.</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Static figures built from numbers the report prints.
// ---------------------------------------------------------------------
const rewardFlow = [
  { title: "Rollout ends", sub: "If it ran out of its effort budget: correctness 0." },
  { title: "Task verifier", sub: "Automated check. If it fails: correctness 0." },
  { title: "Hack judge", sub: "Reads the final patch of passing rollouts. If flagged: correctness 0." },
  { title: "Reward", sub: "Correctness (1 only if every check was survived) minus the length cost." },
];
function RewardFlow() {
  return (
    <div className="flex flex-wrap items-stretch gap-y-2">
      {rewardFlow.map((n, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <span className="flex w-[22px] shrink-0 items-center justify-center text-secondary">
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 6h13M10 2l4 4-4 4" />
              </svg>
            </span>
          ) : null}
          <div className={"flex min-w-[96px] flex-1 flex-col gap-1 rounded-lg px-3 py-2 " + (i === rewardFlow.length - 1 ? "bg-tint-blue" : "bg-wash")}>
            <span className="text-[13px] font-semibold leading-5 text-primary">{n.title}</span>
            <span className="text-[12px] leading-[18px] text-secondary">{n.sub}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function BarRow({ label, value, max, text, color }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5 text-primary">
        <span>{label}</span><span className="shrink-0 font-mono">{text}</span>
      </div>
      <div className="h-[10px] w-full rounded bg-wash">
        <div className="h-full rounded" style={{ width: (value / max) * 100 + "%", background: color }} />
      </div>
    </div>
  );
}

const nllRows = [
  { ch: "All sampled tokens", start: 0.37, end: 0.5 },
  { ch: "Reasoning tokens", start: 0.63, end: 0.69 },
  { ch: "Final-answer tokens", start: 0.25, end: 0.06 },
];
const nllCfg = { start: { label: "Start of the run", color: chartColors[0] }, end: { label: "End of the run", color: chartColors[1] } };

const runPhases = [
  { from: 0, to: 26, label: "not specified", tone: "bg-wash" },
  { from: 26, to: 52, label: "math, STEM, competitive programming only", tone: "bg-tint-blue" },
  { from: 52, to: 65, label: "software engineering only", tone: "bg-tint-purple" },
  { from: 65, to: 83, label: "not specified, but no search or browsing tasks", tone: "bg-wash" },
  { from: 83, to: 100, label: "harder software-engineering set added", tone: "bg-tint-orange" },
];
const runMarks = [
  { at: 27, text: "BrowseComp tracking starts (50.1)" },
  { at: 39, text: "checkpoint in figure 16" },
  { at: 79, text: "checkpoint in figure 16: DeepSWE 35%" },
  { at: 83, text: "BrowseComp 57.9; first point where search tasks may appear" },
  { at: 100, text: "final checkpoint: DeepSWE 41%" },
];
function RunTimeline() {
  return (
    <Panel title="The run on one axis (percent of run completed)"
      caption="Built only from the percentages the report prints. The report says the mixture changed five times but names four boundaries (26%, 52%, 65%, 83%); it does not say what was trained in the unlabelled stretches, and it does not say that search tasks were added at 83%, only that none were trained before it.">
      <div className="flex flex-col gap-1">
        <div className="relative h-[26px] w-full overflow-hidden rounded border border-primary">
          {runPhases.map((ph, i) => (
            <div key={i} className={"absolute top-0 h-full border-r border-primary " + ph.tone} style={{ left: ph.from + "%", width: ph.to - ph.from + "%" }} />
          ))}
          {runMarks.map((m, i) => (
            <div key={i} className="absolute top-0 h-full w-[2px]" style={{ left: "calc(" + m.at + "% - " + (m.at === 100 ? 2 : 1) + "px)", background: "rgb(var(--text-primary))" }} />
          ))}
        </div>
        <div className="relative h-[16px] w-full font-mono text-[11px] leading-4 text-secondary">
          {[0, 26, 52, 65, 83].map((x) => <span key={x} className="absolute" style={{ left: x + "%" }}>{x}%</span>)}
          <span className="absolute right-0">100%</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Shaded phases: what was trained</div>
          {runPhases.map((ph, i) => (
            <div key={i} className="flex items-start gap-2 text-[12.5px] leading-5 text-primary">
              <span className={"mt-[4px] h-3 w-3 shrink-0 rounded-sm border border-primary " + ph.tone} />
              <span><span className="font-mono text-secondary">{ph.from} to {ph.to}%</span> {ph.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Vertical lines: what was measured</div>
          {runMarks.map((m, i) => (
            <div key={i} className="flex items-start gap-2 text-[12.5px] leading-5 text-primary">
              <span className="w-[38px] shrink-0 font-mono text-secondary">{m.at}%</span><span>{m.text}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

const samplerCode = `# Illustrative sketch, not code from the report.
# Inference side: sample one token and log what the trainer will need.
def sample_token(model, ctx, policy_version):
    h, experts = model.forward(ctx)            # experts: top-k choice per MoE layer
    probs = softmax(lm_head(h).float())        # FP32 head, temperature 1.0
    nucleus = smallest_top_set(probs, mass=0.99)
    token = sample(renormalize(probs, nucleus))
    return Record(token, policy_version, nucleus, experts)`;

const trainerCode = `# Illustrative sketch, not code from the report.
# Trainer side: one optimizer step over groups that met their deadlines.
for group in ready_groups:                     # one task, several rollouts
    r = [correct(y) * (not judged_hack(y)) - lam * y.output_tokens for y in group]
    adv = (r - mean(r)) / std(r)               # group-relative advantage
    for y, a in zip(group, adv):
        h = model.forward(y.context, experts=y.experts)   # routing replay
        logits = lm_head(h).float()                       # FP32 on both sides
        logits = logits.masked_fill(~y.nucleus, -inf)     # the sampler's support
        logp = log_softmax(logits)[y.tokens]              # renormalized
        loss += -(a * logp).sum()
loss.backward(); optimizer.step()
publish_weights_to_inference_workers()         # rollouts in flight keep running`;

function Lesson() {
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="Train without waiting for the slowest rollout">
        <Lead>
          After a short supervised warm-up (<LessonLink to="sft" />), the agentic expert learns by doing. This lesson explains how
          that reinforcement learning run is organized so that thousands of slow, uneven attempts can feed one optimizer without
          the training signal drifting away from what the model actually did.
        </Lead>
        <P>
          Some vocabulary first. The <b>policy</b> is the model seen as a decision maker: given everything so far, it outputs a
          probability for each possible next token. A <b>rollout</b> (or trajectory) is one complete attempt at a task: the model
          reasons, calls tools, reads their results and finally answers. A <b>verifier</b> is an automated check, such as a hidden
          test suite, that says whether the attempt succeeded.
        </P>
        <P>
          The learning rule is a policy gradient in the style of GRPO (group relative policy optimization). The model attempts the
          same task several times, and the attempts that scored above the group's average have their tokens made more likely, while
          the ones below average have theirs made less likely. The group's own average serves as the baseline that decides what
          counts as a good attempt.
        </P>

        <H3>The problem: rollouts finish at very different times</H3>
        <P>
          Agentic tasks do not take a fixed amount of time. Most finish in minutes, but a few run for hours, and a batch is only
          complete when its slowest member is.
        </P>
        <StatsRow columns={3}>
          <StatCard label="Median rollout"><StatCardValue>~12 min</StatCardValue><StatCardCaption>from start to finish</StatCardCaption></StatCard>
          <StatCard label="Longer than an hour"><StatCardValue>~2%</StatCardValue><StatCardCaption>of rollouts</StatCardCaption></StatCard>
          <StatCard label="Steps touched by the tail"><StatCardValue>~1 in 5</StatCardValue><StatCardCaption>training steps used a rollout that took over six hours</StatCardCaption></StatCard>
        </StatsRow>
        <P>
          The third number is the one that decides the design. If every step waited for all of its rollouts, a fifth of the steps
          would each wait more than six hours, with the inference fleet idle in the meantime.
        </P>
        <P>
          Beam therefore decouples generation from optimization. The trainer steps on whatever finished rollouts it has instead
          of waiting for a fixed batch, and the inference workers switch to the new weights after every step. Rollouts that are in the
          middle of a task are not restarted. They simply continue under the new weights. The demo below shows both schedules on
          the same toy workload; compare the number of optimizer steps, then look at what happens to the long rollout.
        </P>
        <AsyncDemo />
        <P>
          Two rules keep the tail under control. Deadlines are task-dependent, so a long task is given longer than a short one, and
          a rollout that misses it is thrown away. A group of rollouts on the same task is used only if enough of its members
          finished, since a group-relative score needs a group. The machinery that pushes weights to the workers is the subject
          of <LessonLink to="infra" />.
        </P>

        <H3>The price: the sampler and the trainer can disagree</H3>
        <P>
          A policy gradient asks the trainer to recompute the probability of each token that was sampled and then to raise or
          lower it. That is only meaningful if the trainer's computation matches the one that produced the token. The inference
          engine (the <b>sampler</b>) and the training engine (the <b>trainer</b>) are different pieces of software running
          different weights at different times, so there are several ways for them to drift apart.
        </P>
        <KeyIdea>
          Record, for every sampled token, exactly how it was produced, and make the trainer reproduce that computation. Whatever
          mismatch cannot be removed, which is mostly the age of the weights, is measured rather than assumed away.
        </KeyIdea>
        <P>
          The table lists the four sources of mismatch the report names, in the order part 2 explains them. Read the last column
          as "what is still different after the fix".
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow>
            <TableHead className="w-[30%]">Source of mismatch</TableHead><TableHead className="w-[40%]">What Beam does</TableHead><TableHead>What remains</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableRow>
              <TableCell><b>Stale weights.</b> A token was sampled by an older policy than the one being trained.</TableCell>
              <TableCell>Record the policy version of every token; update workers after every step; drop rollouts past their deadline.</TableCell>
              <TableCell>Not removed. Tokens are on average five versions old.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><b>Truncated sampling.</b> The sampler draws only from the most likely tokens; the trainer sees the whole vocabulary.</TableCell>
              <TableCell>Store the set of allowed tokens per position and renormalize the training policy over the same set.</TableCell>
              <TableCell>Nothing from truncation itself.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><b>Expert routing.</b> A tiny numeric difference sends a token through different experts.</TableCell>
              <TableCell>Routing replay: reuse the experts the sampler chose. The router is frozen during RL.</TableCell>
              <TableCell>Gate values are still recomputed with current weights.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><b>Numerical precision.</b> Two engines round differently.</TableCell>
              <TableCell>Run the LM head, the router and the residual stream in 32-bit floats on both sides.</TableCell>
              <TableCell>Small residual differences.</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <H3>The other half: a reward that cannot be gamed cheaply</H3>
        <P>
          Stable optimization is worthless if it optimizes the wrong thing. For software-engineering and terminal tasks, passing
          the verifier does not prove the work is valid: a model can edit the tests, hard-code the expected outputs or exploit a
          weakness in the evaluation harness. This is called <b>reward hacking</b>.
        </P>
        <P>
          So every rollout that passes its verifier is also read by a <b>judge</b>, an internally configured model that applies a
          reward-hacking rubric to the final patch. If the judge flags the rollout, its correctness is set to zero. The rollout
          still pays for its length, so it ends up with exactly the reward of a failed attempt that used the same number of tokens.
        </P>
        <Panel title="From a finished rollout to its reward" caption={<span>The judge can only lower a reward: it is applied to rollouts that pass the verifier, never to ones that fail. How tasks and verifiers are built for each domain is covered in <LessonLink to="tasks" />.</span>}>
          <RewardFlow />
        </Panel>
        <P>
          The reward also charges for tokens. The model receives a <b>reasoning effort</b> setting as an input, which fixes the
          budget for the rollout, and a length cost makes the shorter of two equally correct solutions score higher. Training
          across many effort settings teaches the model to fit its spending to the budget it was given.
        </P>
      </Stage>

      <Stage step={2} title="The objective, and the three things recorded with every token">
        <P>
          This part goes through the mechanism in the order the data flows: the objective, what the sampler logs, how the trainer
          uses each logged item, and how the reward is computed. It ends with a code sketch that puts the pieces together.
        </P>

        <H3>The objective</H3>
        <P>
          The report says only that the method is "GRPO-style" and does not print its loss. The two equations below are the
          textbook form, given so the later corrections have something to attach to. First, each rollout's reward is compared with
          the other rollouts on the same task.
        </P>
        <Eq label="Group-relative advantage (textbook form, not from the report)">
          <V>A</V><sub><V>i</V></sub> = ( <V>r</V><sub><V>i</V></sub> − mean<sub><V>j</V> ∈ group</sub> <V>r</V><sub><V>j</V></sub> ) / std<sub><V>j</V> ∈ group</sub> <V>r</V><sub><V>j</V></sub>
        </Eq>
        <P>Then the log-probability of every token in the rollout is weighted by that advantage.</P>
        <Eq label="Policy-gradient loss (textbook form, not from the report)">
          <V>L</V>(<V>θ</V>) = − Σ<sub><V>i</V></sub> <V>A</V><sub><V>i</V></sub> Σ<sub><V>t</V></sub> log π<sub><V>θ</V></sub><sup>𝒩</sup>( <V>y</V><sub><V>i,t</V></sub> | <V>x</V>, <V>y</V><sub><V>i,&lt;t</V></sub> )
        </Eq>
        <Where items={[
          [<span><V>x</V></span>, "the task prompt, shared by all rollouts in the group"],
          [<span><V>y</V><sub>i,t</sub></span>, <span>token <V>t</V> generated by the model in rollout <V>i</V></span>],
          [<span><V>r</V><sub>i</sub></span>, "the scalar reward of rollout i, defined at the end of this part"],
          [<span><V>A</V><sub>i</sub></span>, "its advantage: positive if the rollout beat the group average, negative if not"],
          [<span>π<sub>θ</sub><sup>𝒩</sup></span>, "the training policy with current weights θ, restricted to the tokens the sampler could have drawn (defined below)"],
        ]} />
        <P>
          The report is silent on the group size, on whether the loss clips or reweights stale samples, and on the optimizer
          settings. What it does specify is how the log-probability inside the sum is computed, which is the subject of the rest
          of this part.
        </P>

        <H3>What the sampler writes down</H3>
        <P>
          For each generated token the inference engine stores three things besides the token itself. Each one lets the trainer
          undo one source of mismatch from the table in part 1.
        </P>
        <Steps items={[
          { title: "The policy version", body: "Which set of weights produced the token. Because workers update after every optimizer step, this number can change in the middle of a rollout. The report uses it to measure staleness; it does not describe a correction based on it." },
          { title: "The nucleus", body: "The set of tokens the sampler was allowed to draw from at that position. The trainer renormalizes over the same set." },
          { title: "The selected experts", body: "Which experts the token was routed through. The trainer runs the same ones instead of choosing again." },
        ]} />

        <H3>Using the nucleus: train on the distribution that was sampled</H3>
        <P>
          A long trajectory contains many thousands of sampling decisions, and one very unlikely token can break a tool call or
          derail a chain of reasoning. To limit that risk Beam uses <b>nucleus sampling</b> (also called top-p): at each position,
          sort the tokens by probability, keep the smallest set whose probabilities add up to at least <V>p</V>, and sample only
          from that set. Beam uses <V>p</V> = 0.99 with temperature 1.0, meaning the probabilities are otherwise left as they are.
        </P>
        <P>
          Cutting the tail changes the distribution: the kept tokens are scaled up so they sum to one, and the rest drop to zero.
          If the trainer ignored this and used full-vocabulary probabilities, it would be differentiating a policy that did not
          generate the data, and gradient would flow into tokens that could never have been sampled. The fix is to keep the
          nucleus that was used and renormalize the training policy over that same set.
        </P>
        <Eq label="Training policy renormalized over the recorded nucleus"
          note="The report states this in words and credits the approach to DeepSeek-V3.2; the formula is the direct transcription.">
          π<sub><V>θ</V></sub><sup>𝒩</sup>(<V>v</V>) = π<sub><V>θ</V></sub>(<V>v</V>) / Σ<sub><V>u</V> ∈ 𝒩<sub><V>t</V></sub></sub> π<sub><V>θ</V></sub>(<V>u</V>) &nbsp;&nbsp;if <V>v</V> ∈ 𝒩<sub><V>t</V></sub>, &nbsp;&nbsp;and 0 otherwise
        </Eq>
        <Where items={[
          [<span>π<sub>θ</sub>(<V>v</V>)</span>, <span>the model's full-vocabulary probability of token <V>v</V> at this position, under the current weights</span>],
          [<span>𝒩<sub>t</sub></span>, <span>the nucleus recorded at generation step <V>t</V>: the tokens the sampler could draw from</span>],
        ]} />
        <P>
          Note what is fixed and what moves. The set 𝒩<sub>t</sub> is the sampler's and never changes; the probabilities inside
          it are recomputed with the current weights. The report is explicit that this removes the mismatch caused by using
          different truncation masks, not the mismatch from weight updates or numerical effects.
        </P>
        <NucleusDemo />

        <H3>Using the experts: routing replay</H3>
        <P>
          Beam is a <Term def="A network whose layers contain many alternative sub-networks (experts). A small router scores the experts for each token and only the best few are run, so most parameters are inactive for any given token.">mixture-of-experts</Term> model.
          In each such layer a small <b>router</b> scores the experts for the current token, the top <V>k</V> are run, and their
          outputs are mixed using weights called <b>gate values</b>. Picking the top <V>k</V> is a hard decision: if two experts
          have nearly equal scores, a difference in the last decimal place decides which one runs, and everything computed after
          that point differs.
        </P>
        <P>
          <b>Routing replay</b> removes the hard decision from the trainer. The inference engine records the experts it selected
          for each token, and the trainer runs those same experts while recomputing the gate values with its own weights. The
          demo shows a single token at a single layer with a near-tie between two experts.
        </P>
        <RoutingDemo />
        <P>
          Two further measures narrow the gap. The router's weights and its load-balancing biases are frozen for the whole of RL.
          That alone would not make replay unnecessary, because the hidden states that enter the router still change as the rest
          of the model trains, and so the scores change too. And the three places where small errors matter most, the LM head
          (the final layer that produces token scores), the router, and the residual stream (the running hidden state that every
          layer reads and adds to), are computed in 32-bit floating point in both engines.
        </P>

        <H3>The reward</H3>
        <P>
          The reward for a rollout has two parts: a correctness score that is either earned in full or not at all, and a cost
          proportional to the output length. The equation below is our transcription of the report's description; look at how
          the three ways to lose the correctness term (failing, being flagged, running out of budget) all leave the length cost in place.
        </P>
        <Eq label="Reward of one rollout (transcribed from the report's description)">
          <V>r</V> = <V>c</V> · (1 − <V>h</V>) − <V>λ</V> · <V>ℓ</V>
        </Eq>
        <Where items={[
          [<span><V>c</V></span>, "1 if the task verifier passes, 0 if it fails or if the rollout used up its effort budget and was terminated"],
          [<span><V>h</V></span>, "1 if the judge flags a passing rollout as a reward hack, otherwise 0"],
          [<span><V>ℓ</V></span>, "the length of the model's output in tokens"],
          [<span><V>λ</V></span>, "the length-cost coefficient; the report calls the penalty linear and does not give its value"],
        ]} />
        <P>
          The evaluation chapter words the cost slightly differently, as penalizing "unnecessary output tokens beyond a per-effort
          budget", which suggests the charge depends on the effort setting. The report does not give the exact formula, so treat
          the single <V>λ</V> above as a simplification.
        </P>
        <P>
          Three details of the judge are worth knowing. It sees only the final patch, not the transcript. The model's
          chain of thought is monitored for signs that it intends to hack, but no direct optimization pressure is applied to it. And the rubrics were revised during the run as the model found new
          hacks.
        </P>
        <GroupDemo />

        <H3>Putting it together</H3>
        <P>
          The two sketches below show where each recorded item is written and where it is read. They are illustrative
          pseudocode: the function names are invented and details the report does not give (clipping, batching, the optimizer)
          are left out.
        </P>
        <CodeBlock code={samplerCode} />
        <CodeBlock code={trainerCode} />
      </Stage>

      <Stage step={3} title="What the run showed">
        <P>
          The report gives three kinds of evidence: diagnostics showing that the optimization stayed stable, a study of how the
          model spends tokens, and scores on held-out benchmarks during the run. All numbers below are the report's.
        </P>

        <H3>Stability: the mismatch stayed small and was mostly staleness</H3>
        <StatsRow columns={4}>
          <StatCard label="Gradient norm"><StatCardValue>1.7e-3</StatCardValue><StatCardCaption>median; 99th percentile 3.0e-3</StatCardCaption></StatCard>
          <StatCard label="Sampler-trainer KL"><StatCardValue>2.2e-4</StatCardValue><StatCardCaption>nats per token, median</StatCardCaption></StatCard>
          <StatCard label="Log-prob gap"><StatCardValue>0.0085</StatCardValue><StatCardCaption>mean absolute difference per token</StatCardCaption></StatCard>
          <StatCard label="Staleness"><StatCardValue>5</StatCardValue><StatCardCaption>policy versions behind the trainer, mean</StatCardCaption></StatCard>
        </StatsRow>
        <P>
          The gradient norm is the length of the gradient vector at each optimizer step. Its 99th percentile is less than twice its
          median and the report notes no sustained drift, which means the run had no period of exploding or collapsing updates.
        </P>
        <P>
          The <Term def="Kullback-Leibler divergence: a measure of how different two probability distributions are. It is zero when they are identical. Measured in nats when natural logarithms are used.">KL divergence</Term> between
          the sampler's and the trainer's next-token distributions measures the total mismatch that survives all the fixes. One
          reference point makes it interpretable: right after a restart, every rollout is generated with the trainer's current
          weights, so staleness is zero and only numerical and replay effects are left.
        </P>
        <Panel title="Per-token KL between sampling and training policies (nats)"
          caption="The restart value is the floor left by precision and routing effects. Typical asynchronous training sits about 2.5 times higher (our division of the two reported numbers), and the report attributes the extra to tokens being on average five policy versions old.">
          <BarRow label="Right after a restart (no staleness)" value={0.87} max={2.2} text="8.7e-5" color={chartColors[1]} />
          <BarRow label="Median over the asynchronous run" value={2.2} max={2.2} text="2.2e-4" color={chartColors[0]} />
        </Panel>
        <P>
          Response lengths were stable too. The task mixture changed five times; within any one phase the median response length
          moved by at most a third, and from 52% of the run onward by less than 5%. The larger jumps happened at mixture changes
          that brought in longer agentic tasks, so they reflect the tasks rather than a drifting policy.
        </P>

        <H3>The policy did not just get more confident</H3>
        <P>
          The negative log-likelihood (NLL) of a sampled token is minus the log of the probability the policy gave it. Averaged
          over tokens it says how predictable the model's own output is to itself: 0 nats means it was certain. A common worry in
          long RL runs is that the policy sharpens everywhere and stops exploring, which would show up as NLL falling toward zero.
          The chart compares the start and the end of the run for all tokens and for the two output channels.
        </P>
        <Panel title="Mean NLL of sampled tokens, start and end of the run (nats; lower means more predictable)"
          caption="Only the endpoints are printed in the report, so only endpoints are drawn. For scale (our conversion): 0.25 nats corresponds to a typical token probability of 78%, and 0.06 nats to 94%.">
          <ChartContainer config={nllCfg} style={{ height: 230, width: "100%" }}>
            <BarChart data={nllRows}>
              <ChartGrid /><ChartXAxis dataKey="ch" interval={0} /><ChartYAxis title="NLL (nats)" />
              <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
              <ChartBar dataKey="start" /><ChartBar dataKey="end" />
            </BarChart>
          </ChartContainer>
        </Panel>
        <Surprise title="Overall the policy became less predictable, and the two channels moved in opposite directions">
          One would expect RL to concentrate the policy across the board. Instead the overall NLL rose from 0.37 to 0.50 nats.
          Reasoning tokens became slightly less predictable (0.63 to 0.69), while final-answer tokens became far more predictable
          (0.25 to 0.06). The model kept its reasoning varied and became decisive only about what it commits to.
        </Surprise>
        <P>
          One more observation, which is our inference and not a statement in the report. The overall figure rose by 0.13 nats,
          more than the reasoning figure did (0.06), while the answer figure fell. An average can only do that if its mix
          changes, so a larger share of sampled tokens must have been reasoning tokens by the end. That fits the report's remark
          that the mixture moved toward longer agentic tasks.
        </P>

        <H3>Token efficiency: better at every budget, and able to use bigger ones</H3>
        <P>
          Figure 16 of the report plots DeepSWE pass@1 (the share of tasks solved on the first attempt) against the requested
          reasoning effort <V>e</V> from 64 to 512, and against the output tokens actually used, for the SFT checkpoint and three RL
          checkpoints. The report prints two of the values and describes the rest in words, so the table gives exactly that.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow>
            <TableHead className="w-[34%]">Checkpoint</TableHead><TableHead className="w-[22%] text-right">DeepSWE pass@1 at <V>e</V> = 512</TableHead><TableHead>What the report says about the curve</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>SFT checkpoint (before RL)</TableCell><TableCell className="text-right text-secondary">not printed</TableCell><TableCell>The baseline. RL reaches its scores with fewer tokens and beats it at comparable output lengths.</TableCell></TableRow>
            <TableRow><TableCell>79% of the run</TableCell><TableCell className="text-right font-mono">35%</TableCell><TableCell>Taken before the harder software-engineering task set was introduced at 83%.</TableCell></TableRow>
            <TableRow><TableCell>100% of the run</TableCell><TableCell className="text-right font-mono">41%</TableCell><TableCell>Still improving as effort increases all the way to <V>e</V> = 512.</TableCell></TableRow>
          </TableBody>
        </Table>
        <P>
          The report draws two conclusions. RL moved the whole trade-off: higher scores at the same output length, and the same
          score for fewer tokens. It also widened the range of effort settings over which extra computation still buys accuracy,
          so a larger budget is not wasted on the final model.
        </P>
        <P>
          The evaluation chapter adds the order in which these happened: the model first learned to solve the same tasks with
          fewer tokens, and later, as its agentic ability grew, the extra tokens at high effort began to turn into higher scores.
          It names this token efficiency as Beam's main advantage at inference time and attributes it to the length cost used in
          this run. The report does not define the unit of <V>e</V> in these sections.
        </P>

        <H3>Generalization: held-out benchmarks across the phases of the run</H3>
        <P>
          Checkpoints were evaluated throughout the run on eight benchmarks whose tasks were excluded from the RL data: SWE-bench
          Verified, SWE-bench Pro, DeepSWE, BrowseComp, HLE (text, no tools), LiveCodeBench v6, AIME 2026 and GPQA-Diamond. The
          settings never changed: temperature 1, top-p 0.99, <V>e</V> = 512 and a 256K output-token limit. Scores rose steadily.
        </P>
        <P>
          What makes the curves informative is that the training mixture was restricted to a single domain for long stretches. The
          timeline puts those stretches next to the measurements that the next two findings rely on.
        </P>
        <RunTimeline />
        <Surprise title="Two long single-domain phases caused no forgetting">
          For a quarter of the run (26% to 52%) the model trained only on mathematics, STEM and competitive programming, and then
          for another eighth (52% to 65%) only on software engineering. Training on one domain for that long would normally be
          expected to erode the others. The report finds that software-engineering benchmarks held their level through the first
          phase and that STEM and coding benchmarks did not regress during the second.
        </Surprise>
        <Surprise title="Search improved before any search task was trained">
          No search or browsing task was in the training data before the 83% mark. BrowseComp, a browsing benchmark, still rose
          from 50.1 at 27% of the run to 57.9 at 83%. The gain of 7.8 points therefore came from training on other domains.
          Measurements start at 27% because the search backend changed then.
        </Surprise>
        <P>
          The policy that comes out of this run is the agentic teacher. How it is combined with the alignment expert into the
          released model is the subject of <LessonLink to="mopd" />.
        </P>
        <Src>section 4.1.2 with figures 15 to 17, and the token-efficiency paragraph of section 5.1 with figure 40</Src>
      </Stage>
    </div>
  );
}
