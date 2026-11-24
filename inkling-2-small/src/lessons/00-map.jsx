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
      <Track label="Pretraining" note="Next-token prediction on raw documents. About 12.2T tokens." tint="bg-wash">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="grow basis-0"><StageBox to="pretrain" title="H1 · broad mix" sub="8.4T tokens of text, code and images, in NVFP4" /></div>
          <RightArrow />
          <div className="grow basis-0"><StageBox to="pretrain" title="H2 · newer, better data" sub="3.8T unseen tokens at 512K context" /></div>
        </div>
      </Track>
      <DownArrow label="switch to data in the deployment format" />
      <Track label="Midtraining" note="Still next-token prediction, but on whole agent trajectories. About 354B tokens." tint="bg-tint-purple">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="grow basis-0"><StageBox to="midtrain" title="H3 · trajectories + replay" sub="~320B tokens at 1M context" /></div>
          <RightArrow />
          <div className="grow basis-0"><StageBox to="midtrain" title="H4 · the best trajectories" sub="~34B tokens, nothing else" /></div>
        </div>
      </Track>
      <DownArrow label="one checkpoint goes into RL" />
      <Track label="One joint RL run" note="Every task family trained together: 1,075 steps, 17M+ rollouts, 9 days on 2,048 GPUs." tint="bg-tint-blue">
        <StageBox to="rl" title="Tasks, graders and rewards" sub="Eight task families, four kinds of grader, effort and length" />
        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
          <StageBox to="stable" title="StableReinforce" sub="Keeping the gradient honest when samples are 17 updates old" />
          <StageBox to="horizon" title="Long-horizon rollouts" sub="1.5M-token, four-hour trajectories and the systems behind them" />
        </div>
        <div className="pt-2"><StageBox to="align" title="Alignment inside the run" sub="An alignment reward on every task, plus targeted environments and monitors" /></div>
      </Track>
      <DownArrow label="the released checkpoint" />
      <Track label="What it is for" note="Built to be fine-tuned further by customers on Tinker." tint="bg-tint-green">
        <StageBox to="custom" title="Customizability and results" sub="How fast it learns a new task, and where it still falls short" />
      </Track>
    </div>
  );
}

const vocab = [
  ["Token", "The unit a language model reads and writes, roughly three-quarters of an English word. Images are also turned into tokens."],
  ["Pretraining", "Training a model to predict the next token of ordinary documents. It is where almost all knowledge comes from."],
  ["Midtraining", "Further next-token training on narrower, higher-quality data shaped like the model's final use, before RL starts."],
  ["Trajectory", "A complete record of a model working on a task: its reasoning, every tool call and every tool result. Called a rollout during RL."],
  ["RL", "Reinforcement learning: the model attempts tasks, a grader scores the attempts, and high-scoring behavior is made more likely."],
  ["Grader", "Whatever turns an attempt into a reward: hidden tests, a reference answer, an LLM judge with a rubric, or a reward model."],
  ["Sampler / trainer", "The two copies of the model in RL. The sampler generates rollouts; the trainer computes gradients on them and updates the weights."],
  ["Staleness", "How many weight updates the trainer has made since the sampler produced a rollout. Stale data comes from an older policy."],
  ["Tinker", "Thinking Machines' fine-tuning service. Its public loss functions and cookbook are the same tools used to train Inkling 2 Small."],
];

function Lesson() {
  const { go, lessons } = useNav();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold leading-9 text-primary">How Inkling 2 Small is trained</h1>
        <Lead>
          Inkling 2 Small is Thinking Machines' second-generation open-weights model: 594B parameters in total, of which 17B are
          used for each token. This tutorial follows its <b>data</b> and its <b>post-training</b>. The data goes through four
          phases, from a broad web-scale mix down to 34B tokens of the best agent trajectories. Post-training is a single
          reinforcement-learning run in which every skill is trained at once, against stale samples, on tasks that can last four hours.
        </Lead>
      </header>

      <StatsRow columns={4}>
        <StatCard label="Training tokens"><StatCardValue>~12.55T</StatCardValue><StatCardCaption>four phases, H1 to H4</StatCardCaption></StatCard>
        <StatCard label="RL rollouts"><StatCardValue>17M+</StatCardValue><StatCardCaption>one run, 1,075 steps</StatCardCaption></StatCard>
        <StatCard label="RL compute"><StatCardValue>4×10²³</StatCardValue><StatCardCaption>FLOPs, 2,048 GPUs, 9 days</StatCardCaption></StatCard>
        <StatCard label="Longest rollouts"><StatCardValue>1.5M</StatCardValue><StatCardCaption>tokens at p99, 4 hours</StatCardCaption></StatCard>
      </StatsRow>

      <Panel title="The pipeline" caption="Each box opens the lesson that explains it; the number is the lesson. Read top to bottom.">
        <PipelineFigure />
      </Panel>

      <section className="flex flex-col gap-3">
        <H3>What changed from the first Inkling</H3>
        <P>
          The first Inkling started post-training with a short supervised warm-up on synthetic data from open-weights models
          such as Kimi K2.5, then spent most of its compute on asynchronous RL. Inkling 2 Small moves the warm-up into the data
          itself (the trajectory-heavy H3 and H4 phases) and puts every task family into <b>one joint RL run</b>. That choice is what makes the rest of the recipe necessary: once short chat tasks and four-hour coding tasks
          share one run, the trainer always has stale samples to learn from, and the infrastructure has to keep very long contexts
          cheap.
        </P>
        <P>
          The team also treated <b>customizability</b> as a release goal: the model should improve quickly when customers fine-tune
          it further. That goal shows up at both ends, in how much pretraining data was used and in how the model was evaluated
          before release.
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
          Every lesson has three parts: the intuition in plain language, then the math and code, then what the results showed,
          with results that went against expectation marked "Surprising". Lessons 1 and 2 cover the data, 3 to 6 the RL run, and
          7 the released model. Architecture and the 4-bit numerics are left out on purpose, except where they change the data or
          the RL recipe.
        </Small>
      </section>

      <section className="flex flex-col gap-3">
        <H3>Where the facts come from</H3>
        <P>
          Most numbers come from Thinking Machines' launch post and model card. The RL objective is documented in the Tinker docs
          and in the score-centering paper it builds on (Marek and Ryabinin, Together AI). An expert review by Sunt on Zhihu adds
          context and comparisons with other labs; anything that comes only from that review is labelled "per the Zhihu review".
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H3>Words used throughout</H3>
        <Where items={vocab.map(([w, d]) => [<span className="not-italic font-sans font-semibold">{w}</span>, d])} />
      </section>
    </div>
  );
}
