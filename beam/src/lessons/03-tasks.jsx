const meta = {
  id: "tasks",
  nav: "Tasks and rewards",
  title: "RL tasks and reward integrity",
  question: "What makes a task safe to train on, and how are hackable or noisy rewards kept out of a pool of nearly one million tasks?",
  minutes: 22,
  takeaways: [
    "RL reinforces whatever the verifier pays for, so the team fixed quality (zero reward noise, no hacks) and difficulty first, and only then scaled: several million candidate tasks were filtered down to nearly one million.",
    "Difficulty is measured against the model being trained. A task is useful only while a group of attempts contains both successes and failures, and it must not look easy or hard for the wrong reason, such as a leaked answer or a website the sandbox cannot reach.",
    "The domains repeat the same checks in their own form: the reference solution must score 1 and doing nothing must score 0, a judge must give the same answer every time, and an attacker that is told how to cheat must fail.",
    "Passing those checks before training is not enough. Judges re-read passing rollouts during training and zero out hacks, and tasks where a new hack appears are removed or repaired, so the pool keeps shrinking.",
    "Two filters matter more than they look. Guessable questions teach the model to guess inside its reasoning, and a weak model outscoring a strong one usually points to a wrong answer key, so both kinds of question are removed.",
  ],
};

// ---------- data ----------
const outcomes = [
  { did: "Solved the task", r1: { t: "Earned reward", d: "The signal RL is supposed to amplify.", c: "bg-tint-green", k: "text-green" }, r0: { t: "False negative: noise", d: "Correct work is graded wrong, for example 3.51 m/s against a gold answer of 3.5 m/s. Sound reasoning is punished at random.", c: "bg-tint-orange", k: "text-orange" } },
  { did: "Did not solve it", r1: { t: "False positive: a hack", d: "The verifier is fooled, for example by editing the test data. The model learns to fool it again.", c: "bg-tint-red", k: "text-red" }, r0: { t: "Earned zero", d: "A real failure. Useful as long as other attempts at the same task succeed.", c: "bg-wash", k: "text-secondary" } },
];

const overview = [
  { d: "Software engineering", job: "Change a real repository so that a requested behaviour works", by: "Hidden tests, run on the submitted patch in a separate environment" },
  { d: "Terminal use", job: "Finish a job with shell commands inside a container", by: "A custom shell or Python script that inspects the final state" },
  { d: "Math and science", job: "Answer a hard question with one short final answer", by: "SymPy comparison for math, a judge model for science" },
  { d: "Competitive coding", job: "Write a program that reads stdin and writes stdout", by: "Every test case must pass within the time limit" },
  { d: "Web search", job: "Answer a multi-hop question using a search tool and a browse tool", by: "Exact match, then a length limit, then a judge model" },
  { d: "Knowledge work", job: "Produce the reports, spreadsheets and slides of a profession", by: "A tool-using judge that scores a weighted rubric" },
  { d: "General tool use", job: "Complete a workflow by calling tools, often while talking to a user", by: "Rules, a rubric or a hash of the final environment state" },
];

const domainDetail = {
  swe: {
    label: "Software engineering",
    task: "A container image holding a problem statement, a runnable snapshot of the repository before the change, a reference implementation and a verifier. Tasks come from the team's own mining pipeline, from vendors and from seven open corpora, plus synthetic feature-removal tasks.",
    reward: "The submitted patch is extracted and applied in a separate verifier environment, where hidden tests run. The tests must have failed before the reference change (fail-to-pass) and must pass after it without breaking tests that already passed (pass-to-pass).",
    before: [
      "Judges read the statement, tests, reference fix and verifier command against separate criteria; repairable statements are rewritten, the rest are dropped.",
      "A stricter second review, with the reference fix withheld, asks three things: can every tested requirement be read off what the solver sees, do the tests enforce the request, can a trivial patch pass. Each gets three independent model calls and any valid negative rejects the task.",
      "An ambiguity judge and a verifier-strength judge (both agents) try to prove the task unfair or the tests weak, as described above under 'Testing a verifier in both directions'.",
      "The pool is balanced across languages and repositories, repeated variants of one change are limited, tasks a reference model solves reliably are removed, and anything matching a held-out evaluation is excluded.",
    ],
    during: [
      "Repository images are cleaned of post-change commit history and artifacts that would expose the reference solution.",
      "A judge reads the code of every passing submission next to the verifier; a successful hack gets zero reward.",
      "Groups of rollouts are scanned for submission failures, different grades on identical or near-identical patches, and suspicious passes. Task-health and reward-integrity judges then decide whether the task or the model is at fault.",
    ],
    note: "The report's atlas of 13,500 sampled tasks (12,000 mined, 1,500 synthesized) spans Python, TypeScript, Java, Go, JavaScript, Rust, C/C++, C#, Ruby and PHP. The report warns that these sample proportions are not the training mixture.",
  },
  term: {
    label: "Terminal use",
    task: "A task in Harbor format: instructions, a container built from a Dockerfile, an oracle script holding the reference solution, and a verifier. Tasks come from vendors and from the synthetic pipeline; open-source terminal tasks were examined and rejected.",
    reward: "The verifier is a custom shell or Python script that inspects files, validates computed values or measures runtime. It has to match the instructions, cover every stated requirement and resist tampering.",
    before: [
      "Six rule-based checks: Harbor compatibility, a well-layered Dockerfile, images that build, the oracle scoring 1.0 on five of five attempts, a no-op script scoring 0.0 on five of five attempts, and no privileged information leaking into the agent's sandbox.",
      "More than 15 checks by an agentic judge, for example that everything the instructions require is tested and nothing else is. Human annotators audit the judge, and the check definitions grow as new flaws are found.",
      "Live rollouts: a task that a strong model cannot solve in k attempts is discarded (the report does not give k). Successful rollouts are read by a judge for hacks and for environment problems such as missing tools.",
      "An adversarial agent, handed a full taxonomy of reward hacks, tries to score 1.0 with a wrong or incomplete solution. Every task it breaks is removed.",
    ],
    during: [
      "Synthetic tasks were filtered again after their behaviour in RL was observed.",
      "Humans and automated reviewers read real rollouts for verifier weaknesses, and the affected tasks are fixed or dropped.",
    ],
    note: "Each task is tagged against three taxonomies: subject matter (20 categories, 182 domains), task properties (14 properties, 244 subproperties) and instruction style (7 styles, 34 substyles), up to 460 tags per task. Tags and embedding similarity are used to remove templated near-duplicates.",
  },
  math: {
    label: "Math and science",
    task: "A question and a gold answer. More than one million were sourced from open corpora, vendors and synthetic pipelines, and many were then filtered out.",
    reward: "The model writes its final answer inside \\boxed{}. Math answers must be numeric or symbolic and are compared with SymPy. Science answers are compared with the gold answer by a judge model that also sees the question. An answer longer than 200 characters gets nothing (3 times the gold length for the few tasks with long gold answers).",
    before: [
      "Strong-versus-weak gap: drop questions where a strong model does worse than a weak one.",
      "Guessability: drop yes/no and multiple-choice questions, questions with only a few possible answers, very common answers such as 0, 1 or π, and anything answerable by reciting a definition.",
      "Broken questions: missing figures or context, contradictions, more than one reading.",
      "Broken answers: a model reviews the gold answer, re-derives it with tools, and several independent solvers must agree with it.",
      "Format and grading limits: no multi-part answers, no proofs, English only, gold answers SymPy can parse, and a judge that grades the same answer the same way.",
      "Easy filter: drop what the initial checkpoint often solves with a low thinking budget.",
    ],
    during: ["Section 4.1.7 describes no check specific to training time. The general rule applies: rollouts are analysed after every round and faulty tasks are removed."],
    note: "Science questions were rewritten to state the required precision, units and constants, so that correct reasoning always lands on the gold answer.",
  },
  code: {
    label: "Competitive coding",
    task: "A problem statement, a test suite of input files with expected outputs, and a comparison script. Problems come from open corpora and from licensed coding platforms.",
    reward: "The final program is run in an isolated grading sandbox with time limits. Reward is 1 only if every test passes. A compile error, a crash, one wrong output or one timeout gives 0.",
    before: [
      "A minimum number of test cases per problem.",
      "The comparison script must agree with the prompt on case, whitespace and numeric precision.",
      "The reference solution must pass in the team's own environment.",
      "No broken prompts, such as ones that rely on an image or promise partial scoring.",
      "Deduplication by MinHash on the statement, plus agents that look up the canonical problem ID where one exists.",
    ],
    during: ["Section 4.1.8 describes no check specific to training time."],
    note: "The language is picked at random when the task is served. Every task can be solved in C++; 70% can also be solved in Python, because a task is excluded from Python when a Python reference solution runs too slowly for limits tuned to C++. Some episodes also give the model a bash tool to test its code.",
  },
  search: {
    label: "Web search",
    task: "A question, a gold answer and two tools backed by a third-party search provider. Search returns URLs with titles and snippets of about 200 characters. Browse returns a page as Markdown capped at 8K tokens and accepts ripgrep arguments to search inside the full page.",
    reward: "A regular expression pulls out the text after \"The answer is:\". That excerpt goes through three stages: exact match, a length limit, and a judge model. The demo below walks through them.",
    before: [
      "Leakage: drop questions whose text reveals the answer.",
      "Memorization: drop questions a model answers with no search tools.",
      "Solvability: drop questions that need pages missing from the provider's index or blocked by a CAPTCHA.",
      "Wrong gold answers: drop questions where a model judges the gold answer invalid, prefers a common alternative answer, or finds the question contradictory or underspecified.",
      "Unreliable grading: drop any question on which the judge was inconsistent or subjective.",
      "Difficulty: keep a task only if a strong model's solve rate beats a weak model's by at least 12.5 percentage points, or the weak model's solve rate is zero.",
    ],
    during: ["The URLs the model visits are examined. A static blocklist covers known answer dumps (datasets, papers, blogs), and a dynamic blocklist fuzzy-matches pages that contain both the question and the answer."],
    note: "Topics include history, art, finance, sports, science and technology, media and law. Non-English questions were excluded.",
  },
  kw: {
    label: "Knowledge work",
    task: "A Harbor task directory shipped as a digest-pinned container image: instructions, source documents and the applications needed to do the job. Deliverables include .docx, .xlsx, .md, .csv, .pdf and .pptx files, often several per task.",
    reward: "The agent works in an untrusted sandbox. A tool-using judge in a separate trusted sandbox opens the files, checks calculations and sources, and scores each rubric criterion independently, including penalty criteria. The scores are aggregated and compared with a threshold: at or above it the reward is 1, otherwise 0. The report does not state the threshold.",
    before: [
      "Rubric checks for coverage, atomicity, observability, non-duplication and sensible weights.",
      "White-box attackers see the rubric and grading specification and look for credit without real work. Black-box attackers see only what the solver sees and look for ambiguity, missing information and shortcuts.",
      "A rubric judge and a goal judge grade the same frozen deliverables. The first asks whether the criteria are met, the second whether the professional objective was achieved. Disagreement flags the task.",
      "Solvability rollouts, then short RL derisking runs under the training reward setup. Failures feed back into the rubric and the grader.",
    ],
    during: [
      "An online integrity judge audits both the deliverable and the trajectory. Unsupported provenance, surface-level criterion gaming or attempts to manipulate the evaluator get zero reward.",
      "Offline audits look for new failure modes. Tasks with a credible exploit leave the training mixture until they are repaired and revalidated.",
    ],
    note: "The largest sectors in the final pool are finance and insurance, health care and social assistance, and professional, scientific and technical services.",
  },
  tool: {
    label: "General tool use",
    task: "A prompt, a set of tools, a set of artifacts, and one or more of a rubric, a rule-based verifier and an expected hash of the environment state. Tasks come from an open corpus and from vendors, mostly enterprise workflows such as finance, insurance, legal and revenue operations.",
    reward: "Programmatic rules, rubrics or both. The reward is 1 only when every scoring criterion passes; there is no partial credit.",
    before: [
      "Guessability and leakage: the expected answer must not be guessable from the prompt, the task must fail if the environment is left unchanged, and the simulated user must never reveal the answer.",
      "Broken rewards: drop tasks whose verifier demands something the instruction never stated. Where a golden solution exists, replaying it must score 1 and taking no action must score 0.",
      "Misleading tasks: a judge reads prompts, rubrics and example tool calls and flags unrequested requirements, insufficient tools, vague criteria and contradictory requests.",
    ],
    during: ["Section 4.1.11 describes no check specific to training time."],
    note: "These RL tasks train the alignment teacher, not the agentic one. During RL the tools are shown either with full schemas up front (passthrough) or behind three meta-tools that list, describe and call them, with equal probability.",
  },
};
const domainOrder = ["swe", "term", "math", "code", "search", "kw", "tool"];

const pipelines = [
  { n: "Feature removal", dom: "Software engineering",
    how: "An agent reads a working repository, picks a substantial feature and deletes its implementation and tests. Restoring the feature is the task, graded by hidden integration tests written to accept alternative implementations.",
    guard: "The remaining tests must still pass after the removal. The verifier must fail without the feature and pass with the reference restored. Images are scanned for surviving copies of the removed code, adversarial agents try to recover them, and three validation trials must agree." },
  { n: "Three-stage task builder", dom: "Terminal use",
    how: "A judge keeps web pages that could seed a terminal task (seeds can also be sampled from the taxonomies). A model turns each seed into a task description, steered by specificity and style knobs. A coding agent in a sandbox then builds the full Harbor task.",
    guard: "A quality gate of judge checks and static checks returns feedback to the agent. After 10 failed rounds the task is abandoned." },
  { n: "Same recipe, professional seeds", dom: "Knowledge work",
    how: "A real professional document is paired with a sampled occupation. An authoring agent builds everything in one episode: a manager-voice instruction, two to five reference documents, golden deliverables, the weighted rubric and the image.",
    guard: "Eight deterministic validators and nine judged criteria, with up to ten revision rounds. Then an independent vote by a different model family (covered in part 3)." },
  { n: "Science Q&A", dom: "Math and science",
    how: "Forum posts lack a reference answer and often ask for an explanation. A model rewrites each into self-contained questions with a short checkable answer, and extracts that answer from the replies.",
    guard: "A model rewrites the question until the reference is the only correct answer, or flags it unrepairable. The question is then solved several times, graded by the training judge, and diagnosed: wrong reference, ambiguous question, judge noise or genuine difficulty." },
  { n: "University math", dom: "Math and science",
    how: "From 38 course areas a model designs one graduate course each, with 8 to 12 modules, and lists the concepts of every module: several thousand in total. A planner spreads questions over five scopes, from one concept to combinations across courses, and a model writes one question per combination.",
    guard: "Each question must be single-part, self-contained and have a numeric or closed-form answer. The model must solve its own question, revise it if a one- or two-line shortcut exists, and use every stated premise." },
  { n: "Expert math, advanced physics", dom: "Math and science",
    how: "A generator combines concepts into problems while independent solvers attack them. The physics version builds problems from the calculations and assumptions of scientific papers.",
    guard: "Verification gates check that the reference answer is correct and that the reasoning is hard, using solver attempts and judge feedback. Physics problems are also checked against the source paper." },
  { n: "InfoSeek-style synthesis", dom: "Web search",
    how: "A planner agent and a browser agent start from one Wikipedia entity and build a question backwards, adding hops and constraints until the answer is unique. Changes from the original: articles truncated at 20K tokens instead of 1K, answer pages of more than 200 words, retries on validation failure.",
    guard: "All the web-search filters, plus one model checking the question against the claim tree built during synthesis and another checking that the answer is grounded in the source pages." },
];

const gateCode = `# Illustrative sketch, not code from the report.
# It collects the gates that recur across domains;
# each domain implements them differently.
def admit(task, strong, weak, init_ckpt, registry):
    # 1. The verifier separates a real solution
    #    from doing nothing, five times out of five.
    for _ in range(5):
        if verify(task, task.reference) != 1: return False
        if verify(task, NO_OP) != 0:          return False

    # 2. Not a copy of another training task (J >= 0.95)
    #    or of an evaluation sample (J >= 0.80).
    if near_duplicate(task, registry): return False

    # 3. The reward cannot be earned without solving.
    if attacker_passes_without_solving(task): return False

    # 4. The same answer always gets the same reward.
    if not judge_is_consistent(task): return False

    # 5. The answer key is probably right.
    if solve_rate(weak, task) > solve_rate(strong, task):
        return False

    # 6. Neither impossible nor trivial for this model.
    if solve_rate(strong, task) == 0: return False
    if solves_often(init_ckpt, task, thinking="low"):
        return False
    return True`;

const searchCode = `# The three stages are from section 4.1.9.
# normalize() and judge() are placeholders: the report
# prints neither the normalization nor the prompt.
def search_reward(final_message, gold):
    # text after "The answer is:"
    answer = extract(final_message)
    if answer is None:
        return 0      # nothing to grade
    # stage 1: exact match
    if normalize(answer) == normalize(gold):
        return 1
    # stage 2: too long, the judge never sees it
    if len(answer) > max(150, 4.5 * len(gold)):
        return 0
    # stage 3: is it equivalent to the gold answer?
    return judge(answer, gold)`;

// ---------- small pieces ----------
function OutcomeGrid() {
  return (
    <Panel title="The four things a reward can mean"
      caption="Only the green cell teaches what was intended. Quality filtering exists to empty the orange and red cells, which the report calls reward noise and reward hacking. The example in the orange cell is from section 4.1.7, the one in the red cell from section 4.1.6.">
      <div className="grid grid-cols-[84px_1fr_1fr] gap-2 text-[13px] leading-5">
        <div />
        <div className="px-1 text-[12px] font-semibold text-secondary">Verifier returns 1</div>
        <div className="px-1 text-[12px] font-semibold text-secondary">Verifier returns 0</div>
        {outcomes.map((o) => (
          <React.Fragment key={o.did}>
            <div className="flex items-center text-[12px] font-semibold text-secondary">{o.did}</div>
            {[o.r1, o.r0].map((c) => (
              <div key={c.t} className={"flex flex-col gap-1 rounded-lg px-3 py-2 " + c.c}>
                <span className={"font-semibold " + c.k}>{c.t}</span>
                <span className="text-primary">{c.d}</span>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}

function Flow() {
  const before = [
    ["Static checks", "Rules and judge models read the task: does the reference pass, does a no-op fail, is the prompt complete"],
    ["Audits and attacks", "Agents run the environment, look for ambiguity and try to earn the reward without solving the task"],
    ["Trial rollouts", "Strong and weak models attempt the task: is it solvable, too easy, or keyed to a wrong answer"],
  ];
  const during = [
    ["Online judges", "Passing rollouts are re-read; a detected hack is scored as zero"],
    ["Rollout analysis", "After each round, successes and failures are traced back to task defects"],
  ];
  const Box = ({ t, d }) => (
    <div className="flex flex-1 basis-[150px] flex-col gap-1 rounded-lg border border-primary bg-elevated px-3 py-2">
      <span className="text-[13px] font-semibold leading-5 text-primary">{t}</span>
      <span className="text-[12px] leading-[18px] text-secondary">{d}</span>
    </div>
  );
  const Row = ({ label, sub, items }) => (
    <div className="flex flex-col gap-2 rounded-lg bg-wash p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{label}</span>
        <span className="text-[12px] text-secondary">{sub}</span>
      </div>
      <div className="flex flex-wrap gap-2">{items.map(([t, d]) => <Box key={t} t={t} d={d} />)}</div>
    </div>
  );
  const Arrow = ({ text }) => (
    <div className="flex items-center justify-center gap-2 text-[12px] text-secondary">
      <IconArrowDown size={14} /><span>{text}</span>
    </div>
  );
  return (
    <Panel title="Two layers of defence, joined in a loop"
      caption="Checks before training decide which tasks enter the pool. Checks during training catch what those missed, and their findings go back into the earlier checks. The pool only shrinks, unless a removed task is repaired and revalidated.">
      <Row label="Before training" sub="several million candidate tasks" items={before} />
      <Arrow text="nearly one million tasks enter the final RL run" />
      <Row label="During training" sub="every round of rollouts" items={during} />
      <Arrow text="faulty tasks are removed or repaired; check definitions are tightened" />
      <div className="rounded-lg border border-dashed border-primary px-3 py-2 text-center text-[12px] leading-5 text-secondary">
        Back to the top: the same checks, now stricter, run on the remaining pool and on every new batch.
      </div>
    </Panel>
  );
}

// ---------- demo 1: mixed groups ----------
function mixed(p, g) { return 1 - Math.pow(p, g) - Math.pow(1 - p, g); }
function MixedDemo() {
  const [p, setP] = useState(0.1);
  const [g, setG] = useState(8);
  const curve = useMemo(() => {
    const out = [];
    for (let i = 0; i <= 50; i++) { const x = i / 50; out.push({ p: Math.round(x * 100), m: Math.round(mixed(x, g) * 1000) / 10 }); }
    return out;
  }, [g]);
  const m = mixed(p, g);
  const allZero = Math.pow(1 - p, g), allOne = Math.pow(p, g);
  return (
    <Demo title="How often does a group carry a learning signal?"
      takeaway="A task the model solves 10% of the time is still useful: with 8 attempts, more than half of its groups contain a success. Move the solve rate toward 0% or 100% and almost every group comes back uniform, which is compute spent for no gradient. Group size and solve rate here are made-up inputs; the report does not state its group size in these sections.">
      <Slider label="Solve rate of this model on the task" value={p} min={0} max={1} step={0.01} onChange={setP} fmt={(v) => pct(v)} />
      <Slider label="Rollouts per group (toy value)" value={g} min={2} max={32} step={1} onChange={setG} />
      <ChartContainer config={{ m: { label: "Groups with both outcomes", color: chartColors[0] } }} style={{ height: 210, width: "100%" }}>
        <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <ChartGrid />
          <ChartXAxis dataKey="p" type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
          <ChartYAxis domain={[0, 100]} ticks={[0, 50, 100]} title="Mixed groups (%)" />
          <ChartLine dataKey="m" dot={false} isAnimationActive={false} />
          <Recharts.ReferenceLine x={Math.round(p * 100)} stroke="rgb(var(--text-orange))" strokeDasharray="4 3" />
        </LineChart>
      </ChartContainer>
      <div className="-mt-1 text-center text-[12px] text-secondary">Solve rate on the task (%)</div>
      <div className="grid grid-cols-3 gap-2 text-[13px]">
        <div className="rounded-lg bg-wash px-3 py-2"><div className="text-[12px] text-secondary">All attempts fail</div><div className="font-mono text-primary">{pct(allZero, 1)}</div></div>
        <div className="rounded-lg bg-tint-green px-3 py-2"><div className="text-[12px] text-secondary">Mixed: usable signal</div><div className="font-mono text-primary">{pct(m, 1)}</div></div>
        <div className="rounded-lg bg-wash px-3 py-2"><div className="text-[12px] text-secondary">All attempts succeed</div><div className="font-mono text-primary">{pct(allOne, 1)}</div></div>
      </div>
    </Demo>
  );
}

// ---------- demo 2: Jaccard ----------
function grams(s) { const t = s.toLowerCase(); const g = new Set(); for (let i = 0; i + 7 <= t.length; i++) g.add(t.slice(i, i + 7)); return g; }
const jBase = "Find the number of positive integers n less than 1000 such that n squared plus 1 is divisible by 5.";
const jPresets = [
  { k: "digit", label: "One number changed", b: "Find the number of positive integers n less than 2000 such that n squared plus 1 is divisible by 5." },
  { k: "edit", label: "Light edit", b: "Find the number of positive integers n below 1000 such that n squared plus one is divisible by 5." },
  { k: "para", label: "Paraphrase", b: "How many positive whole numbers under one thousand have a square that leaves remainder 4 when divided by 5?" },
];
function JaccardDemo() {
  const [a, setA] = useState(jBase);
  const [b, setB] = useState(jPresets[0].b);
  const r = useMemo(() => {
    const A = grams(a), B = grams(b); let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
    const uni = A.size + B.size - inter; return { inter, uni, j: uni ? inter / uni : 0 };
  }, [a, b]);
  const active = a === jBase ? (jPresets.find((x) => x.b === b) || {}).k : null;
  return (
    <Demo title="Character 7-gram Jaccard similarity"
      takeaway="Changing one number keeps most 7-grams, so the pair is caught when one side is an evaluation (0.80) but not as a training duplicate (0.95). The paraphrase asks the same question and scores near zero. That is the limit the report states: this catches copies and small edits, not paraphrases or translations. The example texts are made up.">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-secondary">Second text:</span>
        {jPresets.map((x) => (
          <Button key={x.k} size="sm" variant={active === x.k ? "primary" : "secondary"} onClick={() => { setA(jBase); setB(x.b); }}>{x.label}</Button>
        ))}
      </div>
      <Input value={a} onValueChange={setA} aria-label="First text" />
      <Input value={b} onValueChange={setB} aria-label="Second text" />
      <div className="flex flex-col gap-1 pt-1">
        <div className="relative h-3 rounded-full bg-wash">
          <div className="absolute left-0 top-0 h-3 rounded-full" style={{ width: (r.j * 100) + "%", background: "rgb(var(--text-blue))" }} />
          <div className="absolute top-[-4px] h-5 border-l border-dashed border-current text-secondary" style={{ left: "80%" }} />
          <div className="absolute top-[-4px] h-5 border-l border-dashed border-current text-secondary" style={{ left: "95%" }} />
        </div>
        <div className="relative h-4 text-[11px] text-secondary">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-full pr-1" style={{ left: "80%" }}>0.80</span>
          <span className="absolute -translate-x-full pr-1" style={{ left: "95%" }}>0.95</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-mono text-primary">J = {r.inter} / {r.uni} = {r.j.toFixed(3)}</span>
        <Badge variant={r.j >= 0.95 ? "destructive" : "success"}>{r.j >= 0.95 ? "Training duplicate: excluded" : "Not a training duplicate"}</Badge>
        <Badge variant={r.j >= 0.8 ? "destructive" : "success"}>{r.j >= 0.8 ? "Contaminated if one side is an evaluation" : "Clears the evaluation check"}</Badge>
      </div>
    </Demo>
  );
}

// ---------- demo 3: web-search grader ----------
function norm(s) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a|an)\b/g, " ").replace(/\s+/g, " ").trim(); }
const gPresets = [
  { k: "exact", label: "Exact", a: "the Treaty of Tordesillas" },
  { k: "equiv", label: "Different wording", a: "Tordesillas Treaty (1494)" },
  { k: "hedge", label: "Hedged list", a: "It is most likely the Treaty of Tordesillas, although depending on how the question is read it could also be the Treaty of Zaragoza, the Treaty of Alcacovas, or the papal bull Inter caetera, each of which divided overseas territories between the two crowns" },
  { k: "none", label: "No answer line", a: "" },
];
function GraderDemo() {
  const [gold, setGold] = useState("Treaty of Tordesillas");
  const [ans, setAns] = useState(gPresets[2].a);
  const limit = Math.max(150, 4.5 * gold.length);
  const extracted = ans.trim().length > 0;
  const exact = extracted && norm(ans) === norm(gold);
  const tooLong = ans.length > limit;
  const stage = !extracted ? 0 : exact ? 1 : tooLong ? 2 : 3;
  const rows = [
    { n: 1, t: "Exact match", d: !extracted ? "Nothing could be extracted, so the reward is 0." : exact ? "The normalized answers are identical." : "The normalized answers differ.", on: stage <= 1, res: !extracted ? "Reward 0" : exact ? "Reward 1" : "Continue" },
    { n: 2, t: "Length check", d: "Answer is " + ans.length + " characters; the limit is max(150, 4.5 × " + gold.length + ") = " + (Math.round(limit * 10) / 10) + ".", on: stage === 2, res: stage < 2 ? "Not reached" : tooLong ? "Reward 0" : "Continue" },
    { n: 3, t: "Judge model", d: "A judge decides whether the answer is equivalent to the gold answer. It is not simulated here.", on: stage === 3, res: stage < 3 ? "Not reached" : "Judge decides" },
  ];
  const active = gPresets.find((x) => x.a === ans);
  return (
    <Demo title="Which stage decides the web-search reward?"
      takeaway="The hedged answer contains the gold answer, yet it scores 0 without ever reaching the judge, because it is longer than the limit. Listing candidates cannot be turned into reward. The question, the answers and the normalization rule (lower-case, strip punctuation and articles) are made up for this demo; the three stages and the length formula are the report's.">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-secondary">Model's answer:</span>
        {gPresets.map((x) => (
          <Button key={x.k} size="sm" variant={active && active.k === x.k ? "primary" : "secondary"} onClick={() => setAns(x.a)}>{x.label}</Button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-secondary">Gold answer
        <Input value={gold} onValueChange={setGold} aria-label="Gold answer" />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-secondary">Text extracted after "The answer is:"
        <Input value={ans} onValueChange={setAns} aria-label="Model answer" />
      </label>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.n} className={"flex items-start gap-3 rounded-lg px-3 py-2 " + (r.on && r.res !== "Continue" ? "bg-tint-blue" : "bg-wash")}>
            <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-[12px] text-secondary">{r.n}</span>
            <div className="flex min-w-0 grow flex-col">
              <span className="text-[13px] font-semibold leading-6 text-primary">{r.t}</span>
              <span className="text-[12.5px] leading-5 text-secondary">{r.d}</span>
            </div>
            <Badge variant={r.res === "Reward 1" ? "success" : r.res === "Reward 0" ? "destructive" : r.res === "Judge decides" ? "blue" : "default"}>{r.res}</Badge>
          </div>
        ))}
      </div>
    </Demo>
  );
}

// ---------- domain explorer ----------
function Bullets({ items }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-6 text-primary">
      {items.map((s, i) => <li key={i}>{s}</li>)}
    </ul>
  );
}
function DomainExplorer() {
  const [k, setK] = useState("swe");
  const d = domainDetail[k];
  const Label = ({ children }) => <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{children}</div>;
  return (
    <Demo title="One domain at a time: task, reward and defences"
      takeaway="Step through the seven domains and compare the reward rule with the checks around it. The more judgment the verifier needs (a rubric judge rather than a test suite), the more of the defence moves into attackers before training and judges during training.">
      <div className="flex flex-wrap gap-2">
        {domainOrder.map((id) => (
          <Button key={id} size="sm" variant={id === k ? "primary" : "secondary"} onClick={() => setK(id)}>{domainDetail[id].label}</Button>
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-lg bg-wash p-4">
        <div><Label>What a task contains</Label><div className="text-[13.5px] leading-6 text-primary">{d.task}</div></div>
        <div><Label>How a rollout is scored</Label><div className="text-[13.5px] leading-6 text-primary">{d.reward}</div></div>
        <div><Label>Checks before training</Label><Bullets items={d.before} /></div>
        <div><Label>Checks during training</Label><Bullets items={d.during} /></div>
        <div><Label>Also worth knowing</Label><div className="text-[13.5px] leading-6 text-primary">{d.note}</div></div>
      </div>
    </Demo>
  );
}

function PipelineList() {
  const Tag = ({ children }) => <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{children}</span>;
  return (
    <Panel title="Seven synthetic pipelines"
      caption="Every pipeline pairs a generator with something that tries to break its output: a verifier run both ways, an attacker, independent solvers or a second judge. Source: sections 4.1.5 to 4.1.10.">
      <div className="flex flex-col">
        {pipelines.map((r, i) => (
          <div key={r.n} className={"grid grid-cols-1 gap-x-4 gap-y-2 py-3 min-[720px]:grid-cols-[150px_1fr] " + (i ? "border-t border-primary" : "pt-0")}>
            <div className="flex flex-col">
              <span className="text-[13.5px] font-semibold leading-5 text-primary">{r.n}</span>
              <span className="text-[12px] leading-5 text-secondary">{r.dom}</span>
            </div>
            <div className="flex flex-col gap-2 text-[13.5px] leading-6 text-primary">
              <div><Tag>How a task is made</Tag><div>{r.how}</div></div>
              <div><Tag>What keeps it honest</Tag><div>{r.guard}</div></div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------- lesson ----------
function Lesson() {
  return (
    <div className="flex flex-col gap-2">
      <Stage step={1} title="A reward is only as good as the task behind it">
        <Lead>
          Reinforcement learning makes the model more likely to repeat whatever earned reward. This lesson is about the other half of
          that sentence: who hands out the reward, and how the team made sure it is handed out only for real work.
        </Lead>
        <P>
          Three terms first. A <b>task</b> is a prompt, an environment to work in (a repository, a container, a set of tools) and
          a <Term def="The program or model that looks at what the agent produced and returns the reward. Examples: a hidden test suite, a symbolic math checker, a judge model applying a rubric.">verifier</Term> that
          scores the result. A <Term def="One complete attempt at a task by the model, from the prompt to the final answer, including every tool call on the way.">rollout</Term> is
          one attempt at a task. During RL the model makes a <b>group</b> of rollouts on the same task, and attempts that scored above
          the group's average are reinforced. <LessonLink to="rl" /> covers that algorithm; here we only need to know that the
          verifier's number is the entire training signal.
        </P>
        <H3>Three ways a task can mislead the model</H3>
        <P>
          The first two are about the verifier being wrong. If it can be fooled, the model learns to fool it. If it sometimes marks
          correct work as wrong, good reasoning is punished at random. The grid below places both next to the two honest outcomes.
        </P>
        <OutcomeGrid />
        <P>
          The third is about the task being the wrong difficulty for the model being trained. If every attempt in a group fails, or
          every attempt succeeds, there is nothing to compare, so the group teaches nothing and its compute is wasted. Difficulty is
          therefore not a property of the task alone. It depends on the model, and it changes as the model improves.
        </P>
        <H3>The order of priorities</H3>
        <P>
          The report ranks what it wants from a task pool. Quality and difficulty are hard constraints. Scale and diversity are
          maximised only inside them.
        </P>
        <Steps items={[
          { title: "Quality: zero noise in the reward", body: "The task is well-formed and complete, reward is given only when the task is truly solved, and the verifier always gives the same reward for the same answer. Some quality checks depend on the model: a task it can answer without any reasoning, or one where a successful hack has been observed, fails." },
          { title: "Difficulty: right for this model, for the right reason", body: "Not mostly zeros and not mostly ones within a group. A leaked answer makes a task look easy; missing context, a chat-template formatting error, an unreachable website or a too-strict memory or time limit makes it look hard. Impossible questions are singled out because they can lead the model to hack." },
          { title: "Scale", body: "As many tasks as survive the first two requirements." },
          { title: "Diversity", body: "Task formats, programming languages, tool combinations and topics, with duplicates and evaluation look-alikes removed." },
        ]} />
        <P>
          Applied to a pool of several million verifiable tasks, these requirements left nearly one million for the final RL run. The
          pool was never frozen. After every round of experiments the team read rollouts and asked whether a success or a failure was
          caused by the task rather than the model, and a hack seen in training led to the task being removed.
        </P>
        <H3>Where tasks come from</H3>
        <P>
          Tasks have three sources, and the report is frank about the trade-off of each. Look at the last column: only one source
          met all three requirements at once.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>What the report found</TableHead><TableHead>Quality, difficulty and scale together</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">Open-source environments</TableCell><TableCell>Valuable early in development. At large scale with a strong model they needed extensive quality and difficulty filtering.</TableCell><TableCell>No</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Vendor tasks</TableCell><TableCell>High quality and high difficulty, but expensive.</TableCell><TableCell>No: cost limits scale</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">In-house synthetic pipelines</TableCell><TableCell>Models and agents generate tasks, and automated gates reject the bad ones.</TableCell><TableCell>Yes</TableCell></TableRow>
          </TableBody>
        </Table>
        <H3>Seven domains, seven kinds of verifier</H3>
        <P>
          The same principles are applied in seven domains. What changes is the verifier, and the verifier decides how the reward can
          go wrong. A test suite can be bypassed, a judge model can be inconsistent or talked into a pass, an answer key can simply
          be wrong.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead>What the agent does</TableHead><TableHead>What decides the reward</TableHead></TableRow></TableHeader>
          <TableBody>
            {overview.map((r) => (
              <TableRow key={r.d}><TableCell className="font-medium">{r.d}</TableCell><TableCell>{r.job}</TableCell><TableCell>{r.by}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
        <Small>
          The first six domains train the agentic expert. The RL tasks for general tool use train the alignment teacher instead,
          which is the subject of <LessonLink to="align" />.
        </Small>
        <KeyIdea>
          Before asking whether the model can solve a task, ask whether the verifier can be trusted in both directions: it must pay
          for every real solution and for nothing else. Then ask whether this particular model sometimes solves the task and
          sometimes does not. Only tasks that pass both questions are worth scaling.
        </KeyIdea>
      </Stage>

      <Stage step={2} title="The checks, written down">
        <P>
          This part makes the ideas concrete: the condition for a group to carry signal, the duplicate detector, the two-sided
          verifier test, the reward rules that block hedging, and then each domain's full set of checks.
        </P>

        <H3>When a group carries signal</H3>
        <P>
          The report defines "too hard" as all or mostly zero rewards in a group and "too easy" as all or mostly full rewards. It
          gives no formula. A standard probability calculation, which is ours and not the report's, shows why both ends are wasteful.
          Suppose each rollout succeeds independently with the same probability.
        </P>
        <Eq label="Chance that a group contains both outcomes (textbook probability, not from the report)">
          <V>P</V>(mixed) = 1 − <V>p</V><sup><V>G</V></sup> − (1 − <V>p</V>)<sup><V>G</V></sup>
        </Eq>
        <Where items={[
          ["p", "probability that one rollout of the current model solves the task (its solve rate)"],
          ["G", "number of rollouts in a group"],
          [<span>p<sup>G</sup></span>, "chance that every rollout succeeds"],
          [<span>(1 − p)<sup>G</sup></span>, "chance that every rollout fails"],
        ]} />
        <MixedDemo />
        <P>
          This is why the report filters on both ends with real rollouts. Math questions that the initial checkpoint solved
          frequently with a low thinking budget were dropped, because they spend inference compute and return no gradient. Terminal
          tasks that a strong model failed in every one of <V>k</V> attempts were dropped too. The report notes that repeated failure
          does not prove a task is broken, only that this is a practical filter.
        </P>

        <H3>Removing duplicates and evaluation look-alikes</H3>
        <P>
          Every incoming training sample is compared with a shared registry of samples already registered, which includes
          evaluation samples. Exact and near-duplicates are excluded. This serves two purposes: it stops the same task from being
          trained on repeatedly, and it keeps benchmark questions out of the training data.
        </P>
        <P>
          Similarity is measured on characters, not meaning. Each sample is turned into the set of
          its <Term def="Every run of seven consecutive characters in the text. 'reward hack' gives 'reward ', 'eward h', 'ward ha', and so on.">character 7-grams</Term>,
          and two samples are compared by how much their sets overlap.
        </P>
        <Eq label="Jaccard similarity and distance (section 4.1.4)">
          <V>J</V>(<V>A</V>, <V>B</V>) = |<V>A</V> ∩ <V>B</V>| / |<V>A</V> ∪ <V>B</V>| &nbsp;&nbsp;&nbsp;&nbsp; <V>d</V><sub>J</sub>(<V>A</V>, <V>B</V>) = 1 − <V>J</V>(<V>A</V>, <V>B</V>)
        </Eq>
        <Where items={[
          ["A, B", "the sets of distinct character 7-grams of the two samples"],
          ["|A ∩ B|", "number of 7-grams that appear in both"],
          ["|A ∪ B|", "number of 7-grams that appear in either"],
          ["J", "1 for identical sets, 0 for sets with nothing in common"],
        ]} />
        <P>
          Two training samples count as duplicates at <V>J</V> ≥ 0.95. When either sample belongs to an evaluation the threshold
          drops to 0.80, so that looser matches are also caught. Try the presets below and watch which threshold each one crosses.
        </P>
        <JaccardDemo />
        <P>
          Comparing every pair in a pool of millions is too slow.{" "}
          <Term def="A technique that compresses a large set into a short signature of hash values, such that the fraction of matching positions between two signatures estimates the Jaccard similarity of the original sets.">MinHash</Term> compresses
          each 7-gram set into a short signature,
          and <Term def="Locality-sensitive hashing: an index that places similar signatures in the same bucket with high probability, so likely matches are found by lookup instead of by comparing against everything.">locality-sensitive hashing</Term> retrieves
          the stored samples likely to match. Exact Jaccard similarity is then computed only for those candidates.
        </P>
        <P>
          The guarantee is one-sided. Every accepted match really meets the threshold, but retrieval is probabilistic, so some
          near-duplicates are never retrieved. The method also sees no meaning: paraphrases, translations and a short question buried
          in a long document all score low. The report calls deduplication "a practical but imperfect control".
        </P>

        <H3>Testing a verifier in both directions</H3>
        <P>
          A verifier has two jobs, and each is tested with a known input. A known-good solution must score 1, and a known-bad one,
          usually doing nothing at all, must score 0. The same pair of tests appears under a different name in each domain. Read
          each row as "what must pass" and "what must fail".
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead>Must score 1</TableHead><TableHead>Must score 0</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">Software engineering</TableCell><TableCell>Tests after the reference change is applied, including tests that already passed (pass-to-pass)</TableCell><TableCell>The target tests on the repository before the change (fail-to-pass)</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Synthetic feature removal</TableCell><TableCell>The feature verifier once the reference implementation is restored</TableCell><TableCell>The feature verifier on the repository with the feature removed</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Terminal use</TableCell><TableCell>The oracle script, on 5 of 5 attempts</TableCell><TableCell>A no-op script, on 5 of 5 attempts</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Competitive coding</TableCell><TableCell>The reference solution, in the team's own sandbox</TableCell><TableCell>Not stated in the report</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">General tool use</TableCell><TableCell>A replay of the golden solution, where one exists</TableCell><TableCell>An episode in which no action is taken</TableCell></TableRow>
          </TableBody>
        </Table>
        <P>
          These two tests are necessary and far from sufficient. They say nothing about the answers in between: a correct solution
          written differently from the reference, or a wrong one that happens to satisfy the tests. The software-engineering pipeline
          uses two auditing agents for exactly these two cases.
        </P>
        <Panel title="Two auditors for the answers in between"
          caption="Both auditors are agents that run code in the task environment, and both must demonstrate the defect. Source: section 4.1.5.">
          <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
            {[
              { n: "Ambiguity judge", dir: "False-negative direction", q: "Do the tests demand something the solver could not have known?",
                how: "It reads the code, documentation and established interfaces for anything that resolves the ambiguity. Where practical it writes and runs an alternative implementation that fits the visible specification and shows the verifier rejecting it." },
              { n: "Verifier-strength judge", dir: "False-positive direction", q: "Can a wrong or partial patch pass?",
                how: "Before looking at the hidden tests it lists the requirements the prompt and repository establish, then checks that violating each one causes a failure, then tries to write an incomplete patch that passes. A bypass counts only if a solver could find it without seeing the hidden tests." },
            ].map((r) => (
              <div key={r.n} className="flex flex-col gap-1.5 rounded-lg bg-wash p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{r.dir}</div>
                <div className="text-[14px] font-semibold text-primary">{r.n}</div>
                <div className="text-[13.5px] font-medium leading-6 text-primary">{r.q}</div>
                <div className="text-[13.5px] leading-6 text-secondary">{r.how}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Small>
          "Solver-visible specification" is the report's name for everything the agent can see: the problem statement plus the
          repository. A fair task is one whose tests check that specification, no more and no less.
        </Small>

        <H3>Reward rules that leave no room for hedging</H3>
        <P>
          When a judge model compares a free-text answer with a gold answer, a long answer that lists several candidates has a
          better chance of being accepted. Two domains close this with a hard length limit applied before the judge.
        </P>
        <Eq label="Longest web-search answer that is still graded (section 4.1.9)">
          <V>L</V><sub>max</sub> = max(150, 4.5 · <V>ℓ</V><sub>gold</sub>)
        </Eq>
        <Eq label="Longest math or science answer that is still graded (section 4.1.7)">
          <V>L</V><sub>max</sub> = 200 &nbsp;&nbsp; (3 · <V>ℓ</V><sub>gold</sub> for the few tasks with a long gold answer)
        </Eq>
        <Where items={[
          [<span>L<sub>max</sub></span>, "maximum length of the model's answer, in characters"],
          [<span>ℓ<sub>gold</sub></span>, "length of the gold (reference) answer, in characters"],
        ]} />
        <P>
          The web-search reward is the clearest example of a staged verifier. The cheap deterministic stages run first, and the
          judge is consulted only for short answers that did not match exactly. The judge's prompt includes few-shot examples that
          show how to handle ambiguity and reject hedged answers.
        </P>
        <CodeBlock code={searchCode} />
        <GraderDemo />
        <P>
          The other domains choose all-or-nothing rewards for the same reason. Competitive coding pays 1 only if every test passes.
          General tool use pays 1 only if every criterion passes. Knowledge work scores a weighted rubric but then applies a
          threshold, so the reward is still 0 or 1.
        </P>

        <H3>Each domain in detail</H3>
        <P>
          The panel below holds the full recipe for each domain. For each one, compare the reward rule with the checks around
          it, and notice which checks happen before training and which keep running during it.
        </P>
        <DomainExplorer />

        <H3>Building tasks synthetically</H3>
        <P>
          In-house pipelines were the source that scaled, so it is worth seeing how they are built. Each has a generator that
          proposes tasks and a gate that tries to reject them. The list gives one entry per pipeline. In each,
          the second paragraph is the part that protects the reward.
        </P>
        <PipelineList />
        <P>
          Generators tend to repeat themselves, so the terminal pipeline steers them with "diversity knobs". One is tone:
          technical, informal or conversational. Another is specificity. A high-specificity description spells out every
          deliverable and edge case. A low-specificity one leaves out requirements that can be inferred from context, the
          environment or common sense, the way a colleague would ask. The report credits these knobs with preventing diversity
          collapse.
        </P>

        <H3>The gates as one function</H3>
        <P>
          Putting the recurring checks in one place gives the sketch below. It is our summary, written as pseudocode. The report
          describes these checks in prose, separately for each domain, and no single domain uses exactly this list.
        </P>
        <CodeBlock code={gateCode} />
        <P>
          Admission is not the end. The last diagram shows where these gates sit in the full loop, together with the checks that
          run while the model trains.
        </P>
        <Flow />
      </Stage>

      <Stage step={3} title="What curation revealed">
        <P>
          The report gives few before-and-after counts for individual filters, but the numbers it does give, and the failures it
          admits to, say a lot about where reward goes wrong in practice.
        </P>

        <H3>The numbers the report states</H3>
        <div className="grid grid-cols-1 gap-3 min-[1000px]:grid-cols-2">
          <Panel title="Competitive-coding problems the model solves reliably"
            caption="Share of problems reliably solved at the start and at the end of training. The median task is roughly a LiveCodeBench 'hard', and the range runs from trivial to national-olympiad level.">
            <BarList max={100} data={[
              { label: "Start", value: 10, valueLabel: "about 10%", color: chartColors[1] },
              { label: "End", value: 70, valueLabel: "about 70%", color: chartColors[0] },
            ]} />
          </Panel>
          <Panel title="Subject mix of the final math and science pool"
            caption="The report lists the first four shares and says the rest come from other scientific disciplines. The 3% is that remainder, computed here.">
            <BarList max={100} data={[
              { label: "Math", value: 65, valueLabel: "65%" },
              { label: "Physics", value: 17, valueLabel: "17%" },
              { label: "Chemistry", value: 11, valueLabel: "11%" },
              { label: "Biology", value: 4, valueLabel: "4%" },
              { label: "Other", value: 3, valueLabel: "3%" },
            ]} />
          </Panel>
        </div>
        <P>
          The coding result has a consequence for curation. A pool in which about 10% of problems are reliably solved at the start
          is mostly solved by the end, which is why difficulty has to be re-measured against the current model.
        </P>
        <Table wrapText rowLines>
          <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead>Figure</TableHead><TableHead>What it measures</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">All</TableCell><TableCell>Several million to nearly one million</TableCell><TableCell>Candidate tasks sourced, and tasks kept for the final RL run</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Math and science</TableCell><TableCell>More than 1 million</TableCell><TableCell>Questions sourced before filtering; the report does not say how many remained</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Competitive coding</TableCell><TableCell>100% C++, 70% Python</TableCell><TableCell>Share of tasks eligible to be solved in each language</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Knowledge work</TableCell><TableCell>About 42%</TableCell><TableCell>Synthetic tasks kept by the independent cross-family vote</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">General tool use</TableCell><TableCell>1,107 tools; 61.9 per task</TableCell><TableCell>Unique tools across all tasks, and the average number exposed in one task</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">General tool use</TableCell><TableCell>41% single-turn, 59% multi-turn</TableCell><TableCell>Tasks with one user message, against tasks with a simulated user who answers follow-up questions. Multi-turn episodes average about 13 turns and 30 tool calls.</TableCell></TableRow>
          </TableBody>
        </Table>

        <H3>Findings that go against expectation</H3>
        <Surprise title="Guessable questions harm the reasoning itself">
          One would expect an easy-to-guess question to be merely a wasted sample. The report says it is worse: the model learns to
          take a guess inside its chain of thought instead of deriving the answer, and this "hinders the scaling of chain of thought
          tokens" as the policy degenerates into guessing. The filter is correspondingly broad. It removes yes/no and
          multiple-choice questions, questions with few possible answers (the rank of a matrix), answers that are unusually
          frequent across the pool (0, 1, π), and questions answerable by reciting a formula.
        </Surprise>
        <Surprise title="A judge from a different model family rejected more than half of the tasks that had passed every in-loop check">
          Synthetic knowledge-work tasks had already cleared eight deterministic validators and nine judged criteria, with up to ten
          revision rounds. Because the authoring agent and that judge came from the same model family, the team added a majority
          vote by a different family: three votes over five defect classes. Only about 42% of the published tasks were kept. The
          report gives the shared model family as the reason for adding the vote; it does not break down what the vote rejected.
        </Surprise>
        <Surprise title="A weak model beating a strong one is a signal about the answer key">
          The natural reading of "the weak model did better" is noise. The team treats it as evidence about the task: the report
          says such questions often indicate a problem such as an incorrect but plausible gold answer. Math and science questions where the strong model
          did worse were dropped. For web search a task was kept only if the strong model's solve rate was at least 12.5 percentage
          points higher, or the weak model's solve rate was zero.
        </Surprise>
        <Surprise title="A passing reference solution says little about the environment">
          An oracle script that scores 1.0 five times in a row sounds like proof that a terminal task works. The report calls such
          checks "necessary but not sufficient": the oracle does not take the paths an agent finds, and it can hide basic problems
          with the agent's environment. Two examples follow. Some synthetic tasks included "black-box" binaries that the agent could
          freely access and reverse-engineer. And the original Harbor layout ran the verifier in the same runtime as the agent,
          which was "generally not robust to reward hacking", so verifier and agent were moved to separate runtimes.
        </Surprise>

        <H3>Other findings</H3>
        <Findings items={[
          <span><b>Open-source tasks needed the most filtering.</b> Open-source terminal tasks did not meet the quality bar at all, and open SWE corpora needed extensive quality and difficulty filtering once used at scale with a strong model.</span>,
          <span><b>The grading library had errors in both directions.</b> The math verifier started from the math-verify library. It produced false negatives because it lacked normalizations (stylistic LaTeX commands, European interval notation, ASCII answers such as sqrt(13)), and false positives because answers were resolved to the wrong kind of SymPy object. Questions whose gold answer could not be parsed were dropped, so that grading never fell back to string matching.</span>,
          <span><b>Under-specified answers are reward noise.</b> With a gold answer of 3.5 m/s, judges were inconsistent about 3.51 m/s or 351 cm/s, and the result of a calculation depends on whether gravity is taken as 9.8 or 9.81 m/s². Questions were rewritten to fix precision, units and constants.</span>,
          <span><b>Tasks can look hard for reasons unrelated to the model.</b> Some search questions needed pages that the search provider had not indexed or that sat behind a CAPTCHA. They were dropped as unsolvable in this environment.</span>,
          <span><b>The synthetic search pipeline aged out.</b> InfoSeek-style questions were useful early in development and were largely too easy by the end of Beam's training.</span>,
          <span><b>The first synthetic batches surfaced unglamorous problems.</b> Running a first batch end to end exposed undersized sandboxes, verifier timeouts, ambiguous descriptions, insufficient difficulty and hackable verifiers. Each became a change to the generation prompts or the quality checks.</span>,
        ]} />

        <H3>What the report does not say</H3>
        <P>
          Several numbers that would help a reader reproduce this work are absent. The report gives no task count per domain and
          no pass rate for most individual filters. It does not name the strong, weak or reference models used for difficulty
          screening, the number of attempts <V>k</V> in the terminal solvability check, or the threshold that turns a
          knowledge-work rubric score into a reward. It reports no measurement of how many hacks or noisy rewards remained after
          filtering.
        </P>
        <Src>sections 4.1.3 to 4.1.11, figures 18 to 24</Src>
      </Stage>
    </div>
  );
}
