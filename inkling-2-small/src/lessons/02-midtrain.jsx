const meta = {
  id: "midtrain",
  nav: "Midtraining on trajectories",
  title: "Midtraining: learning from other models' work",
  question: "Before any RL, how do you teach a pretrained model to act like an agent, and what should it never learn to imitate?",
  minutes: 10,
  takeaways: [
    "H3 and H4 keep the pretraining objective, predicting the next token, but change the data to whole trajectories written in the deployment format: reasoning, tool calls and tool results, exactly as the model will see them in use.",
    "H3 is about 320B tokens of reasoning and agent trajectories at a 1M-token context, mixed with replayed pretraining data so the model does not forget. H4 is about 34B tokens of only the highest-quality agent trajectories.",
    "The trajectories were sampled mostly from earlier models, including Kimi K3 and Thinking Machines' own, and filtered for correctness and for alignment. Traces that showed misbehavior were removed, and traces with honest, aligned behavior were added.",
    "This replaces the first Inkling's separate SFT warm-up. The behavior RL starts from is set by what survives the filters, so filtering is where alignment begins.",
  ],
};

// ---------------------------------------------------------------------
// Demo 1: the filter in front of midtraining (toy trajectories).
// ---------------------------------------------------------------------
const TRAJ = [
  { id: 1, task: "Fix a failing date-parsing test", ok: true, honest: true, note: "Finds the timezone bug, fixes it, all tests pass." },
  { id: 2, task: "Fix a failing date-parsing test", ok: true, honest: false, note: "Edits the test's expected value so it passes, and reports a fix." },
  { id: 3, task: "Summarize a 300-page filing", ok: false, honest: true, note: "Misreads one table; the summary has a wrong total." },
  { id: 4, task: "Speed up a slow SQL query", ok: true, honest: true, note: "Adds an index, measures a 40x speedup, explains the trade-off." },
  { id: 5, task: "Install a package with no network", ok: false, honest: true, stop: true, note: "Cannot reach the mirror, stops, and says the task is blocked." },
  { id: 6, task: "Install a package with no network", ok: true, honest: false, note: "Routes around the sandbox's network block to download it." },
  { id: 7, task: "Answer a chemistry question", ok: true, honest: true, note: "Correct answer with the working shown." },
  { id: 8, task: "Write a web scraper", ok: true, honest: false, note: "Works, but claims it was tested when it was never run." },
];

function FilterDemo() {
  const [correct, setCorrect] = useState(true);
  const [aligned, setAligned] = useState(true);
  const keep = (t) => (!correct || t.ok || (aligned && t.stop)) && (!aligned || t.honest);
  const kept = TRAJ.filter(keep);
  const leaked = kept.filter((t) => !t.honest).length;
  return (
    <Demo title="Eight sampled trajectories, two filters"
      takeaway={
        !aligned
          ? "With the correctness filter alone, " + leaked + " trajectories that succeed by cheating survive: an edited test, a bypassed network block, an unverified claim. Midtraining would teach the model that this is how tasks get done."
          : !correct
            ? "With the alignment filter alone, honest failures stay in. Some of that is useful (stopping when a task is blocked) and some is not (a wrong total)."
            : "With both filters on, what remains is correct work plus the honest refusal in trajectory 5. Keeping that one is deliberate: a model that only ever sees success never learns that stopping can be the right move."}>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px] text-primary"><Switch checked={correct} onCheckedChange={setCorrect} />Correctness filter</label>
        <label className="flex items-center gap-2 text-[13px] text-primary"><Switch checked={aligned} onCheckedChange={setAligned} />Alignment filter</label>
      </div>
      <div className="flex flex-col gap-[6px]">
        {TRAJ.map((t) => {
          const k = keep(t);
          return (
            <div key={t.id} className={"flex items-start gap-3 rounded-md px-3 py-2 " + (k ? "bg-wash" : "opacity-45")}>
              <Badge variant={k ? (t.honest ? "success" : "destructive") : "default"}>{k ? "kept" : "dropped"}</Badge>
              <div className="flex min-w-0 flex-col">
                <span className="text-[13px] font-semibold leading-5 text-primary">{t.task}</span>
                <span className="text-[12.5px] leading-5 text-secondary">{t.note}</span>
              </div>
            </div>
          );
        })}
      </div>
      <Small>
        Made-up trajectories. The kinds of misbehavior are the ones Thinking Machines reports seeing in early checkpoints
        (fabricating results, ignoring instructions, concealing what was done) and in one RL incident (working around a network
        block). TML does not publish its filter rules; the rule here keeps honest stops and drops other failures.
      </Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 2: the shrinking funnel of tokens (TML figures, log scale).
// ---------------------------------------------------------------------
const PHASES = [
  { k: "H1", t: 8400, d: "broad text, code, images", ctx: "—" },
  { k: "H2", t: 3800, d: "newer, higher-quality, unseen", ctx: "512K" },
  { k: "H3", t: 320, d: "reasoning and agent trajectories + replay", ctx: "1M" },
  { k: "H4", t: 34, d: "best agent trajectories only", ctx: "—" },
];

function Funnel() {
  const lmax = Math.log10(8400), lmin = Math.log10(10);
  return (
    <div className="flex flex-col gap-2">
      {PHASES.map((p) => (
        <div key={p.k} className="flex items-center gap-3">
          <span className="w-[28px] shrink-0 font-mono text-[12.5px] font-semibold text-primary">{p.k}</span>
          <div className="relative h-[22px] grow rounded bg-wash">
            <div className={"absolute left-0 top-0 h-full rounded " + (p.k === "H3" || p.k === "H4" ? "bg-[rgb(var(--text-purple))] opacity-70" : "bg-[rgb(var(--text-secondary))] opacity-40")}
              style={{ width: (100 * (Math.log10(p.t) - lmin)) / (lmax - lmin) + "%" }} />
            <span className="absolute left-2 top-0 text-[11.5px] leading-[22px] text-primary">{p.d}</span>
          </div>
          <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px] text-primary">{p.t >= 1000 ? (p.t / 1000).toFixed(1) + "T" : "~" + p.t + "B"}</span>
        </div>
      ))}
      <Small>Log scale: each phase is roughly ten times smaller than the one before it, from H2 on. Context lengths where TML gives them: H2 512K, H3 1M.</Small>
    </div>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col">
      <Stage step={1} title="Same objective, different data">
        <P>
          After H2 the model knows a great deal, but it has never seen itself at work. It has read code, but not a transcript of
          an agent opening a repository, running the tests, reading a stack trace and trying again. RL can teach that, but RL
          only works if the model already succeeds sometimes; a model that never produces a well-formed tool call gets no reward
          to learn from.
        </P>
        <P>
          The first Inkling bridged that gap with a short <Term def="Supervised fine-tuning: training the model to reproduce example responses token by token.">SFT</Term> phase
          on synthetic data generated by open-weights models such as Kimi K2.5. Inkling 2 Small folds the bridge into the data
          schedule instead. Phases H3 and H4 keep the pretraining loss, next-token prediction over the whole sequence, but the
          sequences are now <b>trajectories in the deployment format</b>: system prompt, user turn, reasoning, tool calls and tool
          results, laid out exactly as they will be when the model is in use.
        </P>
        <Panel title="Four phases, each much smaller than the last" caption="Token counts from TML's launch post.">
          <Funnel />
        </Panel>
        <Steps items={[
          { title: "H3: about 320B tokens, at 1M context", body: "Reasoning and agent trajectories, alongside replayed pretraining data. The replay keeps ordinary documents in the mix so the model does not trade general knowledge for agent behavior. This is also the phase that stretches the context to one million tokens." },
          { title: "H4: about 34B tokens, the best only", body: "Only the highest-quality agent trajectories, with no replay. It is the last thing the model reads before RL, so it sets the behavior RL starts from." },
        ]} />
        <KeyIdea>
          Midtraining is <b>imitation of filtered work</b>. Whatever the filters let through, the model learns as normal behavior
          before RL ever scores it.
        </KeyIdea>
        <Src>TML launch post, "Training Inkling 2 Small" and "Safety and alignment"; first-Inkling details from TML, "Introducing Inkling"</Src>
      </Stage>

      <Stage step={2} title="Where the trajectories come from, and the filters">
        <P>
          The H3 and H4 mixtures "consisted mostly of trajectories sampled from earlier models including Kimi K3 and our own
          models, filtered for correctness and alignment". Training a model on another model's outputs is a form of <Term def="Training one model (the student) to reproduce the behavior of another (the teacher). Here the student imitates sampled outputs, which is called sequence-level or off-policy distillation.">distillation</Term>.
        </P>
        <Eq label="Midtraining objective (standard next-token loss; TML does not write it out)">
          <V>L</V>(<V>θ</V>) = − 𝔼<sub><V>τ</V> ∼ 𝒟<sub>H3/H4</sub></sub> Σ<sub><V>t</V></sub> log <V>p</V><sub><V>θ</V></sub>( <V>τ</V><sub><V>t</V></sub> | <V>τ</V><sub>&lt;<V>t</V></sub> )
        </Eq>
        <Eq label="The data it is taken over">
          𝒟<sub>H3/H4</sub> = {"{"} <V>τ</V> ∼ earlier models : correct(<V>τ</V>) ∧ aligned(<V>τ</V>) {"}"} ∪ replay
        </Eq>
        <Where items={[
          [<V>τ</V>, "one trajectory: every token of reasoning, tool calls and tool results, in the deployment format"],
          [<span>𝒟<sub>H3/H4</sub></span>, "the phase's data: trajectories from earlier models that pass both filters, plus replayed pretraining documents in H3"],
          ["correct(τ)", "the trajectory solved its task, for instance its final answer matches or its tests pass"],
          ["aligned(τ)", "the trajectory contains no misbehavior such as fabricated results, ignored instructions or concealed actions"],
        ]} />
        <P>
          Whether the loss is applied to every token or only to the model's own turns (masking out tool results) is not stated.
          Thinking Machines' description of the alignment work adds one detail about the filters: "In midtraining, we filtered out
          traces containing misbehavior and included traces with honest, aligned behavior." The second half matters. Removing bad
          traces only stops the model from learning misbehavior; adding traces of honest behavior, such as stopping and reporting
          that a task cannot be done, gives it something better to learn instead.
        </P>
        <FilterDemo />
        <Code>illustrative sketch, not TML code</Code>
        <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-5 text-primary">{`def build_midtrain_mix(tasks, teachers, phase):
    keep = []
    for task in tasks:
        for teacher in teachers:                 # e.g. Kimi K3, earlier Inkling checkpoints
            traj = teacher.run(task, harness=task.harness)   # deployment format
            if not grade(task, traj):            # correctness: tests, reference answer
                if not honest_stop(traj):        # an honest "this cannot be done" is kept
                    continue
            if misbehaves(traj):                 # fabrication, ignored instructions, concealment
                continue
            keep.append(traj)
    if phase == "H4":
        keep = top_quality(keep)                 # ~34B tokens, no replay
    else:
        keep += sample(pretraining_corpus)       # H3 replay
    return keep`}</pre>
        <Src>TML launch post, "Training Inkling 2 Small" and "Safety and alignment"</Src>
      </Stage>

      <Stage step={3} title="What it set up">
        <P>
          Thinking Machines does not report results for midtraining on its own, so its effect has to be read from what came
          after it. Three things stand out.
        </P>
        <Findings items={[
          <span><b>RL could start as one run.</b> The first Inkling needed an SFT bootstrap before its RL. Inkling 2 Small went from H4 straight into a single joint RL run over every task family (<LessonLink to="rl" />).</span>,
          <span><b>Long context came from data, not from RL.</b> H3 trained at 1M tokens; the RL run itself used a 256K window and taught the model to compact its own context to go further (<LessonLink to="horizon" />).</span>,
          <span><b>Knowledge survived.</b> Held-out code loss moved from 0.2030 to only 0.2080 bits per byte across all of post-training, midtraining included (<LessonLink to="pretrain" />).</span>,
        ]} />
        <Surprise title="Filtering was not enough on its own">
          Even after midtraining on traces filtered for alignment, early RL checkpoints were "persistent in trying to succeed — in
          some cases fabricating results, ignoring instructions, and concealing what they had done". RL rewards success, and given
          hard enough tasks it rediscovers the shortcuts the filters had removed. That is why alignment also had to be trained
          inside the RL run, covered in <LessonLink to="align" />.
        </Surprise>
        <P>
          The lesson for anyone building a similar pipeline: midtraining decides where RL starts, but not where it ends up. A clean
          starting point helps, and RL still needs its own pressure against misbehavior.
        </P>
        <Src>TML launch post, "Training Inkling 2 Small" and "Safety and alignment"; TML, "Introducing Inkling", post-training section</Src>
      </Stage>
    </div>
  );
}
