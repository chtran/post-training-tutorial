const meta = {
  id: "sft",
  nav: "SFT",
  title: "Supervised fine-tuning: the short stage everything else stands on",
  question: "Why does every branch of the pipeline begin by imitating demonstrations, and where do those demonstrations come from?",
  minutes: 14,
  takeaways: [
    "SFT runs three times, each from the same midtrained checkpoint: once for the agentic expert, once for the alignment expert, once for the merged student. Each run is short and exists to set up the stage after it.",
    "RL can only reinforce behavior that already shows up in some rollouts, so SFT's job is to make sure the formats parse and that every behavior RL will reward (abstaining, refusing, keeping the Beam identity) occurs at least sometimes.",
    "Most demonstrations are the model's own earlier rollouts, kept only if they earned full reward and passed structural checks and judges. The report specifies the filters in detail and says nothing about the loss or hyperparameters.",
    "Safety traces are written by a model that can see the safety policy, rewritten so the reasoning does not cite it, and trained on with the policy removed. In multi-turn traces only the last turn is trained on.",
    "Choices in SFT data showed up later, not at the SFT checkpoint: rewriting chat reasoning traces left the starting Elo unchanged but made RL improve much faster, and SFT on both experts' data did not merge them without MOPD.",
  ],
};

// ---------- data printed in the report ----------
// Table 8: SFT data mixture of the alignment teacher (percent).
const table8 = [
  { d: "Shared with the agentic teacher", note: "SWE, STEM, terminal use", tr: 57.96, tk: 56.18 },
  { d: "User-agent collaboration and tool use", note: "multi-turn tasks with a simulated user", tr: 17.33, tk: 9.99 },
  { d: "Multi-turn user-assistant interactions", note: "open-ended chat", tr: 15.1, tk: 24.53 },
  { d: "Long-context question answering", note: "16K to 200K token inputs", tr: 3.78, tk: 8.56 },
  { d: "Multi-turn instruction following", note: "instructions that change mid-conversation", tr: 2.83, tk: 0.51 },
  { d: "Safety", note: "direct requests, jailbreaks, over-refusal", tr: 1.62, tk: 0.18 },
  { d: "Knowledge calibration", note: "answer or abstain", tr: 0.91, tk: 0.03 },
  { d: "Model identity", note: "the Beam persona", tr: 0.48, tk: 0.01 },
];
const stages = [
  { who: "Agentic expert", data: "Rollouts of an earlier model version on a subset of the final RL task pool, covering every training domain, filtered for correctness and quality. Plus a subset of the general tool-use traces.", job: "Chat formatting, tool-call syntax and reasoning behavior, so RL rollouts are usable from the first step." },
  { who: "Alignment expert", data: "The eight datasets of table 8: about 58% of traces are shared with the agentic expert; the rest are chat, tool-use collaboration, long-context and small targeted sets.", job: "A broad prior for conversation, and a first appearance of every behavior that alignment RL will reward." },
  { who: "Merged student", data: "The SFT data of both experts, plus traces sampled from the two finished experts.", job: "Begin the merge already close to both teachers." },
];
const builds = [
  { b: "Open-ended chat", how: "Conversations start from heavily filtered WildChat prompts (real user queries up to August 2025) and are extended to between 1 and 32 turns by a user simulator. At most three identical prompts are kept per cluster of near-duplicate templates. A conversation is cut at the first assistant reply that repeats verbatim, or at the first follow-up a judge finds unnecessary.", drop: "Traces that leak system or developer instructions without cause, contain non-English text, or guess at time-sensitive facts or pretend to have tools." },
  { b: "Long-context reasoning", how: "Tasks with inputs of 16K to 200K tokens, from open-source long-context datasets and vendor-written tasks with human rubrics. N completions per prompt are sampled from an open-weights model and graded by exact match or accuracy where an answer is checkable, by a rubric judge otherwise.", drop: "Everything except the single best-scoring completion per task, and that one too if it misses a score threshold." },
  { b: "Multi-turn instruction following", how: "Generated conversations in which a simulated user introduces, activates or revises an instruction. Each SFT trace is a stored history plus a successful final response.", drop: "Conversations that fail checks for correctness, satisfiability, and consistency between the instruction and what the user is asking for. The SFT and RL sets are disjoint: no conversation is in both." },
  { b: "User-agent collaboration", how: "General tool-use data: open-source SFT sets, with reasoning backfilled where it was missing, and rollouts on Beam's own tool-use RL tasks.", drop: "Anything failing the trace filters described above." },
  { b: "Model identity", how: "Handwritten and synthetically generated traces. Half use Beam's default system prompt and half a generic one (\"You are a helpful assistant\").", drop: "The report describes no filter for this set." },
];

// ---------- illustrative code (not from the report) ----------
const harvestCode = `# Illustrative sketch, not from the report. It follows the filters that
# section 4.1.11 lists for tool-use traces; function names are made up.
def keep(task, trace):
    # 1. Full reward. Scoring is all-or-nothing: no partial credit.
    if task.reward(trace) != 1:
        return False
    # 2. Structure: reasoning on every assistant turn, only known tools,
    #    schema-valid arguments, every call answered exactly once.
    if not structurally_valid(trace):
        return False
    # 3. Tool-use judge: follows the instruction, reported facts are grounded
    #    in tool output, reasoning is consistent with the action taken.
    if not tool_use_judge(trace):
        return False
    # 4. Conduct grader: no pasted raw tool output, no useless or repeated calls.
    if not conduct_grader(trace):
        return False
    # 5. The reward was earned by completing the task, not by a shortcut.
    if not earned_honestly(task, trace):
        return False
    # 6. Reasoning and replies are in the language of the user's message.
    if not same_language_as_user(trace):
        return False
    # 7. The whole trace fits in a 64K-token context.
    return num_tokens(trace) <= 64_000

def harvest(tasks, earlier_checkpoint):
    dataset = []
    for task in tasks:                        # a subset of the RL task pool
        rollouts = earlier_checkpoint.rollouts(task)
        kept = [t for t in rollouts if keep(task, t)]
        dataset += kept[:3]                   # at most three traces per task
    return dataset`;
const calibCode = `# Illustrative sketch of the selection rule in section 4.2.3; names are made up.
def calibration_demo(question, prior_checkpoint):
    # 16 samples per question, at six reasoning efforts
    outcomes = [judge(r) for r in prior_checkpoint.sample(question, n=16)]
    correct = outcomes.count("correct")
    abstain = outcomes.count("abstain")
    wrong   = outcomes.count("wrong")

    if correct == 0 and abstain > wrong:    # only abstentions and wrong answers
        return pick_one(outcomes, "abstain")    # -> an abstention demonstration
    if wrong == 0 and correct > abstain:    # only correct answers and abstentions
        return pick_one(outcomes, "correct")    # -> a correct-answer demonstration
    return None                             # mixed evidence: not used

# One trace per question, stratified across the six reasoning efforts.
# Final set: 66% abstentions, 33% correct answers.`;

// ---------- small local components ----------
function Verdict({ ok, children }) {
  return (
    <span className={"inline-flex items-center gap-1 text-[13px] font-medium " + (ok ? "text-green" : "text-red")}>
      {ok ? <IconCheckmark2Medium size={14} /> : <IconCrossMedium size={14} />}{children}
    </span>
  );
}

// Demo 1: which rollouts survive the trace filters. All six rollouts are invented.
const CHECKS = [
  { id: "reward", label: "Full reward", what: "The verifier or rubric gave 1. There is no partial credit." },
  { id: "struct", label: "Structurally valid", what: "Reasoning on every assistant turn, known tools only, schema-valid arguments, each call answered once." },
  { id: "judge", label: "Tool-use judge", what: "Follows the instruction, reports only facts found in tool output, reasoning consistent with the action." },
  { id: "conduct", label: "Conduct grader", what: "No pasted raw tool output, no useless or repeated calls." },
  { id: "honest", label: "Reward earned honestly", what: "The task was really completed, not passed by a shortcut." },
  { id: "lang", label: "Same language as the user", what: "Reasoning and replies match the language of the user's message." },
  { id: "ctx", label: "Fits in 64K tokens", what: "Whole trace within a 64K context." },
];
const ROLLOUTS = [
  { id: "clean", name: "Clean solve", fails: [],
    lines: ["reasoning: need the Q3 invoice total; query the ledger first", "call  ledger.query(quarter=\"Q3\")  ->  41 rows", "answer: reports the total computed from those rows"] },
  { id: "shortcut", name: "Edited the check", fails: ["honest"],
    lines: ["reasoning: the validation script compares against a fixed file", "call  fs.write(\"expected.json\", ...)  ->  ok", "answer: \"all checks pass\"  (reward 1)"] },
  { id: "invented", name: "Invented a figure", fails: ["judge"],
    lines: ["reasoning: look up the customer's renewal date", "call  crm.get_account(id=7)  ->  no renewal field returned", "answer: \"your renewal date is 14 March\"  (verifier did not check the date)"] },
  { id: "badcall", name: "Unknown tool", fails: ["struct"],
    lines: ["reasoning: send the summary by email", "call  mail.send_fast(...)  ->  tool not in the task's tool set", "call  mail.send(...)  ->  ok, task completed"] },
  { id: "noisy", name: "Repeated calls", fails: ["conduct"],
    lines: ["call  search.docs(\"refund policy\")  ->  3 hits", "call  search.docs(\"refund policy\")  ->  3 hits  (same call again)", "answer: pastes the raw JSON of the hits, then the right answer"] },
  { id: "failed", name: "Wrong result", fails: ["reward"],
    lines: ["reasoning: careful and well grounded throughout", "call  db.update(order=112, status=\"shipped\")  ->  ok", "answer: updated the wrong order  (reward 0)"] },
];
function FilterDemo() {
  const [sel, setSel] = useState("shortcut");
  const r = ROLLOUTS.find((x) => x.id === sel);
  const kept = r.fails.length === 0;
  return (
    <Demo title="Which rollouts are allowed to become demonstrations?"
      takeaway="Only the first rollout is kept. Four of the other five earned full reward and would pass a filter that checks reward alone: the judges exist because a rewarded rollout can still demonstrate a habit you do not want copied. The six rollouts are invented for this demo; the checks are the report's.">
      <SegmentedControl value={sel} onValueChange={(v) => v && setSel(v)} size="small" className="flex-wrap">
        {ROLLOUTS.map((x) => <SegmentedControlItem key={x.id} value={x.id}>{x.name}</SegmentedControlItem>)}
      </SegmentedControl>
      <div className="rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-6 text-primary">
        {r.lines.map((l, i) => <div key={i} className="break-words">{l}</div>)}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {CHECKS.map((c) => {
          const ok = !r.fails.includes(c.id);
          return (
            <div key={c.id} className="flex flex-col">
              <Verdict ok={ok}>{c.label}</Verdict>
              <span className="text-[12.5px] leading-5 text-secondary">{c.what}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={kept ? "success" : "destructive"}>{kept ? "Kept for SFT" : "Rejected"}</Badge>
        <span className="text-[13px] text-secondary">{kept ? "Passes every check; up to three such traces per task are used." : "One failed check is enough to drop the trace."}</span>
      </div>
    </Demo>
  );
}

// Demo 2: the calibration selection rule, applied literally.
function SeedDemo() {
  const [c, setC] = useState(0);
  const [a, setA] = useState(11);
  const corr = c, abst = Math.min(a, 16 - corr), wrong = 16 - corr - abst;
  let kind = "none", verdict = "Not used", why = "";
  if (corr === 0 && abst > wrong) { kind = "abstain"; verdict = "Abstention demonstration"; why = "The model never got this right and usually said so. One of its abstaining rollouts becomes the demonstration."; }
  else if (wrong === 0 && corr > abst) { kind = "correct"; verdict = "Correct-answer demonstration"; why = "The model never got this wrong and usually answered. One of its correct rollouts becomes the demonstration."; }
  else if (corr > 0 && wrong > 0) why = "Correct and wrong answers both appear, so the question sits on the edge of what the model knows. It is a clean example of neither side.";
  else if (corr === 0) why = "The model does not know this, but it guessed at least as often as it abstained. Abstentions are not in the majority.";
  else why = "The model knows this, but abstained at least as often as it answered. Correct answers are not in the majority.";
  return (
    <Demo title="Which questions become calibration demonstrations?"
      takeaway="Drag correct answers above zero while wrong answers remain and the question is dropped: it is kept only when the 16 rollouts agree about which side of the knowledge boundary it is on. The counts are yours to set; the rule is the report's, applied literally. The report does not say how ties or unanimous questions are handled.">
      <Slider label="Correct answers (of 16)" value={corr} min={0} max={16} step={1} onChange={(v) => { setC(v); if (a > 16 - v) setA(16 - v); }} />
      <Slider label="Abstentions (of 16)" value={abst} min={0} max={16} step={1} onChange={(v) => setA(Math.min(v, 16 - corr))} />
      <SegmentedBar separated legend="inline" total={16} segments={[
        { label: "Correct", value: corr, color: "rgb(var(--text-green))" },
        { label: "Abstained", value: abst, color: chartColors[0] },
        { label: "Wrong", value: wrong, color: "rgb(var(--text-red))" },
      ]} />
      <div className="flex flex-col gap-1 rounded-lg bg-wash px-4 py-3">
        <div><Badge variant={kind === "none" ? "default" : "success"}>{verdict}</Badge></div>
        <span className="text-[13.5px] leading-6 text-primary">{why}</span>
      </div>
    </Demo>
  );
}

// Figure: which tokens of a multi-turn safety trace carry loss.
const TURNS = [
  { role: "system", text: "Safety policy removed before training", train: false },
  { role: "user", text: "Earlier request", train: false },
  { role: "assistant", text: "Earlier reply, possibly violating (for example, a prefilled start)", train: false },
  { role: "user", text: "Harmful follow-up", train: false },
  { role: "assistant", text: "Rewritten reasoning and a safe final answer", train: true },
];
function MaskFigure() {
  return (
    <div className="flex flex-col gap-2">
      {TURNS.map((t, i) => (
        <div key={i} className={"flex items-center gap-3 rounded-lg px-3 py-2 " + (t.train ? "bg-tint-green" : "bg-wash")}>
          <span className="w-[72px] shrink-0 font-mono text-[12px] text-secondary">{t.role}</span>
          <span className="grow text-[13.5px] leading-5 text-primary">{t.text}</span>
          <span className={"shrink-0 text-right text-[12px] font-medium " + (t.train ? "text-green" : "text-secondary")}>{t.train ? "trained on" : "context only"}</span>
        </div>
      ))}
    </div>
  );
}

// Table 8 with inline bars. Bars are scaled to the largest share.
function ShareCell({ v, color }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-[6px] w-[64px] overflow-hidden rounded-full bg-wash sm:block">
        <div className="h-full rounded-full" style={{ width: Math.max(1.5, (v / 58) * 100) + "%", background: color }} />
      </div>
      <span className="w-[52px] text-right font-mono text-[13px]">{v.toFixed(2)}%</span>
    </div>
  );
}
function MixtureTable() {
  return (
    <Table wrapText rowLines>
      <TableHeader><TableRow>
        <TableHead>Dataset</TableHead>
        <TableHead className="text-right">Share of traces</TableHead>
        <TableHead className="text-right">Share of tokens</TableHead>
        <TableHead className="text-right">Relative length</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {table8.map((r) => (
          <TableRow key={r.d}>
            <TableCell><div className="font-medium">{r.d}</div><div className="text-[12.5px] leading-5 text-secondary">{r.note}</div></TableCell>
            <TableCell><ShareCell v={r.tr} color={chartColors[0]} /></TableCell>
            <TableCell><ShareCell v={r.tk} color={chartColors[1]} /></TableCell>
            <TableCell className="text-right font-mono text-[13px]">{(r.tk / r.tr).toFixed(2)}×</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const LOOP = [
  { t: "Earlier checkpoint", s: "an older version of the model" },
  { t: "Rollouts", s: "attempts at real training tasks" },
  { t: "Filters", s: "full reward, structural checks, judges" },
  { t: "SFT", s: "the midtrained checkpoint imitates what is left" },
  { t: "RL", s: "starts from the SFT checkpoint" },
];
function LoopFigure() {
  return (
    <div className="flex flex-col items-stretch gap-1 sm:flex-row">
      {LOOP.map((n, i) => (
        <React.Fragment key={n.t}>
          {i > 0 ? <span className="flex shrink-0 rotate-90 items-center justify-center text-secondary sm:rotate-0"><IconChevronRight size={14} /></span> : null}
          <div className={"flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-3 py-2 " + (i === 2 ? "bg-tint-blue" : "bg-wash")}>
            <span className="text-[13px] font-semibold leading-5 text-primary">{n.t}</span>
            <span className="text-[12px] leading-4 text-secondary">{n.s}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="Show the model what good looks like, then let RL improve on it">
        <Lead>
          Supervised fine-tuning (SFT) trains a model to reproduce finished examples, one token at a time. In Beam's pipeline it
          is the shortest training stage, and the report spends far more words on how the examples were chosen than on the
          training itself. This lesson explains why the stage is there and what goes into it.
        </Lead>
        <P>
          The stage that follows SFT is reinforcement learning (RL). In RL the model attempts a task several times, each
          attempt (a <Term def="One complete attempt at a task: the prompt, the model's reasoning, its tool calls, the tool results and its final answer. The report also says trajectory or trace.">rollout</Term>)
          is scored, and the model is pushed toward what its better-scoring attempts did. That works only if the attempts
          can be scored and if some of them are better than others. SFT is there to make both true, and it does three jobs.
        </P>
        <Steps items={[
          { title: "Teach the formats", body: "A rollout whose tool call does not parse, or that has no separate reasoning section, cannot be run or scored. The model has to produce valid chat structure, tool-call syntax and reasoning before RL starts." },
          { title: "Seed the behaviors RL will reward", body: "RL can raise the rate of a behavior but cannot invent one. If the model never says \"I don't know\", no rollout contains an abstention to reinforce. So each target behavior is demonstrated a few times first." },
          { title: "Give the merge a head start", body: <span>The final model is a student that learns from two finished experts (<LessonLink to="mopd" />). Fine-tuning the student on the experts' data first puts it close to them before that process begins.</span> },
        ]} />
        <H3>Where the demonstrations come from</H3>
        <P>
          Few of the demonstrations are written by people. Most are rollouts from an earlier version of the model itself, run on
          the same kind of tasks RL will use, with everything but the best attempts thrown away. The report calls
          this <b>self-distillation</b>: the model learns from a cleaned-up record of its own past behavior.
        </P>
        <Panel caption="The loop that produces most SFT data. Nothing in it needs a human-written answer: the task's reward says whether an attempt succeeded, and the filters (highlighted) decide whether a successful attempt is good enough to imitate.">
          <LoopFigure />
        </Panel>
        <P>
          Imitation copies everything in an example, including its bad habits. A rollout can reach the right answer while
          inventing a fact, calling a tool twice for no reason, or passing a check by a shortcut, and a model trained on it
          learns those too. This is why the filters carry the weight of the stage.
        </P>
        <KeyIdea>
          SFT does not need to make the model good. It needs to make the model's attempts well-formed and varied enough that RL
          has something to select from, without teaching habits RL would then have to undo.
        </KeyIdea>
        <H3>The three SFT runs</H3>
        <P>
          SFT runs three times, each time starting from the
          same <Term def="The model after pretraining and midtraining (the report's section 3), before any post-training.">midtrained checkpoint</Term>.
          Safety is sometimes described as a stage of its own, but its SFT data is one slice of the alignment expert's run,
          built by a recipe covered in part 2.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>SFT run</TableHead><TableHead>Demonstrations</TableHead><TableHead>What it sets up</TableHead></TableRow></TableHeader>
          <TableBody>
            {stages.map((r) => <TableRow key={r.who}><TableCell className="font-medium">{r.who}</TableCell><TableCell>{r.data}</TableCell><TableCell>{r.job}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <Src>sections 4 (opening), 4.1.1, 4.1.11, 4.2.2 and 4.3.3</Src>
      </Stage>

      <Stage step={2} title="One ordinary loss, and a lot of care about what it is applied to">
        <H3>The objective</H3>
        <P>
          The report does not print its SFT loss, learning rate, number of steps or dataset sizes. The equation below is the
          standard form of supervised fine-tuning, given here so the rest of the section has something to refer to. The only
          part the report pins down is which tokens count, in one case: safety traces, covered below.
        </P>
        <Eq label="Next-token cross-entropy (standard form, not printed in the report)">
          <V>L</V>(θ) = − Σ<sub><V>y</V> ∈ <V>D</V></sub> Σ<sub><V>t</V></sub> <V>m</V><sub>t</sub> · log π<sub>θ</sub>(<V>y</V><sub>t</sub> | <V>y</V><sub>&lt;t</sub>)
        </Eq>
        <Where items={[
          ["D", "the set of kept demonstration traces"],
          [<span>y<sub>t</sub></span>, <span>token <V>t</V> of trace <V>y</V>; <V>y</V><sub>&lt;t</sub> is everything before it, including the prompt and tool results</span>],
          [<span>π<sub>θ</sub></span>, <span>the model with weights θ, read as a probability distribution over the next token (in RL the same object is called the policy)</span>],
          [<span>m<sub>t</sub></span>, "1 if the token is trained on, 0 if it is only context. For multi-turn safety traces it is 1 only inside the last assistant turn."],
        ]} />
        <P>
          Since the loss is fixed, everything that distinguishes one SFT run from another is in <V>D</V>. The rest of this part
          is about how <V>D</V> is built.
        </P>

        <H3>Harvesting traces from rollouts</H3>
        <P>
          For the agentic expert the report says only that trajectories come from an earlier model version, on a subset of the
          final task pool across all training domains, and are filtered for correctness and quality. The filters are spelled
          out for one domain, general tool use, and the sketch below follows that description. Read <Code>keep</Code> as a list of conditions: a rollout must
          meet all seven.
        </P>
        <CodeBlock code={harvestCode} />
        <P>
          Two details are easy to miss. First, checks 3 to 5 are graders, the first of them explicitly
          a <Term def="A language model prompted to grade another model's output against written criteria. Used where a rule-based check cannot decide.">judge</Term>, and they
          apply to rollouts that already have full reward. Reward is treated as necessary but not sufficient. Second,
          the cap of three traces per task stops easy tasks, which produce many passing rollouts, from dominating the data.
        </P>
        <P>
          The open-source tool-use sets get the same treatment. Some of their traces had no reasoning, so reasoning was written
          in afterwards (backfilled) and then graded to confirm it actually leads to the action that follows. Try the filters on
          a few rollouts:
        </P>
        <FilterDemo />

        <H3>The alignment expert's datasets</H3>
        <P>
          The alignment expert has to converse, follow instructions and handle long documents, which the agentic data does not
          cover. Each of its extra datasets is built differently. The table gives the construction and what is thrown away; the
          two sets with the most unusual recipes, knowledge calibration and safety, get their own sections after it.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead className="w-[150px]">Dataset</TableHead><TableHead>How the traces are made, and what is removed</TableHead></TableRow></TableHeader>
          <TableBody>
            {builds.map((r) => (
              <TableRow key={r.b}>
                <TableCell className="font-medium">{r.b}</TableCell>
                <TableCell><div>{r.how}</div><div className="pt-1 text-secondary"><span className="font-medium text-primary">Removed: </span>{r.drop}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <P>
          One removal in the chat row deserves a second look. Some prompts need live data or a tool the model does not have.
          Traces where the model guessed an answer instead of saying it could not know were deleted, because imitating them
          would teach the model to hallucinate.
        </P>

        <H3>Seeding abstention from the model's own knowledge boundary</H3>
        <P>
          Knowledge calibration means answering a factual question when you know the answer and abstaining when you do not.
          The starting model rarely abstains, so abstention has to be demonstrated before RL can reinforce it. The difficulty
          is that a demonstration is only right for a model that shares its knowledge: "I don't know" is a good answer to a
          question this model cannot answer and a bad one to a question it can.
        </P>
        <P>
          The demonstrations therefore come from the model's own rollouts. A prior Beam checkpoint, one that had already been
          trained on calibration tasks during RL, was sampled 16 times per question at six
          {" "}<Term def="A setting that controls how much the model reasons before answering. Lesson 2 covers how it is trained.">reasoning efforts</Term>.
          (The report does not say whether that is 16 in total or 16 per effort.) A question is used only if those samples
          agree about which side of the boundary it is on.
        </P>
        <SeedDemo />
        <P>
          In code, the rule is two conditions. One trace is kept per question, sampled evenly across the six reasoning efforts,
          and the final set is 66% abstentions and 33% correct answers. What RL then does with the behavior is
          in <LessonLink to="align" />.
        </P>
        <CodeBlock code={calibCode} />

        <H3>Safety: reason with the policy, train without it</H3>
        <P>
          Safety demonstrations have to show the model refusing harmful requests, declining
          {" "}<Term def="A prompt written to trick a model into complying with a request it should refuse, for example by wrapping it in role-play.">jailbreaks</Term>,
          and still helping with requests that only look harmful. The simple way to get such traces is to put the safety policy
          in the system prompt and let a model follow it. But a model trained on those traces learns to look up a policy that
          will not be there in deployment. The report follows a method called Deliberative Alignment to avoid this.
        </P>
        <Steps items={[
          { title: "Generate with the policy visible", body: "A model receives the safety policy in its system prompt together with a request, and samples several candidate traces, each a reasoning passage plus an answer." },
          { title: "Judge", body: "A judge model discards candidates that comply with a harmful request or refuse a benign one." },
          { title: "Rewrite the reasoning", body: "A separate model rewrites the surviving traces so the reasoning reads as general deliberation over safety principles, not as a recitation of a document it was handed." },
          { title: "Train with the policy removed", body: "The policy is deleted from the system prompt. The model sees a request and reasoning that reaches the right decision unaided, so it has to carry the principles in its weights." },
        ]} />
        <P>
          The same recipe is used for multi-turn conversations, with one change: only the last turn is rewritten and trained on.
          Earlier turns are context. That makes it possible to include conversations in which an earlier assistant turn already
          contains violating content, as happens in
          a <Term def="An attack in which the attacker writes the beginning of the assistant's reply, so the model continues from text it never chose to produce.">prefill attack</Term>,
          and to teach the model to stop there instead of continuing.
        </P>
        <Panel title="A multi-turn safety trace: what is context and what is trained on"
          caption="Only the final assistant turn carries loss. The violating earlier turn is shown to the model but never imitated, so the trace teaches recovery. The turn texts are placeholders.">
          <MaskFigure />
        </Panel>
        <P>
          The set was also built in rounds. In each round a model was trained, prompts were generated that made it either
          comply with something harmful or refuse something benign, and the attacks that worked were added to the data for the
          next round. The final set covers every harm area in Reflection's policy.
        </P>

        <H3>Initializing the merged student</H3>
        <P>
          The third SFT run prepares the student that will be distilled from both experts. It fine-tunes the midtrained
          checkpoint on the combined SFT data of the two experts, then adds traces sampled from the finished experts
          themselves. The report says this puts the student's behavior close to the teachers' distributions from the start of
          the merge. The report gives no proportions for this mixture.
        </P>
        <Src>sections 4.1.1, 4.1.11, 4.2.2, 4.2.3, 4.3.3 and 7.2.2</Src>
      </Stage>

      <Stage step={3} title="What the mixture looked like and what SFT did and did not settle">
        <H3>The alignment expert's mixture</H3>
        <P>
          Table 8 of the report gives each dataset's share of the alignment expert's SFT data, counted two ways: by number of
          traces and by number of tokens. Compare the two columns. A dataset whose token share is larger than its trace share
          has long traces; the last column is the ratio of the two, computed here, not printed in the report.
        </P>
        <Panel title="Alignment expert SFT mixture (table 8)"
          caption="More than half of the data is shared with the agentic expert. Chat and long-context traces are long (1.6 and 2.3 times the average), while the three targeted sets at the bottom are very short: together they are 3.0% of traces but 0.22% of tokens.">
          <MixtureTable />
        </Panel>
        <P>
          The safety row is 1.6% of traces. Figure 48 of the report breaks that slice down by request type. The 15% of
          harmless requests are there so the model does not learn that refusing is always the safe choice.
        </P>
        <Panel title="Inside the safety slice (figure 48)" caption="Share of safety SFT datapoints by request type. Harmless requests are the harmful-looking but benign prompts that target over-refusal.">
          <SegmentedBar separated legend="inline" total={100} segments={[
            { label: "Harmful direct requests", value: 57, valueLabel: "57%", color: chartColors[0] },
            { label: "Harmful jailbreaks", value: 28, valueLabel: "28%", color: chartColors[1] },
            { label: "Harmless requests", value: 15, valueLabel: "15%", color: chartColors[2] },
          ]} />
        </Panel>

        <H3>What was measured</H3>
        <P>
          The report has no dedicated SFT evaluation section. Its findings about SFT are scattered through the sections on
          later stages, usually as the baseline that RL or the merge is compared against. Collected, they are:
        </P>
        <Findings items={[
          <span><b>Sharing data across experts helped twice.</b> Giving the alignment expert the agentic expert's SWE, STEM and terminal demonstrations (57.96% of its traces) built a stronger prior for its conversational training and made the later merge converge faster. The report gives no numbers for either effect.</span>,
          <span><b>Long-context traces held up.</b> They produced what the report calls significant gains on long-context benchmarks at the SFT checkpoint, without regressing short-context performance, and the gains carried through RL. No figures are printed.</span>,
          <span><b>Better SFT raised the starting line for chat quality.</b> Across successive SFT iterations, including what the report calls a self-distillation cold start, the alignment expert's score before any RL rose by about 100 <Term def="A rating computed from pairwise comparisons, as in chess. Here responses from different models are compared on Reflection's in-house arena; a higher rating means winning more comparisons.">Elo</Term> points on the in-house arena, or roughly 24% to 37% implied win rate against the anchor model.</span>,
          <span><b>Safety RL starts from what SFT already solved.</b> Tasks the SFT checkpoint already handles reliably are dropped from the safety RL mixture, so RL is spent on open cases (<LessonLink to="align" />).</span>,
          <span><b>Tool-use SFT and RL cover different ground.</b> The open-source SFT sets skew toward consumer tools (weather, web search, travel, e-commerce), while the RL tasks concentrate on enterprise ones (database operations, finance, CRM, productivity, legal).</span>,
          <span><b>SFT was numerically undemanding.</b> As in pretraining, the final vocabulary projection ran in 16-bit floats (BF16) with no instability. RL and distillation used 32-bit (FP32) there to keep the trainer and the sampler in agreement (<LessonLink to="rl" />).</span>,
        ]} />
        <Surprise title="Rewriting reasoning traces changed how fast RL learned, but not where it started">
          One would expect a change to SFT data to show up in the SFT checkpoint's own score, if it shows up at all. Rewriting
          the multi-turn chat reasoning traces to be more concise and less templated left the starting Elo unchanged. Yet under
          an identical RL recipe, the rewritten checkpoint's arena scores rose much faster. The report states the effect without
          a number and offers no explanation. Our reading, not the report's: a checkpoint's score before RL does not
          tell you how well it will train.
        </Surprise>
        <Surprise title="Imitating both experts was not enough to merge them">
          The report cites recent work on the strength of offline distillation, and the student's SFT data included traces
          from the finished experts, which is exactly that. Even so, SFT alone did not recover the performance of both experts.
          The expert traces were still worth having: the report calls them important for reaching teacher-level performance once
          on-policy distillation was added to close the gap (<LessonLink to="mopd" />).
        </Surprise>
        <P>
          One caveat on how much SFT decides. Other labs have reported that most safety-relevant behavior is already in place
          at the SFT checkpoint. Reflection found the checkpoint predictive but not final: how common a behavior is after SFT
          matters together with how the RL reward treats it, which <LessonLink to="align" /> works through.
        </P>
        <Src>sections 4.1.11, 4.2.2, 4.2.3, 4.3.3, 6.4.5, 7.2.2 and 7.2.3; table 8; figure 48</Src>
      </Stage>
    </div>
  );
}
