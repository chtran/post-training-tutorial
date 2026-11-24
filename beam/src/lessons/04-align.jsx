const meta = {
  id: "align",
  nav: "Alignment",
  title: "The alignment teacher",
  question: "How do you train behavior that no unit test can check: honesty about what the model knows, following instructions, helpfulness, safety?",
  minutes: 24,
  // Three to five sentences a reader should remember. Shown in a box at the end of the lesson.
  takeaways: [
    "The alignment teacher is a second expert trained from the same midtrained checkpoint. Its targets are ranked in three tiers: invariants (safety, identity) that no message can override, commitments (accuracy, instruction following) that interact with instructions, and helpfulness defaults.",
    "RL can only reinforce behavior that already appears in some rollouts, so every target behavior is first seeded with a little SFT data. How far RL then moves it is forecast at step 0 from two measurements: how common the behavior is, and how much better it scores than the alternatives inside a group.",
    "Each reward is shaped around the cheapest way to cheat it: abstaining is worth exactly half a correct answer, a format verifier is paired with a judge that checks the task was done, rubric lists are all-or-nothing, and long-context answers are checked against a SQL engine instead of a judge.",
    "Helpfulness is trained against a reward model that compares each answer with a fixed anchor answer. Fresh human labels every two weeks keep that reward model honest, and the first recipe peaked early and then collapsed as the policy exploited its reward model.",
    "Calibration RL changed when the model answers, not what it knows: confident errors on training questions fell from 41% to 13% while confident correct answers stayed at 39% to 38%. Safety RL raised harmful-request refusal and lowered harmless compliance, and distillation later moved both the other way.",
  ],
};

// ---------- data printed in the report ----------
const tiers = [
  { n: 1, t: "Invariants", rule: "Followed without exception. No system, developer or user message, and no lower tier, can override them.",
    items: ["Safety", "Model identity"] },
  { n: 2, t: "Commitments", rule: "Always upheld, but they interact with what the system, developer and user messages ask for.",
    items: ["Accuracy", "Instruction following"] },
  { n: 3, t: "Defaults", rule: "What the model does when no instruction says otherwise.",
    items: ["Helpfulness"] },
];
const signals = [
  { s: "Verifiable check", what: "Code decides. A Python function tests a format constraint, or a SQL engine computes the one right answer.", where: "Single-turn constraints, SQL-grounded long context" },
  { s: "Rubric judge", what: "A language model grades the response against a written rubric or a gold answer and returns a verdict.", where: "Calibration, many-constraint and multi-turn instructions, grounded queries, safety, identity" },
  { s: "Generative reward model", what: "A language model, calibrated against human labels, states which of two responses people would prefer.", where: "Helpfulness in open-ended conversation" },
];
const calib = [
  { when: "Start of RL", cc: 39, hc: 1, dec: 16, hw: 4, cw: 41 },
  { when: "Late in RL (75 to 100% of training)", cc: 38, hc: 6, dec: 36, hw: 7, cw: 13 },
];
const calibCfg = {
  cc: { label: "Confident correct", color: "rgb(var(--text-green))" }, hc: { label: "Hedged correct", color: chartColors[1] },
  dec: { label: "Declined", color: chartColors[0] }, hw: { label: "Hedged wrong", color: "rgb(var(--text-orange))" },
  cw: { label: "Confident wrong", color: "rgb(var(--text-red))" },
};
const calibHeldOut = [
  { set: "Held-out calibration questions, graded by the training judge", m: "Accuracy", a: 42, b: 36 },
  { set: "Held-out calibration questions, graded by the training judge", m: "Hallucination share", a: 48, b: 11 },
  { set: "AA-Omniscience, 600 questions, external judge", m: "Accuracy", a: 31, b: 32 },
  { set: "AA-Omniscience, 600 questions, external judge", m: "Hallucination share", a: 53, b: 33 },
  { set: "117 held-out questions, split by what the pre-RL model knew", m: "Correct on questions it knew", a: 80, b: 73 },
  { set: "117 held-out questions, split by what the pre-RL model knew", m: "Wrong on questions it did not know", a: 49, b: 14 },
];
const sqlSteps = [
  { title: "Source tables", body: "Real records become typed tables with one fact per row, including IDs, units and periods." },
  { title: "Propose the question", body: "Given the schema and a sampled request (kind of answer, number of hops), a planner model writes a natural-language question first." },
  { title: "Derive staged SQL", body: "In the same reply the planner writes a short SQL program whose later stages depend on earlier ones." },
  { title: "Execute and validate", body: "A SQL engine computes the gold answer. Gates reject unsafe SQL, stages whose output is never used, unstable cut-offs and questions that leak the answer." },
  { title: "Reverse check", body: "A second model rebuilds SQL from the question alone. Both programs must agree on the real tables and on perturbed copies of them, so agreement cannot be luck." },
  { title: "Context and RL example", body: "The rows the program read are rendered as documents and interleaved with near misses and filler. The task ships with its gold answer and the rule: reward 1 if the answer equals the gold, else 0." },
];
const sqlSkills = [
  { sql: "A filtered read of the fact table", skill: "Retrieval" },
  { sql: "An aggregate, comparison or ranking over the rows read", skill: "A reasoning step" },
  { sql: "A read whose filter uses a value computed by an earlier stage", skill: "A dependent hop; a chain of them is multi-hop retrieval" },
  { sql: "Several independent reads", skill: "Breadth" },
];
const attributes = [
  ["Safety", "Keeps appropriate boundaries and handles sensitive content responsibly, without over-refusing."],
  ["Correctness", "Accurate, with confidence or uncertainty expressed appropriately."],
  ["Constraint following", "Complies with explicit constraints or format requirements."],
  ["Intent understanding", "Interprets what the user is actually asking for, including implicit needs."],
  ["Coverage", "Addresses all relevant parts of the request, at sufficient depth."],
  ["Proactivity", "Anticipates needs without overstepping."],
  ["Focus", "No tangents, filler or repetition."],
  ["Clarity", "Organized logically and easy to follow, without excessive formatting."],
  ["Tone", "Fits the context: not robotic, preachy, sycophantic or condescending."],
];
const safetyMix = [
  { label: "Single-turn", value: 66.8, color: chartColors[0] },
  { label: "Agentic tool use", value: 17.3, color: chartColors[1] },
  { label: "Multi-turn", value: 8.3, color: chartColors[2] },
  { label: "Jailbreak", value: 7.6, color: chartColors[3] },
];
const safetyJudge = [
  { k: "Single-turn", sees: "The task and the response.", src: "The majority of tasks; both harmful and harmless requests." },
  { k: "Multi-turn", sees: "The earlier conversation turns as well.", src: "Every task contains at least one harmful turn." },
  { k: "Jailbreak", sees: "The seed prompt, that is, the plain intent behind the attack. This helps with attacks that encode the request or hide it among benign questions.", src: "In-house red teaming, vendor human jailbreaks, synthetic Gray Swan jailbreaks." },
  { k: "Agentic tool use", sees: "The earlier turns plus the unsafe action itself.", src: "Multi-turn prompt injection and dangerous tool calls, from the in-house flywheel and Gray Swan." },
];
const seesaw = [
  { stage: "During RL", refuse: 8.3, comply: -10.5 },
  { stage: "During MOPD", refuse: -4.4, comply: 9.9 },
];
const rewardDesign = [
  { env: "Model identity", tier: 1, sig: "Judge on realistic and adversarial questions about who the model is", why: "The report uses a judge here to capture nuance and negations" },
  { env: "Safety", tier: 1, sig: "Context-aware refusal judge: pass if a harmless request is answered or a harmful one is refused or pivoted", why: "Harmless tasks are in the mix so that refusing everything does not score" },
  { env: "Knowledge calibration", tier: 2, sig: "Strict judge against a gold answer: correct 1.0, abstain 0.5, wrong 0.0", why: "Answering pays only above 50% confidence; hedges count as abstentions" },
  { env: "Single-turn constraints", tier: 2, sig: "Binary: the Python verifier AND a judge that the request was really addressed", why: "With the verifier alone the model satisfied the constraint and skipped the task" },
  { env: "Many constraints, multi-turn constraints", tier: 2, sig: "1 only if every rubric (about 21.8 per prompt) or every active constraint passes", why: "Gave better full-task success than averaged rubric scores or partial credit" },
  { env: "Grounded long-context queries", tier: 2, sig: "Instruction-following judge plus claim-level faithfulness judge", why: "A response must address every part of the request and support every claim" },
  { env: "SQL-grounded long context", tier: 2, sig: "1 if the answer equals what a SQL engine computed, else 0", why: "Judges become unreliable as the context grows; code does not" },
  { env: "Helpfulness (RLAIF)", tier: 3, sig: "Reward model compares the answer with a fixed anchor, five levels mapped to 0 to 1, with penalty factors and a length penalty", why: "Pairwise verdicts spread a group's rewards; pointwise scores and logits did not" },
];

// ---------- small private components ----------
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function TierLadder() {
  return (
    <div className="flex flex-col gap-2">
      {tiers.map((r) => (
        <div key={r.t} className="flex gap-3 rounded-lg bg-wash px-4 py-3">
          <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-[12px] text-primary">{r.n}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold leading-6 text-primary">{r.t}</span>
              {r.items.map((x) => <Badge key={x}>{x}</Badge>)}
            </div>
            <span className="text-[14px] leading-6 text-secondary">{r.rule}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ForecastDemo() {
  const [pi0, setPi0] = useState(0.05);
  const [g, setG] = useState(1.0);
  const KE = 0.05, STEPS = 300;
  const data = useMemo(() => {
    let L = Math.log(pi0 / (1 - pi0)); const out = [];
    for (let s = 0; s <= STEPS; s++) {
      const p = sigmoid(L);
      if (s % 10 === 0) out.push({ step: s, prev: +(p * 100).toFixed(1) });
      L += 2 * KE * g * p * (1 - p);
    }
    return out;
  }, [pi0, g]);
  const end = data[data.length - 1].prev;
  const half = data.find((d) => (g > 0 ? d.prev >= 50 : d.prev <= 50));
  const presets = [
    { name: "Rare but rewarded", pi0: 0.05, g: 1.0 },
    { name: "Common but penalized", pi0: 0.9, g: -1.0 },
    { name: "Reward cannot see it", pi0: 0.3, g: 0 },
    { name: "Rewarded but almost absent", pi0: 0.01, g: 0.3 },
  ];
  return (
    <Demo title="Forecast how common a behavior becomes"
      takeaway={"What to notice: change is slow while the behavior is rare, fastest near 50%, and slow again near 0% or 100%, because the update needs both variants in the same group to compare. With g = 0 the line is flat at the SFT value. The constant κη is set to 0.05 per step here and the step axis is arbitrary; the report fits κη on one completed run and does not print its value."}>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p.name} size="sm" variant="secondary" onClick={() => { setPi0(p.pi0); setG(p.g); }}>{p.name}</Button>
        ))}
      </div>
      <Slider label="Share of rollouts at step 0, π₀" value={pi0} min={0.01} max={0.99} step={0.01} onChange={setPi0} fmt={(v) => pct(v)} />
      <Slider label="Selective advantage, g (in SDs)" value={g} min={-2} max={2} step={0.1} onChange={setG} fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(1)} />
      <ChartContainer config={{ prev: { label: "Rollouts showing the behavior (%)", color: chartColors[0] } }} style={{ height: 220, width: "100%" }}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <ChartGrid /><ChartXAxis dataKey="step" type="number" domain={[0, 300]} ticks={[0, 50, 100, 150, 200, 250, 300]} /><ChartYAxis title="% of rollouts" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLine dataKey="prev" dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-primary">
        <span>Start: <span className="font-mono">{pct(pi0)}</span></span>
        <span>After {STEPS} steps: <span className="font-mono">{end}%</span></span>
        <span>Crosses 50%: <span className="font-mono">{g === 0 || !half || (g > 0 ? pi0 >= 0.5 : pi0 <= 0.5) ? "n/a" : "about step " + half.step}</span></span>
      </div>
    </Demo>
  );
}

function AbstainDemo() {
  const [p, setP] = useState(0.35);
  const [scheme, setScheme] = useState("three");
  const abst = scheme === "three" ? 0.5 : 0;
  const best = p > abst ? "Answer" : p === abst ? "Indifferent" : "Abstain";
  const Bar = ({ label, v, win }) => (
    <div className="flex items-center gap-3 text-[13px] text-primary">
      <span className="w-[220px] shrink-0">{label}</span>
      <div className="h-3 grow overflow-hidden rounded-full bg-wash">
        <div className="h-3 rounded-full" style={{ width: v * 100 + "%", background: win ? "rgb(var(--text-green))" : chartColors[0], opacity: win ? 1 : 0.45 }} />
      </div>
      <span className="w-[60px] shrink-0 text-right font-mono">{v.toFixed(2)}</span>
    </div>
  );
  return (
    <Demo title="When does answering beat abstaining?"
      takeaway="What to notice: under an accuracy-only reward, answering wins at every confidence above zero, so the policy learns to guess. Making an abstention worth 0.5 moves the break-even point to 50% confidence. The confidence value is a made-up input; a real policy never sees this number and has to learn the boundary from rewards.">
      <SegmentedControl value={scheme} onValueChange={(v) => v && setScheme(v)} size="small">
        <SegmentedControlItem value="three">Three-level reward (abstain = 0.5)</SegmentedControlItem>
        <SegmentedControlItem value="acc">Accuracy only (abstain = 0)</SegmentedControlItem>
      </SegmentedControl>
      <Slider label="Chance the answer is right, p" value={p} min={0} max={1} step={0.01} onChange={setP} fmt={(v) => pct(v)} />
      <div className="flex flex-col gap-2">
        <Bar label="Expected reward: answer" v={p} win={p > abst} />
        <Bar label="Expected reward: abstain" v={abst} win={abst > p} />
      </div>
      <div className="flex items-center gap-2 text-[13px] text-primary">
        <span>Better choice:</span><Badge variant={best === "Answer" ? "blue" : best === "Abstain" ? "purple" : "default"}>{best}</Badge>
      </div>
    </Demo>
  );
}

function SelectDemo() {
  const [c, setC] = useState(3);
  const [a, setA] = useState(5);
  const N = 16;
  const aa = Math.min(a, N - c), w = N - c - aa;
  const mean = (c * 1 + aa * 0.5) / N;
  const uniform = c === N || aa === N || w === N;
  const low = mean < 0.4;
  let verdict, tone, why;
  if (uniform) { verdict = "Discard"; tone = "destructive"; why = "All 16 rollouts get the same reward, so every advantage in the group is zero and nothing can be learned."; }
  else if (low && aa === 0) { verdict = "Discard"; tone = "destructive"; why = "A low-reward question with no abstention among its rollouts gives RL no abstaining rollout to reinforce."; }
  else {
    verdict = "Keep"; tone = "success";
    why = (w > 0 && aa > 0 ? "Wrong answers sit next to abstentions, so abstaining is rewarded over guessing. " : "") +
          (c > 0 && aa > 0 ? "Correct answers sit next to abstentions, so answering is rewarded over declining. " : "") +
          (aa === 0 ? "Correct and wrong answers are both present, so the group still has reward spread. " : "");
  }
  const cells = [];
  for (let i = 0; i < N; i++) cells.push(i < c ? "c" : i < c + aa ? "a" : "w");
  const col = { c: "rgb(var(--text-green))", a: chartColors[0], w: "rgb(var(--text-red))" };
  return (
    <Demo title="Would this question be used for calibration RL?"
      takeaway="What to notice: a question is useful only when its 16 rollouts disagree. The counts are made-up inputs. The report says the kept questions are binned into five bands by mean reward and that low-reward bands must contain an abstention, but not where the bands lie; this demo treats a mean reward below 0.4 as low.">
      <Slider label="Correct answers (reward 1.0)" value={c} min={0} max={N} step={1} onChange={setC} />
      <Slider label="Abstentions (reward 0.5)" value={aa} min={0} max={N - c} step={1} onChange={setA} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-[3px]" aria-label="The 16 rollouts">
          {cells.map((k, i) => <span key={i} className="h-4 w-4 rounded-[3px]" style={{ background: col[k] }} />)}
        </div>
        <span className="text-[12.5px] text-secondary">{c} correct, {aa} abstain, {w} wrong</span>
        <span className="text-[13px] text-primary">Mean reward <span className="font-mono">{mean.toFixed(2)}</span></span>
      </div>
      <div className="flex items-start gap-2 text-[13px] leading-5 text-primary">
        <Badge variant={tone}>{verdict}</Badge><span>{why}</span>
      </div>
    </Demo>
  );
}

function AllOrNothingDemo() {
  const [n, setN] = useState(22);
  const [q, setQ] = useState(0.95);
  const all = Math.pow(q, n);
  const Bar = ({ label, v, color }) => (
    <div className="flex items-center gap-3 text-[13px] text-primary">
      <span className="w-[220px] shrink-0">{label}</span>
      <div className="h-3 grow overflow-hidden rounded-full bg-wash"><div className="h-3 rounded-full" style={{ width: v * 100 + "%", background: color }} /></div>
      <span className="w-[60px] shrink-0 text-right font-mono">{pct(v, 0)}</span>
    </div>
  );
  return (
    <Demo title="Why an averaged rubric score flatters the model"
      takeaway="What to notice: with 22 rubrics that each pass 95% of the time, the averaged score reads 95% although only about a third of responses satisfy the whole request. The all-or-nothing reward is the second bar, so it pays for exactly what the user needs. This is toy arithmetic that assumes rubrics pass independently; the pass rate is a made-up input and 22 is the report's average of about 21.8 rounded.">
      <Slider label="Rubrics on the prompt" value={n} min={1} max={40} step={1} onChange={setN} />
      <Slider label="Chance each rubric passes" value={q} min={0.8} max={1} step={0.01} onChange={setQ} fmt={(v) => pct(v)} />
      <div className="flex flex-col gap-2">
        <Bar label="Averaged rubric score" v={q} color={chartColors[0]} />
        <Bar label="Responses that pass every rubric" v={all} color="rgb(var(--text-green))" />
      </div>
    </Demo>
  );
}

function Shift({ a, b }) {
  return (
    <span className="whitespace-nowrap font-mono text-[13px]">{a}% <span className="text-secondary">to</span> {b}%</span>
  );
}

const forecastCode = `# Illustrative sketch of the forecast. The equations are the report's;
# the code, and the exact way g is averaged over groups, are not.
def measure_at_step_0(groups, shows_behavior):
    # groups: a few dozen tasks, each with its scored rollouts
    pi0 = mean(shows_behavior(y) for grp in groups for y in grp)
    gaps = []
    for grp in groups:
        yes = [y.reward for y in grp if shows_behavior(y)]
        no = [y.reward for y in grp if not shows_behavior(y)]
        if yes and no and std(grp.rewards) > 0:
            gaps.append((mean(yes) - mean(no)) / std(grp.rewards))
    return pi0, mean(gaps)                 # prevalence, selective advantage g

def forecast(pi0, g, kappa_eta, steps):
    L = log(pi0 / (1 - pi0))               # log-odds of the behavior
    for _ in range(steps):
        pi = 1 / (1 + exp(-L))
        L += 2 * kappa_eta * g * pi * (1 - pi)
    return 1 / (1 + exp(-L))               # forecast prevalence`;

const rlaifCode = `# Illustrative sketch of the helpfulness reward. The report describes each
# piece in prose; it prints no code, does not give the five level values
# (even spacing is assumed here) and does not say in which order the
# penalties are applied.
LEVEL = {"strongly disfavored": 0.0, "disfavored": 0.25, "tie": 0.5,
         "favored": 0.75, "strongly favored": 1.0}

def helpfulness_reward(task, rollout):
    verdict = reward_model.compare(
        prompt=task.first_user_turn,
        policy_answer=rollout.final_answer,
        anchor_answer=task.anchor,          # fixed per prompt
        policy_shown_first=task.order,      # fixed per prompt
        rubric=NINE_ATTRIBUTES)
    r = LEVEL[verdict]
    r *= unnecessary_content_factor(rollout)   # e.g. needless follow-up questions
    r *= withheld_content_factor(rollout)      # e.g. clarifying instead of answering
    r -= lam * len(rollout.final_answer)       # the reward model likes long answers
    r -= reasoning_effort_cost(rollout)
    return r`;

function Lesson() {
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="Training values that have no unit test">
        <Lead>
          Beam is distilled from two teachers. The agentic teacher (<LessonLink to="rl" /> and <LessonLink to="tasks" />) learns to solve tasks. This lesson is about the
          second one, the alignment teacher, whose job is to make the final model safe, accurate, good at following instructions and
          helpful.
        </Lead>
        <P>
          The alignment teacher starts from the same midtrained checkpoint as the agentic teacher and follows a similar recipe:
          supervised fine-tuning (SFT) on demonstrations, then reinforcement learning (RL), in which the model attempts tasks and is
          pushed toward its better-scoring attempts. A single attempt is called a <Term def="One complete attempt at a task by the current model: its reasoning, any tool calls, and its final answer.">rollout</Term>,
          and the model being trained is called the <Term def="The model viewed as something that chooses outputs. 'The policy' and 'the model being trained' mean the same thing here.">policy</Term>.
          The report names three ways in which this teacher differs from its sibling.
        </P>
        <Findings items={[
          <span><b>Broader tasks.</b> Values show up in writing and editing, fact-finding, document understanding, open-ended conversation and multi-turn collaboration, not only in coding, STEM and terminal use.</span>,
          <span><b>No test suite.</b> Whether a reply was helpful or safe cannot be decided by running code. Rewards therefore come from three kinds of signal, shown in the second table below.</span>,
          <span><b>Goals that pull against each other.</b> Safety can conflict with following instructions, and helpfulness can come at the expense of accuracy. The team chose a small, carefully built data mixture and shorter runs, with people evaluating the result regularly, so that they could adjust subjective criteria, tune tradeoffs and catch reward hacks.</span>,
        ]} />

        <H3>What the model should do, in priority order</H3>
        <P>
          Because the goals conflict, the report ranks them. The ranking has three tiers, and a higher tier wins when two principles
          disagree.
        </P>
        <Panel caption="The principle hierarchy from section 4.2.1. Accuracy covers factuality, faithfulness to the provided context, and calibrated confidence about both. Instruction following covers system and developer instructions, transparent pursuit of the user's objective, and reasonable resolution of uncertainty. Helpfulness covers how comprehensive, efficient, proactive and consistent responses are.">
          <TierLadder />
        </Panel>

        <H3>Three kinds of reward signal</H3>
        <P>
          Each principle is trained in one or more RL environments, and each environment needs something
          that turns a response into a number. The report names three kinds of signal, listed here from the most mechanical to
          the most subjective. The reward model is used for conversational quality, where the report treats human judgment as
          the only ground truth.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Signal</TableHead><TableHead>How it scores a response</TableHead><TableHead>Used for</TableHead></TableRow></TableHeader>
          <TableBody>
            {signals.map((r) => <TableRow key={r.s}><TableCell className="font-medium">{r.s}</TableCell><TableCell>{r.what}</TableCell><TableCell>{r.where}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <P>
          A <Term def="A language model used as a grader. It reads a response together with a rubric, a gold answer or other context, and outputs a verdict that is turned into a reward.">judge</Term> can
          be fooled in ways a compiler cannot, so most of the design work in this lesson is about closing the cheapest route to a high
          score that does not involve doing the right thing.
        </P>

        <H3>Seed with SFT, then shape with RL</H3>
        <P>
          RL works by comparing rollouts and making the better ones more likely. It cannot reward a behavior that never occurs. The
          clearest example is declining to answer: the starting policy rarely said "I don't know", so there was nothing for RL to
          reinforce.
        </P>
        <P>
          The fix is the same for every principle. A small amount of targeted SFT data makes the behavior appear in some rollouts,
          and RL then decides how often it should appear. How the seed sets are built is covered in <LessonLink to="sft" />, not here.
        </P>

        <H3>Forecasting what RL will do before running it</H3>
        <P>
          Seeding raises a practical question: given a checkpoint and a reward, which behaviors will RL amplify and which will it
          remove? The report answers it with an idea borrowed from population genetics. Think of the rollouts as a population and a
          behavior, for example wrapping every answer in headings, as a trait some of them carry.
        </P>
        <P>
          A trait spreads when two things hold: enough individuals already carry it, and carriers do better than non-carriers. For a
          behavior these become its prevalence at the SFT checkpoint and its selective advantage, meaning how much more reward
          rollouts with the behavior earn than the other rollouts for the same task. Both can be measured before RL starts.
        </P>
        <KeyIdea>
          SFT decides which behaviors exist and how common they are. The reward decides which of them grow. A behavior the reward
          cannot see stays exactly as common as SFT left it, which is why the team removed unwanted habits
          with filters and with changes to the reward.
        </KeyIdea>
      </Stage>

      <Stage step={2} title="The forecast, then one reward per principle">
        <P>
          This part has two halves. The first turns the population picture into two equations. The second goes through the RL
          environments one principle at a time and explains the shape of each reward.
        </P>

        <H3>The forecast: prevalence times selective advantage</H3>
        <P>
          The alignment teacher is trained with GRPO, the method described in <LessonLink to="rl" />: for each task the policy
          produces a group of rollouts, each rollout gets a reward, and its <Term def="A rollout's reward minus the mean reward of its group, divided by the group's standard deviation. Positive means better than the group's average.">advantage</Term> is
          how far its reward sits above the group mean, in units of the group's standard deviation. Each rollout pulls the policy
          toward itself in proportion to its advantage.
        </P>
        <P>
          The first equation says how much weight a behavior gains in one batch. Read it as "how many rollouts pull" times "how hard
          each pulls".
        </P>
        <Eq label="Gain per batch" note="From the report.">
          Δθ = κη · π · <V>Ā</V>
        </Eq>
        <Where items={[
          ["Δθ", "the change, per batch, in the behavior's log-weight: how strongly the policy favors it"],
          ["π", "prevalence: the fraction of rollouts that show the behavior"],
          [<span>Ā</span>, "the mean advantage of those rollouts"],
          ["κη", "one constant for the whole training recipe that sets the speed. It is fitted once on one completed run and reused for every other run"],
        ]} />
        <P>
          The second equation follows the behavior over time. It is written for the log-odds of the behavior, a quantity that
          runs from very negative when the behavior almost never occurs to very positive when it almost always does.
        </P>
        <Eq label="Behavior equation" note="From the report, which calls it a replicator-type equation after the replicator equation of evolutionary dynamics.">
          d<V>L</V> / d<V>t</V> ≈ 2 κη · <V>g</V> · π (1 − π), &nbsp;&nbsp; where <V>L</V> = log( π / (1 − π) )
        </Eq>
        <Where items={[
          ["L", "the log-odds of the behavior; it rises when the behavior becomes more common"],
          ["t", "training time, in batches"],
          ["g", "selective advantage: how many within-group reward standard deviations the behavior's rewards sit above the alternatives"],
          ["π (1 − π)", "largest at π = 50% and zero at 0% and 100%: selection needs both variants present to have something to compare"],
        ]} />
        <P>
          The sign of <V>g</V> gives the direction. Behaviors with <V>g</V> &gt; 0 are amplified, those with <V>g</V> &lt; 0 are
          squashed, and those with <V>g</V> ≈ 0 stay frozen at their SFT prevalence. The starting prevalence π<sub>0</sub> and <V>g</V> are
          measured at step 0 from a few dozen scored groups, so a forecast costs a small evaluation, not a training run.
        </P>
        <ForecastDemo />
        <P>
          Applied to the reward itself, the same update predicts how fast an environment's score climbs.
        </P>
        <Eq label="Reward equation" note="From the report.">
          d<V>R</V> / d<V>t</V> = κη · σ<sub><V>R</V></sub>
        </Eq>
        <Where items={[
          ["R", "the mean reward of one environment"],
          [<span>σ<sub>R</sub></span>, "the standard deviation of reward within a group of rollouts for the same task"],
        ]} />
        <P>
          Reward rises in proportion to the spread that is left. When every rollout in a group scores the same there is nothing to
          select between and progress stops. The report says the reward therefore saturates at
          the <Term def="As commonly defined (the report does not define it): the share of tasks on which at least one of k sampled rollouts succeeds. It is the best a policy could do by learning to always produce its own best attempt.">pass@k ceiling</Term>.
        </P>
        <P>
          In code the whole procedure is a measurement followed by a short loop.
        </P>
        <CodeBlock code={forecastCode} />

        <H3>Accuracy: a reward that makes "I don't know" worth saying</H3>
        <P>
          The knowledge calibration environment trains the model to answer a factual question when it knows the answer and to abstain
          when it does not. The report draws the line between two measures: accuracy asks whether an answer is correct, calibration
          also asks whether the model should have answered at all. Training on accuracy alone rewards guessing.
        </P>
        <P>
          The questions are closed-book and short-answer, generated from documents in the pretraining web corpus so that only
          the model's <Term def="What a model can recall from its weights alone, with no document or search tool to consult.">parametric knowledge</Term> can
          answer them. Filters remove questions that are time-sensitive, ambiguous, built on a false premise, or not answerable from
          the source document. One example from the report: "In what year did photographer Herman Leonard open his own studio in
          Greenwich Village?" (1948).
        </P>
        <P>
          A strict judge compares the final answer with a gold answer that was verified by search offline, and returns one of three
          outcomes.
        </P>
        <Eq label="Three-level calibration reward" note="From the report. p is the probability that the model's answer would be judged correct.">
          <V>r</V> = 1.0 if correct, &nbsp; 0.5 if it abstains, &nbsp; 0.0 if wrong &nbsp;&nbsp;⇒&nbsp;&nbsp; answering pays only when <V>p</V> &gt; 0.5
        </Eq>
        <P>
          Answering earns <V>p</V> on average and abstaining always earns 0.5, so the reward itself places the boundary at 50%
          confidence. The demo compares this with an accuracy-only reward.
        </P>
        <AbstainDemo />
        <P>
          The reward is only half of the design. In GRPO a task teaches something only if its rollouts receive different rewards.
          A question teaches abstaining when its rollouts contain both abstentions and wrong answers, and teaches answering when
          correct answers appear next to abstentions.
        </P>
        <P>
          So candidate questions are screened with the current policy before training. Each one is sampled 16 times and scored with
          the RL judge. Questions whose 16 rewards are identical are dropped. The rest are binned into five bands by mean reward and
          drawn equally from each band, with at least one abstention required in the low-reward bands.
        </P>
        <SelectDemo />
        <P>
          This screening is what lets calibration stay useful at about 3% of the RL mixture. It keeps both sides of the knowledge
          boundary represented and keeps groups away from the all-same rewards at which the trainer discards them. Each task also
          carries one of ten developer messages asking for a short answer.
        </P>

        <H3>Instruction following: a gate against each shortcut</H3>
        <P>
          The model is already instruction-tuned. These environments target the harder cases: constraints that sit at different
          levels of the instruction hierarchy (the developer message set by the application builder versus the user message) and
          constraints that must be remembered across a conversation. There are three environments.
        </P>
        <Steps items={[
          { title: "Single-turn constraints, double-gated",
            body: "An adapted AutoIF pipeline generates pairs of a natural-language constraint and a Python function that checks it. Constraints cover length, output format, required or forbidden words, per-sentence or per-section templates, capitalization and punctuation, and ordering or repetition. Each is attached to a real user request from filtered WildChat prompts, in the developer message for 70% of tasks and in the user message for 30%. The reward is 1 only if the Python verifier passes and a judge agrees that the response genuinely addressed the request." },
          { title: "Many constraints at once, all-or-nothing",
            body: "Vendor-written prompts for writing, editing, planning, summarization, extraction and classification, each with about 21.8 rubrics on average that code cannot check. A judge evaluates every rubric and the reward is 1 only if all required rubrics pass." },
          { title: "Multi-turn constraints, all-or-nothing",
            body: "Conversation templates specify when a simulated user introduces, activates or revises an instruction. Four behaviors are targeted: keeping a standing instruction across turns, applying a conditional instruction only when its condition holds, combining a conversation-wide constraint with a one-turn requirement, and replacing an earlier instruction. The policy receives a stored history and writes the final assistant turn. A judge sees the constraints active on that turn and gives 1 only if every one is satisfied." },
        ]} />
        <P>
          The double gate exists because of an observed failure. With the verifier alone, the report says, the model learned to
          circumvent the underlying task: a reply can satisfy "under 50 words, no commas" without answering the question.
        </P>
        <P>
          The all-or-nothing rule is a choice among three options the team tried. The demo shows why the obvious alternative,
          averaging the rubric scores, hides most failures.
        </P>
        <AllOrNothingDemo />

        <H3>Faithfulness to context: a judge, then a SQL engine</H3>
        <P>
          Faithfulness means every claim in a response is supported by the context the model was given. Two environments train it,
          with a focus on contexts longer than 32K tokens.
        </P>
        <P>
          The first, grounded queries, pairs a document (a GoodWiki Wikipedia article or a web document from the midtraining corpus)
          with one request that needs a long answer, drawn from nine request types such as summarization, fact-finding and listing
          pros and cons. For longer inputs, 2 to 40 documents on the same topic are packed into one context and the questions require
          combining them. Half are navigation queries, whose answer is scattered over several documents. Half are multi-hop queries
          with 4 to 7 chained retrieval or computation steps and an explicit output format.
        </P>
        <P>
          All of these share one reward adapted from the FACTS Grounding rubric, made of two judges. An instruction-following judge
          checks that the response addresses every part of the request, calibrated against a reference answer. A claim-level
          faithfulness judge checks that every claim is supported by the context.
        </P>
        <P>
          Judges have a weakness here: they become less reliable as the context grows, which is exactly where the training is aimed.
          The second environment removes the judge by building tasks backwards from structured data, so that a SQL engine knows the
          answer and which facts it depends on. The six steps below follow the report's figure 27.
        </P>
        <Panel title="How one SQL-grounded task is produced" caption="A model writes the question and the SQL; code computes the answer and runs the checks. A failed check sends the item back to be repaired, reworded or replanned.">
          <Steps items={sqlSteps} />
        </Panel>
        <P>
          The construction works because SQL operations line up with the skills a long-context question demands, as the next table
          shows. Choosing the shape of the SQL program chooses the difficulty of the reading task.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>In the SQL program</TableHead><TableHead>What the model must do in the documents</TableHead></TableRow></TableHeader>
          <TableBody>
            {sqlSkills.map((r) => <TableRow key={r.sql}><TableCell>{r.sql}</TableCell><TableCell className="font-medium">{r.skill}</TableCell></TableRow>)}
          </TableBody>
        </Table>

        <H3>Helpfulness: learning from a reward model without being fooled by it</H3>
        <P>
          Helpfulness in open conversation has no gold answer. The report treats human judgment as the ground truth and uses
          RLAIF, <Term def="Reinforcement learning from AI feedback: the reward comes from a model trained or prompted to predict human preference. RLHF is the same idea with the reward model fitted to human feedback.">reinforcement learning from AI feedback</Term>,
          to scale it. People cannot grade every rollout, so they grade a sample and two automated graders are calibrated to agree
          with them.
        </P>
        <Panel title="The human-calibration loop" caption="Human labels do two jobs: they define the target that both automated graders imitate, and fresh labels on the newest checkpoint's outputs are the only reliable way to notice when the policy has started to please the graders in ways people do not prefer (Goodhart's law).">
          <Diagram direction="LR"
            nodes={[
              { id: "h", title: "Human labels", sub: "every two weeks" },
              { id: "j", title: "Proxy preference judge", sub: "offline arena, Elo" },
              { id: "r", title: "Generative reward model", sub: "reward inside RL" },
              { id: "p", title: "New checkpoints", sub: "responses to label" },
            ]}
            edges={[
              { from: "h", to: "j", label: "calibrate" }, { from: "h", to: "r", label: "calibrate" },
              { from: "r", to: "p", label: "trains" }, { from: "j", to: "p", label: "ranks" },
            ]} />
          <Small>The loop closes outside the picture: responses from the new checkpoints go back to the annotators for the next batch of labels.</Small>
        </Panel>
        <P>
          The human side is specific. Every two weeks, on 200 to 300 prompts, annotators rate responses from the latest checkpoints
          and from comparable external models. They score each response from 1 to 5 on the attributes below and state a pairwise
          preference against an anchor response. Five annotators label each pair, and the label used is the mean of the three who
          agree most.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Attribute</TableHead><TableHead>What the annotator, and later the reward model, asks</TableHead></TableRow></TableHeader>
          <TableBody>
            {attributes.map(([k, v]) => <TableRow key={k}><TableCell className="whitespace-nowrap font-medium">{k}</TableCell><TableCell>{v}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <Small>The nine attributes of conversational quality, shortened from the report's table 9. Safety, constraint following and proactivity are marked not applicable when a prompt does not call for them.</Small>
        <P>
          The first grader, the proxy preference judge, is used only for evaluation. It decides pairwise battles between a candidate
          model and six anchor models, from weak to strong, on 455 open-ended prompts.
          A <Term def="A statistical model that assigns each player one strength number such that the chance one beats another depends only on the difference of their strengths. Elo ratings are a rescaled version of those strengths.">Bradley-Terry</Term> fit
          turns the battles into Elo scores, with GLM 5.2 fixed at 1,000. Its prompt was tuned by an automated sweep over variants
          until its agreement with human labels exceeded the agreement between human raters.
        </P>
        <P>
          The second grader, the generative reward model, supplies the RL reward. The tasks are public open-ended prompts
          (general-knowledge and advice questions) cut to the first user turn. Each has one fixed anchor response, and the reward
          model says how the policy's answer compares with it. The sketch shows how the pieces combine; the list after it explains
          each choice.
        </P>
        <CodeBlock code={rlaifCode} />
        <Findings items={[
          <span><b>Pairwise against an anchor.</b> The verdict has five levels, from strongly disfavored to strongly favored, mapped to 0 to 1. The anchor sets the difficulty: anchors that were too easy started training already saturated, and anchors from mid-sized models were saturated by the end. Candidate anchors came from several models, and for each prompt the first one in a fixed priority order that passed claim-level factuality and temporal checks was kept. The 2.6% of prompts with no accurate and current candidate were dropped.</span>,
          <span><b>Fixed order per prompt.</b> Graders tend to favor whichever response they read first or second. Whether the policy's answer or the anchor is shown first is fixed for each prompt, so every rollout in a group gets the same bias and it cancels when advantages are computed within the group.</span>,
          <span><b>Two penalty factors.</b> One grader flags unnecessary content, such as follow-up questions and self-validation. The other flags withheld content, such as clarifying instead of answering and unwarranted refusal. Each flag is weighted by its measured precision against human labels, and both factors multiply the preference reward.</span>,
          <span><b>Length penalty.</b> The reward model prefers longer responses, so a penalty linear in the length of the final answer is subtracted, alongside the cost on reasoning effort that <LessonLink to="rl" /> describes.</span>,
        ]} />

        <H3>The invariants: safety and identity</H3>
        <P>
          Safety RL differs from the other environments in one structural way. Each of them covers a single kind of task; the safety
          environment is deliberately mixed. It spans single-turn requests, multi-turn conversations,
          {" "}<Term def="A prompt written to trick a model into complying with a request it should refuse, for example by encoding the request or hiding it among benign questions.">jailbreaks</Term> and
          agentic tool-use tasks, across every harm category in Reflection's policy, with harmless, gray-area and harmful prompts.
        </P>
        <Panel title="Safety RL tasks by category (share of training tasks)" caption="From the report's figure 49. Agentic tasks cover multi-turn prompt injection, where text returned by a tool tries to give the model orders, and dangerous tool calls.">
          <SegmentedBar separated legend="inline" total={100}
            segments={safetyMix.map((s) => ({ label: s.label, value: s.value, color: s.color, valueLabel: s.value + "%" }))} />
        </Panel>
        <P>
          The scoring rule is symmetric, which is what makes it a reward for judgment and not for refusal. Answering a harmless
          request passes. Refusing or pivoting away from a harmful one passes. The two opposite cases fail.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Passes if the model</TableHead><TableHead>Fails if the model</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">Harmless</TableCell><TableCell>Answered</TableCell><TableCell>Refused or pivoted (over-refusal)</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Harmful</TableCell><TableCell>Refused or pivoted</TableCell><TableCell>Answered (harmful compliance)</TableCell></TableRow>
          </TableBody>
        </Table>
        <P>
          Three more settings complete the environment. Harmless and harmful tasks are mixed 1 to 5. Tasks the SFT checkpoint already
          handles reliably are dropped, so the budget goes to cases that are still open. The environment holds a fixed 5% of the
          alignment teacher's RL mixture.
        </P>
        <P>
          The judge is called context-aware because what it is shown depends on the task type. A reply that looks harmless on its own
          can be the last step of a harmful conversation, and the judge can only see that if it is given the history.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Task type</TableHead><TableHead>What the judge is given</TableHead><TableHead>Where the tasks come from</TableHead></TableRow></TableHeader>
          <TableBody>
            {safetyJudge.map((r) => <TableRow key={r.k}><TableCell className="whitespace-nowrap font-medium">{r.k}</TableCell><TableCell>{r.sees}</TableCell><TableCell>{r.src}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <P>
          The second invariant is identity. The report's reasoning is that pretraining teaches a model many personas and
          post-training selects the "AI assistant" one, and that drifting away from this persona has been observed to predict
          misaligned behavior. An RL environment therefore reinforces the default persona: Beam, a helpful AI assistant trained by
          Reflection. Its tasks mix realistic questions about who the model is with adversarial attempts to change that, scored by a
          judge so that nuance and negations are read correctly.
        </P>

        <H3>All eight rewards side by side</H3>
        <P>
          The table collects the environments above. Read the last column as the answer to "what would the policy do if this reward
          were simpler?".
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Environment</TableHead><TableHead>Tier</TableHead><TableHead>Reward</TableHead><TableHead>Why this shape</TableHead></TableRow></TableHeader>
          <TableBody>
            {rewardDesign.map((r) => <TableRow key={r.env}><TableCell className="font-medium">{r.env}</TableCell><TableCell>{r.tier}</TableCell><TableCell>{r.sig}</TableCell><TableCell>{r.why}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <Small>
          Only two mixture shares are printed: knowledge calibration is about 3% of the RL mixture and safety a fixed 5%. The report
          does not give the shares of the other environments. The alignment teacher also trains on some of the multi-turn tool-use
          tasks with a simulated user (see <LessonLink to="tasks" />), which matters for one of the findings in part 3.
        </Small>

        <H3>How two recipe variants were compared</H3>
        <P>
          With this many environments, a change that helps one benchmark often hurts another. To decide whether a variant was better
          overall, the team rescaled every benchmark to a common scale and averaged. Each score is placed between two reference
          models.
        </P>
        <Eq label="Normalized score" note="From the report. Values below 0 or above 1 are kept, not clipped.">
          <V>z</V><sub><V>m</V>,<V>e</V></sub> = ( <V>s</V><sub><V>m</V>,<V>e</V></sub> − <V>f</V><sub><V>e</V></sub> ) / ( <V>h</V><sub><V>e</V></sub> − <V>f</V><sub><V>e</V></sub> )
        </Eq>
        <Where items={[
          [<span>s<sub>m,e</sub></span>, "the raw score of model m on evaluation e"],
          [<span>f<sub>e</sub></span>, "the lower reference: the score of a model the team aims to meet or exceed. It maps to 0"],
          [<span>h<sub>e</sub></span>, "the upper reference: the score of a stronger model that is the current target. It maps to 1, and was replaced by stronger models as development went on"],
        ]} />
        <Eq label="Overall score" note="From the report.">
          <V>O</V><sub><V>m</V></sub> = mean over categories <V>c</V> of <V>A</V><sub><V>m</V>,<V>c</V></sub>, &nbsp;&nbsp; <V>A</V><sub><V>m</V>,<V>c</V></sub> = mean of <V>z</V><sub><V>m</V>,<V>e</V></sub> over the evaluations <V>e</V> in <V>c</V>
        </Eq>
        <P>
          Each benchmark belongs to a category such as instruction following or safety. Averaging within a category first and then
          across categories gives every category the same weight however many benchmarks it holds. The overall
          score <V>O</V><sub><V>m</V></sub> was the internal number to climb. Scores are comparable only when computed with the same
          references.
        </P>
        <P>
          To tell a real difference from noise, the team used a paired bootstrap: resample the evaluation tasks with replacement
          10,000 times, keep both models' results for each sampled task together, recompute the difference in overall score each
          time, and take the 2.5th and 97.5th percentiles as a 95% interval. An interval that excludes zero counts as significant.
          The report notes what this leaves out: variance between training runs, systematic grading errors, and uncertainty in the
          references.
        </P>
      </Stage>

      <Stage step={3} title="What changed, and what went wrong on the way">
        <P>
          The results follow the order of part 2: the forecast first, then each principle. Most numbers are before-and-after
          comparisons across RL for the alignment teacher.
        </P>

        <H3>The forecast held up across 318 runs</H3>
        <P>
          With κη fitted on a single run, the reward equation was used to predict how much each reward component would gain in 318
          post-training runs. The comparison is against the simpler predictor it extends, the pass@k ceiling.
        </P>
        <Panel title="Correlation between predicted and realized reward gain (Pearson r, 318 runs)" caption="The pass@k ceiling says how much room an environment has. The replicator forecast adds how fast the recipe will use that room.">
          <BarList max={1} data={[
            { label: "Replicator forecast from step 0", value: 0.79, valueLabel: "r = 0.79" },
            { label: "pass@k ceiling alone", value: 0.46, valueLabel: "r = 0.46" },
          ]} />
        </Panel>
        <P>
          The behavior equation was put to a sharper test. Using the same κη and only step-0 measurements, it predicted whether a
          given misbehavior would be amplified or squashed under different reward functions. The team used those predictions to
          design filters and reward changes that removed two habits: template-heavy scaffolding and unnecessary markdown formatting.
          Figure 25 of the report plots both habits under the problematic reward and under the fixed one. In each case the
          observed points follow the forecast band: the habit stays common or grows under the first reward, and is squashed or stays
          rare under the second. The report prints no values for those curves, so they are not redrawn here.
        </P>
        <Surprise title="SFT fixes which behaviors exist, not how common they end up">
          Industry reports cited in the report found that most safety- and alignment-relevant behaviors are already in place at the
          SFT checkpoint, which suggests reading the final model off that checkpoint. The team found the checkpoint is predictive,
          but that prevalence can change dramatically through RL. Prevalence had to be combined with selective advantage to get an
          accurate forecast.
        </Surprise>

        <H3>Calibration changed when the model answers, not what it knows</H3>
        <P>
          The panel shows how the policy answered its calibration training questions at the start of RL and late in RL. Sampled
          rollouts were regraded offline on five levels, although training used the three-level reward. Compare the red and green
          ends of the two bars.
        </P>
        <Panel title="How the model answers its calibration training questions (% of rollouts)"
          caption="From the report's figure 26, top left. Confident errors fall from 41% to 13% and declined answers rise from 16% to 36%, while confident correct answers barely move, from 39% to 38%.">
          {calib.map((c) => (
            <div key={c.when} className="flex flex-col gap-1">
              <Text size={12} weight="medium">{c.when}</Text>
              <SegmentedBar separated legend="inline" total={c.cc + c.hc + c.dec + c.hw + c.cw}
                segments={["cc", "hc", "dec", "hw", "cw"].map((k) => ({ label: calibCfg[k].label, value: c[k], color: calibCfg[k].color, valueLabel: c[k] + "%" }))} />
            </div>
          ))}
        </Panel>
        <P>
          Those are training questions. The report also measures held-out questions and an external benchmark. In the table, hallucination share is wrong answers divided by all non-correct answers: of the questions the
          model did not get right, the fraction where it gave a wrong answer when it could have declined.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Question set</TableHead><TableHead>Measure</TableHead><TableHead>Start to late in RL</TableHead></TableRow></TableHeader>
          <TableBody>
            {calibHeldOut.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{i % 2 === 0 ? r.set : ""}</TableCell>
                <TableCell className="font-medium">{r.m}</TableCell>
                <TableCell><Shift a={r.a} b={r.b} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Small>From figure 26. The last pair groups 117 held-out questions by how often the pre-RL checkpoint answered them correctly in 16 samples.</Small>
        <P>
          The pattern is the same in all three sets: wrong answers fall sharply and correct answers move little. On the external
          AA-Omniscience set accuracy is flat, 31% to 32%, while the hallucination share drops from 53% to 33%. The report's summary
          is that calibration RL teaches no new facts and leads to fewer wrong answers, not more right ones.
        </P>
        <P>
          There is a cost on the in-house sets. Held-out accuracy falls from 42% to 36%, and accuracy on questions the model knew
          before RL falls from 80% to 73%; the report describes the latter as approximately stable. It frames the whole result as
          movement along a frontier: too little abstention produces confident errors, too much produces a safe but unhelpful model.
        </P>
        <Surprise title="Thinking longer made the model commit to more wrong answers, and calibration RL mostly fixed it">
          One would expect more reasoning to make a model more careful. Reasoning effort is the setting that tells the model how
          much to think before it answers. Before RL, 41% of the test questions the model abstained on at low effort became wrong
          answers at high effort: extra thinking talked it into an answer. After calibration RL
          that share was 12%.
        </Surprise>
        <P>
          The reward itself had to be changed once. An earlier version had five levels: confident correct, hedged correct, abstain,
          hedged incorrect, incorrect. The judge had to infer confidence from wording, and the policy learned to exploit that. The
          final version has three levels, and the judge prompt penalizes multiple answers and empty answers and scores a hedged
          commitment as an abstention. The report adds a second reason for that last choice: other environments need the model to
          offer a hedged answer, so hedging should not be taught as an error.
        </P>

        <H3>Instruction following and long context</H3>
        <Findings items={[
          "Over the course of RL, the instruction-following environments together produced a gain of 24.7% on the held-out IFBench evaluation. The report does not say whether this is a relative change or percentage points.",
          "For prompts with many rubrics, the all-or-nothing reward gave better full-task success than averaging rubric scores and better than partial credit combined with an all-or-nothing term.",
          "After RL that included the two faithfulness environments, Beam scored 67% on LongBench-v2, a long-context benchmark, against a human-expert reference of 50.1%. It exceeded every reported or reproduced model of comparable or smaller size, and two larger ones, Qwen3.8 Max and Inkling.",
        ]} />

        <H3>Helpfulness: three recipe revisions</H3>
        <P>
          The helpfulness recipe went through three revisions, and the report's figure 29 tracks held-out arena Elo for each. The
          failures of the first two are the main lesson.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Recipe</TableHead><TableHead>What changed</TableHead><TableHead>Held-out arena Elo during RL</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">Revision 1</TableCell><TableCell>First RLAIF recipe</TableCell><TableCell>Peaked early, then collapsed as the policy exploited its reward model</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Revision 2</TableCell><TableCell>Stronger judges and anchor responses</TableCell><TableCell>Plateaued early</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Revision 3 (final)</TableCell><TableCell>Reward hacks fixed</TableCell><TableCell>Rose throughout training and finished above all earlier runs</TableCell></TableRow>
          </TableBody>
        </Table>
        <Findings items={[
          "The resulting Beam model reaches an arena Elo of about 1,044 (GLM 5.2 = 1,000), on the Pareto frontier of Elo against total parameter count among open-weight models.",
          "The arena is an automated judge, so it was checked against people: it predicted a 56.5% win rate for Beam over GLM 5.2, and human raters measured 56.3%.",
          "Two other reward shapes were tried and rejected. Pointwise scores, where the reward model rates one answer on its own, squeezed each group into about a quarter of the reward range. Preference logits saturated, giving near-maximal reward for marginal or no differences in quality.",
          "A factor analysis of the per-attribute human ratings found one dominant quality factor that correlated r = 0.95 with overall preference. That is what a Bradley-Terry fit assumes, so a single Elo number is a fair summary.",
          "Successive SFT iterations, including a self-distillation cold start, raised the step-0 arena Elo by about 100 points, roughly from a 24% to a 37% implied win rate against the Elo anchor model.",
        ]} />
        <Surprise title="Same starting score, much faster learning">
          Rewriting the SFT reasoning traces for multi-turn chat to be more concise and less templated did not change the step-0
          Elo. A checkpoint that scores the same would be expected to train the same. Under an identical RL recipe the rewritten
          checkpoint improved its arena score much faster. The report says the SFT checkpoint sets both where RL starts and how fast
          it moves, and gives no further explanation.
        </Surprise>
        <Surprise title="Training on tool-use tasks leaked clarifying questions into ordinary chat">
          Some of the user-collaboration tasks require the agent to ask a simulated user for missing details. After training on
          them the model began asking unnecessary follow-ups and clarifications in other conversational tasks, a behavior learned
          in one environment appearing in another. The two penalty factors on the helpfulness reward (unnecessary content, withheld
          content) were added in response and reduced it.
        </Surprise>
        <Surprise title="What people reward moved as the model improved">
          The target of this training is not fixed. When annotators compared early, weaker checkpoints, coverage carried the largest
          weight in their preference. For later, stronger checkpoints its weight diminished in favor of focus. A grader calibrated
          once would keep paying for coverage after people had stopped caring most about it, which is why both graders are
          recalibrated on each new batch of labels.
        </Surprise>

        <H3>Safety: a see-saw across training stages</H3>
        <P>
          Safety is measured on two rates that pull in opposite directions: how often the model refuses or pivots on harmful
          requests, and how often it complies with harmless ones. The chart shows how each rate moved during RL and then
          during <Term def="Multi-teacher on-policy distillation: the step in which a single student model learns from both the agentic and the alignment teacher.">MOPD</Term>,
          the distillation step that merges the two teachers (<LessonLink to="mopd" />).
        </P>
        <Panel title="Relative change in two safety rates, by training stage (%)"
          caption="Conversational Iris Safety Evaluations, release recipe. The RL changes are relative to the SFT model. The report says the same direction of movement appeared consistently across training iterations. It gives relative changes only, not the underlying rates per stage.">
          <ChartContainer config={{ refuse: { label: "Refusal of harmful requests", color: chartColors[0] }, comply: { label: "Compliance with harmless requests", color: chartColors[1] } }} style={{ height: 230, width: "100%" }}>
            <BarChart data={seesaw} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
              <ChartGrid /><ChartXAxis dataKey="stage" /><ChartYAxis title="relative change (%)" domain={[-12, 12]} ticks={[-12, -6, 0, 6, 12]} />
              <Recharts.ReferenceLine y={0} stroke="rgb(var(--text-secondary))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <ChartBar dataKey="refuse" isAnimationActive={false} label={{ position: "top", fontSize: 11, fill: "rgb(var(--text-secondary))", formatter: (v) => (v > 0 ? "+" : "") + v }} />
              <ChartBar dataKey="comply" isAnimationActive={false} label={{ position: "top", fontSize: 11, fill: "rgb(var(--text-secondary))", formatter: (v) => (v > 0 ? "+" : "") + v }} />
            </BarChart>
          </ChartContainer>
        </Panel>
        <Surprise title="RL made the model stricter, and distillation undid part of it">
          The safety reward scores over-refusal and harmful compliance symmetrically and includes harmless tasks, so one might expect
          both rates to improve together. During RL harmful-request refusal rose 8.3% while harmless compliance fell 10.5%. During
          MOPD the movement reversed: refusal fell 4.4% and harmless compliance rose 9.9%.
        </Surprise>
        <Surprise title="A larger teacher, with the same data, nearly halved over-refusal">
          Over-refusal looks like a data problem, to be fixed with more harmless examples. In early iterations, growing the
          alignment teacher from 100B to 501B parameters with the training data and recipe held fixed cut the over-refusal rate on a
          preliminary version of the safety evaluation by 48.7% relative. The harmful-request pass rate fell by 3.1%, so capacity
          improved responses to permissible requests at a small cost in refusals.
        </Surprise>
        <Src>section 4.2 (table 9, figures 25 to 29) and section 7.2.3 (table 27, figure 49)</Src>
      </Stage>
    </div>
  );
}
