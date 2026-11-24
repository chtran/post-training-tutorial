const meta = { id: "map", nav: "Map of the pipeline", title: "Map", question: "", minutes: 3, takeaways: [] };

const DownArrow = ({ label }) => (
  <div className="flex flex-col items-center py-1 text-secondary">
    <svg width="14" height="26" viewBox="0 0 14 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 1v23M2 19l5 5 5-5" />
    </svg>
    {label ? <span className="pt-1 text-[11.5px] leading-4">{label}</span> : null}
  </div>
);
const RightArrow = () => (
  <svg className="shrink-0 text-secondary" width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 7h19M15 2l5 5-5 5" />
  </svg>
);

// One clickable stage of the pipeline; opens the lesson that explains it.
function StageBox({ to, title, sub }) {
  const { go, lessons } = useNav();
  const l = lessons.find((x) => x.id === to);
  return (
    <Button variant="secondary" onClick={() => go(to)} className="!h-auto w-full !items-start !justify-between gap-3 !px-3 !py-2 text-left">
      <span className="flex min-w-0 flex-col">
        <span className="text-[13.5px] font-semibold leading-5 text-primary">{title}</span>
        <span className="whitespace-normal text-[12px] font-normal leading-4 text-secondary">{sub}</span>
      </span>
      <span className="shrink-0 rounded-full bg-wash px-2 py-[1px] font-mono text-[11px] font-normal leading-5 text-secondary">{l ? l.n : ""}</span>
    </Button>
  );
}
function Track({ label, note, tint, children }) {
  return (
    <div className={"flex h-full flex-col gap-1 rounded-lg px-3 pb-3 pt-2 " + tint}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{label}</div>
      {note ? <div className="pb-1 text-[12px] leading-4 text-secondary">{note}</div> : null}
      {children}
    </div>
  );
}
const Plain = ({ title, sub }) => (
  <div className="flex flex-col rounded-md border border-primary bg-elevated px-3 py-2">
    <span className="text-[13.5px] font-semibold leading-5 text-primary">{title}</span>
    <span className="text-[12px] leading-4 text-secondary">{sub}</span>
  </div>
);

function PipelineFigure() {
  return (
    <div className="flex flex-col items-stretch">
      <div className="mx-auto w-full max-w-[320px]"><Plain title="Midtrained checkpoint" sub="501.3B parameters, 23.4B active per token, 1M-token context" /></div>
      <DownArrow label="copied three times: two experts and, later, the student" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Track label="Agentic expert" note="Reasoning, coding, terminal, search. One long run on tasks a program can check." tint="bg-tint-blue">
          <StageBox to="sft" title="SFT" sub="Formats, tool-call syntax, reasoning" />
          <DownArrow />
          <StageBox to="rl" title="High-compute RL" sub="Asynchronous, GRPO-style" />
          <div className="pt-2"><StageBox to="tasks" title="Tasks and rewards" sub="About 1M verified tasks feed this run" /></div>
        </Track>
        <Track label="Alignment expert" note="Safety, honesty, instructions, helpfulness. Short runs with humans checking." tint="bg-tint-purple">
          <StageBox to="sft" title="SFT" sub="Seeds each behavior RL will reward" />
          <DownArrow />
          <StageBox to="align" title="Alignment RL" sub="Judges, rubrics, reward models" />
        </Track>
      </div>
      <div className="pt-3"><StageBox to="infra" title="RL infrastructure" sub="The asynchronous stack that both RL runs and the merge run on" /></div>
      <DownArrow label="both experts become teachers" />
      <Track label="Merged student" note="A third copy of the checkpoint learns from both teachers. No rewards are used." tint="bg-wash">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="grow basis-0"><StageBox to="sft" title="Student SFT" sub="Both experts' data and traces" /></div>
          <RightArrow />
          <div className="grow basis-0"><StageBox to="mopd" title="MOPD" sub="Match a routed teacher, token by token" /></div>
        </div>
      </Track>
      <DownArrow label="one model: Beam" />
      <Track label="Release and serving" note="Post-training quantization and a draft model; no further training of Beam." tint="bg-tint-green">
        <StageBox to="serve" title="BF16, FP8, NVFP4 and the DFlash 2 drafter" sub="933.81 GiB down to about 273.5 GiB; decoding 1.9x to 3.0x faster" />
      </Track>
    </div>
  );
}

const vocab = [
  ["SFT", "Supervised fine-tuning: train the model to reproduce example responses token by token."],
  ["RL", "Reinforcement learning: let the model attempt tasks, score the attempts, and make high-scoring behavior more likely."],
  ["Rollout", "One complete attempt at a task, including every tool call and tool result. Also called a trajectory."],
  ["Policy", "The model seen as a decision-maker: the probability it gives each next token in a given context."],
  ["Verifier", "A program that decides whether a rollout solved its task, for example by running hidden tests."],
  ["Judge", "A separate model that scores a rollout against written criteria when no program can."],
  ["MoE", "Mixture of experts: each layer holds many expert sub-networks (256 in Beam) and a router sends each token to a few of them."],
  ["MOPD", "Multi-teacher on-policy distillation: a student model learns to match teacher models on text the student itself generated."],
];

function Lesson() {
  const { go, lessons } = useNav();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold leading-9 text-primary">How Beam is post-trained</h1>
        <Lead>
          Post-training is everything between a model that has read a lot of text and a model you can hand a task to. Beam does
          it by training <b>two experts separately</b>, each with a short supervised phase and then reinforcement learning, and
          then <b>merging them into one model</b> by distillation. The merged model is quantized and paired with a small draft
          model so it is cheap to serve.
        </Lead>
      </header>

      <StatsRow columns={4}>
        <StatCard label="Rollouts"><StatCardValue>100M+</StatCardValue><StatCardCaption>RL, derisking and MOPD</StatCardCaption></StatCard>
        <StatCard label="GPUs"><StatCardValue>10.5K</StatCardValue><StatCardCaption>GB300, four weeks</StatCardCaption></StatCard>
        <StatCard label="RL tasks kept"><StatCardValue>~1M</StatCardValue><StatCardCaption>of several million</StatCardCaption></StatCard>
        <StatCard label="Active parameters"><StatCardValue>23.4B</StatCardValue><StatCardCaption>of 501.3B total</StatCardCaption></StatCard>
      </StatsRow>

      <Panel title="The pipeline" caption="Each box opens the lesson that explains it; the number is the lesson. Read top to bottom.">
        <PipelineFigure />
      </Panel>

      <section className="flex flex-col gap-3">
        <H3>Why two experts instead of one run</H3>
        <P>
          The two halves need different kinds of training. Agentic skill can be checked by a program (the tests pass or they do
          not), so it suits one very long RL run. Values such as honesty and helpfulness have no test suite and pull against one
          another, so they are trained in shorter runs with people regularly checking the results. Training them apart also
          lets each expert be evaluated on its own before the two are combined.
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H3>The lessons</H3>
        <div className="flex flex-col">
          {lessons.filter((l) => l.n > 0).map((l) => (
            <div key={l.id} className="flex items-center gap-4 border-t border-primary py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash font-mono text-[12px] text-secondary">{l.n}</span>
              <div className="flex min-w-0 grow flex-col">
                <span className="text-[15px] font-semibold leading-6 text-primary">{l.title}</span>
                <span className="text-[13.5px] leading-5 text-secondary">{l.question}</span>
              </div>
              <span className="hidden shrink-0 text-[12px] text-secondary sm:block">{l.minutes} min</span>
              <Button variant="secondary" onClick={() => go(l.id)}>Open</Button>
            </div>
          ))}
        </div>
        <Small>
          Every lesson has three parts: the intuition in plain language, then the math and code, then what the experiments showed,
          with results that went against expectation marked "Surprising". Lessons can be read in any order; 1 to 5 follow the
          pipeline, 6 and 7 cover the systems around it.
        </Small>
      </section>

      <section className="flex flex-col gap-3">
        <H3>Words used throughout</H3>
        <Where items={vocab.map(([w, d]) => [<span className="not-italic font-sans font-semibold">{w}</span>, d])} />
      </section>
    </div>
  );
}
