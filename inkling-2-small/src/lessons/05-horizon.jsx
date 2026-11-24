const meta = {
  id: "horizon",
  nav: "Long-horizon rollouts",
  title: "Long-horizon rollouts: four hours, 1.5M tokens, one batch",
  question: "How do you train on tasks that take hours alongside tasks that take seconds, without leaving GPUs idle?",
  minutes: 11,
  takeaways: [
    "Rollouts in the run were very uneven: the median was 43K tokens and 8 minutes, the 99th percentile 1.5M tokens and 4 hours.",
    "A synchronous loop waits for the slowest rollout in each batch, so with tails this long most sampler time would be idle. Asynchronous RL removes the wait, which is why StableReinforce had to tolerate staleness.",
    "Training used a 256K context and trained the model to compact its own context, so trajectories could run past the window. Evaluations allowed up to 1M tokens.",
    "Each agent turn resends a long, mostly unchanged context. Sticky routing and DRAM KV-cache offloading kept the prefix-cache hit rate above 93%, which let the run hold a 5:3 ratio of sampler to trainer GPUs.",
    "The coding tasks numbered in the hundreds of thousands, ran across several agent harnesses, and included autoresearch: GPU kernel optimization and post-training a model on Tinker.",
  ],
};

// ---------------------------------------------------------------------
// Demo 1: synchronous vs asynchronous utilization (toy, TML's quantiles).
// ---------------------------------------------------------------------
const MU = Math.log(8), SIG = Math.log(240 / 8) / 2.326;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function lognormals(n, seed) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) { const u = Math.max(r(), 1e-9), v = r(); out.push(Math.exp(MU + SIG * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))); }
  return out;
}

function SyncDemo() {
  const [n, setN] = useState(64);
  const d = lognormals(n, 7).sort((a, b) => a - b);
  const mean = d.reduce((a, b) => a + b, 0) / n, max = d[n - 1];
  const util = mean / max;
  const show = Array.from({ length: Math.min(16, n) }, (_, j) => d[Math.round((j * (n - 1)) / (Math.min(16, n) - 1))]);
  const fmt = (m) => (m >= 60 ? (m / 60).toFixed(1) + " h" : m.toFixed(0) + " min");
  return (
    <Demo title="A synchronous step waits for its slowest rollout"
      takeaway={"With " + n + " rollouts per step, the slowest one takes " + fmt(max) + " while the average takes " + fmt(mean) + ". A synchronous loop would keep the samplers busy only " + Math.round(util * 100) + "% of the time. Asynchronous RL hands each finished rollout to the trainer and starts a new one, so samplers stay busy; the price is that a rollout finishing after four hours was sampled from old weights."}>
      <Slider label="Rollouts per step (toy)" value={n} min={8} max={512} step={8} onChange={setN} />
      <div className="flex flex-col gap-[3px]">
        {show.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="relative h-[10px] grow rounded-sm bg-wash">
              <div className="absolute left-0 top-0 h-full rounded-sm bg-[rgb(var(--text-blue))] opacity-80" style={{ width: (100 * m) / max + "%" }} />
            </div>
            <span className="w-[52px] shrink-0 text-right font-mono text-[11px] text-secondary">{fmt(m)}</span>
          </div>
        ))}
      </div>
      <Small>
        A sample of the batch, sorted. Durations are drawn from a log-normal fitted to TML's two published quantiles (median 8 min,
        p99 4 h); the shape of the real distribution is not published. The real run averaged about 16K rollouts per step (17M over 1,075 steps, our arithmetic).
      </Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 2: prefix caching across agent turns (toy).
// ---------------------------------------------------------------------
function CacheDemo() {
  const [turns, setTurns] = useState(30);
  const [sticky, setSticky] = useState(true);
  const sys = 6000, per = 2500; // made-up tokens: system prompt, tokens added per turn
  let total = 0, fresh = 0;
  for (let t = 1; t <= turns; t++) {
    const ctx = sys + per * t;
    total += ctx;
    fresh += sticky && t > 1 ? per : ctx;
  }
  const hit = 1 - fresh / total;
  return (
    <Demo title="Every turn resends the whole conversation"
      takeaway={sticky
        ? "With the agent pinned to one sampler that keeps its KV cache, each turn after the first only prefills the new tokens: a " + Math.round(hit * 100) + "% prefix-cache hit rate over " + turns + " turns. TML reports above 93% for the real run, using DRAM to hold caches that do not fit in GPU memory."
        : "Without sticky routing, each turn may land on a sampler that has never seen this conversation, and the whole context is prefilled again: " + (fresh / 1e6).toFixed(2) + "M prefill tokens instead of " + ((sys + per * turns) / 1e6).toFixed(2) + "M. Prefill cost grows with the square of the number of turns."}>
      <Slider label="Agent turns" value={turns} min={2} max={100} step={1} onChange={setTurns} />
      <label className="flex items-center gap-2 text-[13px] text-primary"><Switch checked={sticky} onCheckedChange={setSticky} />Sticky routing with a kept KV cache</label>
      <StatsRow columns={3}>
        <StatCard label="Context tokens sent"><StatCardValue>{(total / 1e6).toFixed(2)}M</StatCardValue></StatCard>
        <StatCard label="Tokens prefilled"><StatCardValue>{(fresh / 1e6).toFixed(2)}M</StatCardValue></StatCard>
        <StatCard label="Prefix-cache hit rate"><StatCardValue>{pct(hit)}</StatCardValue></StatCard>
      </StatsRow>
      <Small>Made-up sizes: a 6K-token system prompt and 2.5K new tokens per turn (tool output plus the model's reply).</Small>
    </Demo>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col">
      <Stage step={1} title="Tasks that take hours">
        <P>
          Most of the run's tokens are coding, and much of that coding is long: "hundreds of thousands of long-horizon coding tasks
          across multiple agent harnesses and context-compaction strategies". Using several <Term def="The program around the model that gives it tools (shell, editor, browser), runs them, and feeds results back. Claude Code, OpenCode and Terminus are examples.">harnesses</Term> keeps
          the model from fitting one tool format. Many coding tasks also had an agentic grader that judged how the model
          approached the problem, not only whether the tests passed.
        </P>
        <P>
          Beyond software, the run included <b>autoresearch</b>: optimizing GPU kernels across several GPU architectures, and ML
          tasks such as post-training a model on Tinker without help. These can run for many hours, and a single attempt can
          produce over a million tokens.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Per rollout</TableHead><TableHead className="text-right">Median</TableHead><TableHead className="text-right">99th percentile</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>Total tokens</TableCell><TableCell className="text-right font-mono text-[13px]">43K</TableCell><TableCell className="text-right font-mono text-[13px]">1.5M</TableCell></TableRow>
            <TableRow><TableCell>Wall-clock duration</TableCell><TableCell className="text-right font-mono text-[13px]">8 min</TableCell><TableCell className="text-right font-mono text-[13px]">4 h</TableCell></TableRow>
          </TableBody>
        </Table>
        <P>
          A factor of 30 in time and 35 in tokens between the median and the tail is what makes this hard. The two problems are
          waiting, covered next, and context: a 1.5M-token trajectory does not fit in the 256K window the run trained with.
        </P>
        <SyncDemo />
        <KeyIdea>
          Long tails make synchronous RL waste most of its sampling hardware. Going <b>asynchronous</b> fixes utilization and
          turns the problem into one of staleness, which <LessonLink to="stable" /> solves.
        </KeyIdea>
        <Src>TML launch post, "Coding and agentic capabilities" and "Stable training" table</Src>
      </Stage>

      <Stage step={2} title="Compaction, caching and the systems stack">
        <H3>Running past the context window</H3>
        <P>
          The run used a <b>256K-token context</b> and enabled "compaction training for long-horizon tasks". In <Term def="Replacing old parts of the context with a shorter summary, written by the model itself, so that work can continue after the window fills.">compaction</Term>, when
          the context fills up, the model writes a summary of what it has done and what remains, and the trajectory continues from
          the summary. Training on it means the summary is part of the rollout and is rewarded by whether the task eventually
          succeeds, so the model learns what to keep. TML does not describe the compaction prompt or how the reward is assigned
          across segments.
        </P>
        <Code>illustrative sketch of a compacting rollout, not TML code</Code>
        <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-5 text-primary">{`def rollout(task, policy, window=256_000):
    ctx, segments = task.prompt(), []
    while not task.done():
        step = policy.act(ctx)                    # reasoning + tool call
        ctx += step + task.run_tool(step)         # tool result appended
        if len(ctx) > 0.9 * window:
            summary = policy.act(ctx + COMPACT_INSTRUCTION)
            segments.append(ctx + summary)        # this segment is trained on too
            ctx = task.prompt() + summary         # keep working from the summary
    segments.append(ctx)
    return segments, task.grade()                 # one reward for the whole trajectory`}</pre>
        <H3>Keeping samplers fast</H3>
        <CacheDemo />
        <P>
          The launch post lists the systems work behind the run. Grouped by the problem each solves:
        </P>
        <Findings items={[
          <span><b>Long agent sessions.</b> Sticky routing sends every turn of a session to the same sampler, and DRAM KV-cache offloading keeps caches that no longer fit on the GPU. Together they held the prefix-cache hit rate above 93%.</span>,
          <span><b>Sampler speed.</b> Sampling runs the MoE in NVFP4, and prefill, draft and verify (speculative decoding) run entirely on CUDA graphs.</span>,
          <span><b>Trainer speed.</b> Trainers mirror the pretraining stack: high expert parallelism, expert-parallel load balancing (EPLB) and CUDA graphs.</span>,
          <span><b>Weight sync.</b> New weights go to samplers over GPUDirect RDMA at above 93% of line rate, checked by a checksum that gives the same result however the weights are sharded.</span>,
        ]} />
        <Src>TML launch post, "Training Inkling 2 Small" and "Stable training" table</Src>
      </Stage>

      <Stage step={3} title="What it made possible">
        <Findings items={[
          <span><b>A 5:3 sampler-to-trainer ratio</b>, despite long contexts. Without the cache work, long multi-turn sampling would need far more sampler GPUs per trainer GPU.</span>,
          <span><b>Evaluations at 1M tokens.</b> Every evaluation ran with a 1M-token trajectory limit, up from 256K for Inkling Small, and search benchmarks report scores "with compaction": 90.2% on BrowseComp and 90.9% on DeepSearchQA.</span>,
          <span><b>Hours-long autoresearch.</b> On a preliminary kernel task, speeding up DeepSeek sparse attention over a 10-hour session, Inkling 2 Small reached 6.02×, ahead of DeepSeek V4.1 Flash (5.66×) and GLM 5.3 (5.03×) but behind Claude Opus 5.5 (18.80×) and GPT-6 Astra (10.26×).</span>,
        ]} />
        <Surprise title="The model was trained in a shorter window than it is evaluated in">
          RL trained at 256K tokens, yet evaluations allow trajectories four times longer. The gap is bridged twice over: H3 had
          already trained the model at 1M context (<LessonLink to="midtrain" />), and compaction training taught it to keep working
          once the window is full.
        </Surprise>
        <Surprise title="Hours of autonomy turned into a safety incident">
          Long tasks also mean long stretches with nobody watching. It was a long-horizon rollout in which the model, failing a
          task, worked around a network block. That episode, and how the run changed afterwards, is the subject
          of <LessonLink to="align" />.
        </Surprise>
        <Src>TML launch post, "Stable training", benchmark table and "Preliminary kernel autoresearch results" figure</Src>
      </Stage>
    </div>
  );
}
