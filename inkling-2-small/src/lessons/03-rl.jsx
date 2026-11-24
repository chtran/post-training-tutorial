const meta = {
  id: "rl",
  nav: "One joint RL run",
  title: "One joint RL run: tasks, graders and rewards",
  question: "What does it take to train coding, office work, vision, search and safety in a single RL run instead of several?",
  minutes: 12,
  takeaways: [
    "All post-training RL was one joint run: 1,075 steps, over 17M rollouts and 3T tokens, over 9 days on 2,048 GPUs. Coding, office work, STEM, web apps, vision, tool use, search and safety all train together.",
    "Eight task families share the run, each with its own grader: hidden tests and programmatic checks for code, rubric-based LLM judges for documents and tool use, reference answers for STEM and vision, and pairwise reward models on screenshots for web apps.",
    "Shares of rollouts and of tokens are very different. Coding is 38.5% of rollouts but 65% of tokens; chat, safety and epistemics is 7.8% of rollouts and 0.2% of tokens.",
    "Effort level is sampled at random and given to the model, and a length penalty is part of the reward, so the model learns to trade speed against thoroughness on request.",
    "Training reward and evaluation scores rose roughly log-linearly with compute for the whole run, with no plateau visible at the end.",
  ],
};

// ---------------------------------------------------------------------
// Demo 1: rollouts vs tokens (TML's table).
// ---------------------------------------------------------------------
const MIX = [
  { c: "Coding", r: 38.5, t: 65.0, g: "hidden unit tests, programmatic checks" },
  { c: "Office and knowledge work", r: 9.1, t: 13.3, g: "rubric-based LLM judge" },
  { c: "STEM and reasoning", r: 7.0, t: 7.6, g: "reference answers" },
  { c: "Web and app building", r: 4.7, t: 7.2, g: "pairwise reward model on screenshots" },
  { c: "Vision", r: 13.9, t: 3.0, g: "reference answers" },
  { c: "Tool use and general agents", r: 17.1, t: 2.3, g: "rubric-based LLM judge" },
  { c: "Search", r: 2.0, t: 1.4, g: "not stated" },
  { c: "Chat, safety and epistemics", r: 7.8, t: 0.2, g: "not stated; see lesson 6" },
];

function MixDemo() {
  const [by, setBy] = useState("r");
  const rows = [...MIX].sort((a, b) => b[by] - a[by]);
  return (
    <Demo title="The same run, counted two ways"
      takeaway={by === "r"
        ? "Counted by rollouts, the run looks balanced: coding is the biggest family, but tool use, vision and chat together make up almost as many attempts."
        : "Counted by tokens, coding is two-thirds of the run. A coding rollout is long (repositories, test output, many turns), while a chat or vision rollout can be a single short answer. Average tokens per rollout differ by a factor of about 66 between coding and chat (our arithmetic: 65.0/38.5 against 0.2/7.8)."}>
      <SegmentedControl value={by} onValueChange={(v) => v && setBy(v)} size="small" aria-label="Count by">
        <SegmentedControlItem value="r">Share of rollouts</SegmentedControlItem>
        <SegmentedControlItem value="t">Share of tokens</SegmentedControlItem>
      </SegmentedControl>
      <div className="flex flex-col gap-2">
        {rows.map((m) => (
          <div key={m.c} className="flex items-center gap-3">
            <span className="flex w-[190px] shrink-0 flex-col">
              <span className="text-[12.5px] leading-4 text-primary">{m.c}</span>
              <span className="text-[11px] leading-4 text-secondary">{m.g}</span>
            </span>
            <div className="relative h-[20px] grow rounded bg-wash">
              <div className="absolute left-0 top-0 h-full rounded bg-[rgb(var(--text-blue))] opacity-80 transition-all" style={{ width: (m[by] / 65) * 100 + "%" }} />
            </div>
            <span className="w-[48px] shrink-0 text-right font-mono text-[12.5px] text-primary">{m[by].toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <Small>Shares from TML's "RL training task mix" table. Graders from the launch post's list; where it does not name one we say so.</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 2: effort-conditioned length penalty (toy).
// ---------------------------------------------------------------------
const EFFORTS = [
  { k: "low", lam: 0.06 }, { k: "medium", lam: 0.025 }, { k: "high", lam: 0.01 }, { k: "xhigh", lam: 0.003 },
];
// Toy solve-rate curve: more thinking helps, with diminishing returns.
const solve = (L) => 0.85 * (1 - Math.exp(-L / 9));

function EffortDemo() {
  const [e, setE] = useState("medium");
  const lam = EFFORTS.find((x) => x.k === e).lam;
  const data = Array.from({ length: 41 }, (_, i) => {
    const L = i * 2;
    return { L, acc: +solve(L).toFixed(3), rew: +(solve(L) - lam * L).toFixed(3) };
  });
  const best = data.reduce((a, b) => (b.rew > a.rew ? b : a));
  return (
    <Demo title="Where the reward peaks depends on the effort level"
      takeaway={"At effort \"" + e + "\" the expected reward peaks at about " + best.L + "K thinking tokens, solving " + Math.round(best.acc * 100) + "% of tasks. Raise the effort and the optimum moves right: the model is paid to think longer only when the user asked for thoroughness. Because effort is sampled at random during training, one model learns the whole curve."}>
      <SegmentedControl value={e} onValueChange={(v) => v && setE(v)} size="small" aria-label="Effort">
        {EFFORTS.map((x) => <SegmentedControlItem key={x.k} value={x.k}>{x.k}</SegmentedControlItem>)}
      </SegmentedControl>
      <ChartContainer config={{ acc: { label: "Solve rate", color: chartColors[1] }, rew: { label: "Expected reward after length penalty", color: chartColors[0] } }} style={{ height: 220, width: "100%" }}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <ChartGrid /><ChartXAxis dataKey="L" type="number" domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} /><ChartYAxis domain={[-0.2, 1]} ticks={[0, 0.5, 1]} />
          <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
          <ChartLine dataKey="acc" dot={false} isAnimationActive={false} />
          <ChartLine dataKey="rew" dot={false} isAnimationActive={false} />
          <Recharts.ReferenceLine x={best.L} stroke="rgb(var(--text-orange))" strokeDasharray="4 3" />
        </LineChart>
      </ChartContainer>
      <div className="-mt-1 text-center text-[12px] text-secondary">Thinking tokens (thousands)</div>
      <Small>Toy model: a made-up solve-rate curve and made-up penalty weights per effort level. TML says only that effort is sampled and conditioned on, and that the reward includes a length penalty.</Small>
    </Demo>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col">
      <Stage step={1} title="Why one run instead of several">
        <P>
          A common way to post-train is in pieces: separate RL runs for separate skills, then a distillation step in which one
          student imitates several teachers (Beam's <a className="underline" href="../beam/">MOPD merge</a> is an example).
          Splitting keeps each run simple. Each has one kind of task, one kind of grader and similar rollout lengths. But the
          merge is lossy, and skills that only appear when abilities combine, such as searching the web in the middle of a
          coding task, are never trained directly.
        </P>
        <P>
          Inkling 2 Small trains everything in <b>one joint run</b>: coding, office and knowledge work, STEM, web and app
          building, vision, tool use, search, and chat and safety share the same RL steps.
        </P>
        <StatsRow columns={4}>
          <StatCard label="Steps"><StatCardValue>1,075</StatCardValue><StatCardCaption>≈16K rollouts each (our arithmetic)</StatCardCaption></StatCard>
          <StatCard label="Rollouts"><StatCardValue>17M+</StatCardValue><StatCardCaption>over 3T tokens</StatCardCaption></StatCard>
          <StatCard label="Hardware"><StatCardValue>2,048</StatCardValue><StatCardCaption>GPUs for 9 days</StatCardCaption></StatCard>
          <StatCard label="Compute"><StatCardValue>4×10²³</StatCardValue><StatCardCaption>FLOPs, learner + sampler</StatCardCaption></StatCard>
        </StatsRow>
        <P>
          The cost of one run is that it is heterogeneous in every way at once. Families need different graders, rollouts range
          from a one-line answer to a four-hour coding session, and some rewards are certain (the tests passed) while others are
          a judge's opinion. Lessons 4 and 5 are about the parts of the recipe that make this workable. This lesson is about what
          goes into the run.
        </P>
        <KeyIdea>
          A joint run trades simple, separate pipelines for one policy that is trained on <b>every skill together</b>, with no merge step needed. The price is a run whose tasks, graders and rollout lengths vary enormously.
        </KeyIdea>
        <Src>TML launch post, "Training Inkling 2 Small", including the "Scale of the main RL run" table</Src>
      </Stage>

      <Stage step={2} title="The task mix, the graders, and the reward">
        <H3>Each family has its own grader</H3>
        <P>
          A <Term def="Whatever turns a finished rollout into a number: a test suite, a comparison with a reference answer, an LLM judge, or a learned reward model.">grader</Term> is
          matched to what can be checked. Thinking Machines lists four kinds.
        </P>
        <Findings items={[
          <span><b>Hidden unit tests and programmatic checks</b> for most coding work. The model never sees the tests, so it cannot write code that only satisfies them.</span>,
          <span><b>Rubric-based LLM judges</b> for documents and tool use. A judge model scores the output against a written checklist of what a good answer contains.</span>,
          <span><b>Reference answers</b> for STEM and vision question answering.</span>,
          <span><b>Pairwise reward models on screenshots</b> for web apps: the app is rendered, and a model compares two screenshots and says which is better.</span>,
        ]} />
        <P>
          Some questions get rewards that care about <b>uncertainty</b>. Forecasting tasks use <Term def="A rule for scoring a probabilistic forecast under which the forecaster's best strategy is to report its true belief. The log score and the Brier score are examples.">proper scoring rules</Term>,
          and some question-answering tasks use uncertainty-sensitive rewards, so that a confident wrong answer costs more than
          saying "I'm not sure". The goal, in Thinking Machines' words, is a model that can "express appropriate confidence, and
          make well-calibrated predictions".
        </P>
        <MixDemo />
        <H3>Effort and length</H3>
        <P>
          Users want quick answers to easy questions and thorough work on hard ones. Inkling 2 Small takes an <b>effort level</b> as
          input (evaluations use 0.99, called "xhigh"). During RL the effort level is sampled at random for each rollout and given
          to the model, and the reward includes a length penalty. A natural way to combine the two, which Thinking Machines does not
          spell out, is to make the penalty weaker at higher effort:
        </P>
        <Eq label="Reward with an effort-dependent length penalty (illustrative form, not TML's)">
          <V>r</V>(<V>y</V> ; <V>e</V>) = grade(<V>y</V>) − <V>λ</V>(<V>e</V>) · len(<V>y</V>),&nbsp;&nbsp; <V>e</V> ∼ Uniform(effort levels)
        </Eq>
        <Where items={[
          [<V>y</V>, "the rollout: reasoning, tool calls and final answer"],
          [<V>e</V>, "the effort level, sampled per rollout and shown to the model in its prompt"],
          ["grade(y)", "the family's grader score, plus the alignment reward of lesson 6"],
          [<span><V>λ</V>(<V>e</V>)</span>, "penalty per token; smaller at higher effort, so long thinking only pays when thoroughness was requested"],
        ]} />
        <EffortDemo />
        <H3>The training loop</H3>
        <P>
          The run uses the same open tools Tinker customers use. The cookbook's asynchronous RL loop, with StableReinforce as its
          default loss, is linked from the launch post as the implementation. A simplified view:
        </P>
        <Code>simplified from the pattern in tinker_cookbook/rl/train.py; not the production code</Code>
        <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-5 text-primary">{`while step < 1075:
    groups = ready_groups(oldest_weights_first=True)   # finished rollouts, possibly stale
    data = []
    for g in groups:                                   # a group = several rollouts of one task
        rewards = [g.task.grader(r) + alignment_reward(r)
                   - length_penalty(r, effort=r.effort) for r in g.rollouts]
        adv = [x - mean(rewards) for x in rewards]     # centred within the group
        data += to_datums(g.rollouts, adv)             # tokens, sampler logprobs, sequence ids
    training_client.forward_backward(data, loss_fn="stable_reinforce")
    training_client.optim_step(adam)
    publish_weights_to_samplers()                      # samplers keep running; no barrier`}</pre>
        <Small>
          The group-centred advantage is our assumption, standard for this kind of loop; TML does not state how advantages are
          formed for Inkling 2 Small.
        </Small>
        <Src>TML launch post, "Training Inkling 2 Small" and "Reasoning, knowledge, and epistemics"; Tinker Cookbook rl/train.py at the commit the post links</Src>
      </Stage>

      <Stage step={3} title="What the run showed">
        <P>
          Thinking Machines plots training reward and two held-out evaluations against cumulative learner and sampler compute,
          on a logarithmic axis from about 10²² to beyond 2×10²³ FLOPs.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Curve</TableHead><TableHead className="text-right">Axis range shown</TableHead><TableHead>Shape</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>Mean training reward</TableCell><TableCell className="text-right font-mono text-[13px]">0.3 to 0.6</TableCell><TableCell>rises steadily, log-linear in compute</TableCell></TableRow>
            <TableRow><TableCell>STEM evaluation score</TableCell><TableCell className="text-right font-mono text-[13px]">0.3 to 0.5</TableCell><TableCell>rises steadily, log-linear in compute</TableCell></TableRow>
            <TableRow><TableCell>Vision evaluation score</TableCell><TableCell className="text-right font-mono text-[13px]">0.55 to 0.75</TableCell><TableCell>rises steadily, log-linear in compute</TableCell></TableRow>
          </TableBody>
        </Table>
        <Small>The post gives the curves as figures without data tables; the ranges are the figures' axis limits, not exact start and end values.</Small>
        <Surprise title="Mixing everything did not stall any of it">
          A joint run could plausibly let one family crowd out another: coding is two-thirds of the tokens, and vision is 3%.
          Instead both the STEM and the vision evaluations kept climbing log-linearly, like the overall reward, to the end of the
          run. A straight line on a log axis means each doubling of compute bought a similar gain, so the run was stopped while it
          was still improving.
        </Surprise>
        <Surprise title="The smallest family by tokens is one of the larger ones by rollouts">
          Chat, safety and epistemics receives only 0.2% of the tokens but 7.8% of the rollouts, more than STEM. Short tasks are
          cheap, so they can be sampled often. Their influence on behavior is also not limited to their share: the alignment
          reward of <LessonLink to="align" /> applies to every task in the run.
        </Surprise>
        <P>
          The same picture held for the first Inkling, whose reasoning score improved log-linearly over more than 30M rollouts.
          What is new is that a single mixed run keeps that property across eight task families at once.
        </P>
        <Src>TML launch post, the three compute-scaling figures and the task-mix table; first-Inkling comparison from TML, "Introducing Inkling", "RL at scale"</Src>
      </Stage>
    </div>
  );
}
