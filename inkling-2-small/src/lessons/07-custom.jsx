const meta = {
  id: "custom",
  nav: "Customizability and results",
  title: "Customizability and results",
  question: "Was the model built to be fine-tuned further, and what do its results, and their caveats, say about the recipe?",
  minutes: 11,
  takeaways: [
    "Customizability was a release goal: how much a customer gains from further RL on fixed data and budget. On an earnings-call analysis task, Inkling 2 Small reached Inkling Small's final score in 75 of 200 steps and finished well ahead.",
    "The comparison was controlled: every model got its own learning-rate sweep and the same Tinker async RL loop with StableReinforce; Inkling results average three seeds, other models are single runs.",
    "The review offers one possible reason the model is easy to adapt: shorter pretraining may leave flatter, less brittle weights. TML does not make this claim.",
    "Out of the box it scores 30.6 on the Artificial Analysis Index, highest among non-Chinese open-weights models in TML's table, and 86.3% on SWE-Bench Pro v2 Hard.",
    "The review flags two caveats: a collapse from 81.3% on Terminal-Bench v2.1 to 13.1% on v4.0, and factuality gains that come mostly from abstaining more rather than knowing more.",
  ],
};

// ---------------------------------------------------------------------
// Demo: abstention vs knowledge on a +1 / -1 / 0 factuality score (toy).
// ---------------------------------------------------------------------
function AbstainDemo() {
  const [know, setKnow] = useState(40);
  const [abst, setAbst] = useState(50);
  const guessAcc = 0.15;
  const unknown = 100 - know;
  const abstain = (unknown * abst) / 100;
  const guessed = unknown - abstain;
  const correct = know + guessed * guessAcc, wrong = guessed * (1 - guessAcc);
  const score = correct - wrong;
  const nonHall = wrong + abstain > 0 ? abstain / (wrong + abstain) : 1;
  return (
    <Demo title="Two ways to raise a factuality score"
      takeaway={"Accuracy is " + correct.toFixed(1) + "%, the score is " + score.toFixed(1) + " and the non-hallucination rate " + pct(nonHall) + ". Move the abstention slider and both headline numbers climb while accuracy barely changes, even falls a little: the model is not learning facts, it is declining to guess. Only the knowledge slider raises all three."}>
      <Slider label="Questions the model actually knows (%)" value={know} min={10} max={80} step={1} onChange={setKnow} />
      <Slider label="Of the rest, share it declines to answer (%)" value={abst} min={0} max={100} step={5} onChange={setAbst} />
      <StatsRow columns={3}>
        <StatCard label="Accuracy"><StatCardValue>{correct.toFixed(1)}%</StatCardValue><StatCardCaption>correct / all questions</StatCardCaption></StatCard>
        <StatCard label="Score"><StatCardValue>{score.toFixed(1)}</StatCardValue><StatCardCaption>correct − wrong, abstain 0</StatCardCaption></StatCard>
        <StatCard label="Non-hallucination"><StatCardValue>{pct(nonHall)}</StatCardValue><StatCardCaption>abstain / (wrong + abstain)</StatCardCaption></StatCard>
      </StatsRow>
      <Small>
        Made-up model: guesses on unknown questions are right 15% of the time. The scoring follows our understanding of
        AA-Omniscience (+1 correct, −1 wrong, 0 for abstaining; non-hallucination is the share of non-correct answers that are
        abstentions); see Artificial Analysis for the exact definitions.
      </Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Chart: selected benchmark rows from TML's table.
// ---------------------------------------------------------------------
const AA = [
  { m: "Claude Haiku 5.5", v: 36.5 }, { m: "DeepSeek V4.1 Flash", v: 32.6 }, { m: "GLM 5.3", v: 31.7 },
  { m: "Gemini 3.8 Flash", v: 30.8 }, { m: "Inkling 2 Small", v: 30.6, ours: true }, { m: "MiniMax-M3.1-Flash", v: 29.1 },
  { m: "GLM-5.3-Flash", v: 27.8 }, { m: "GPT-6 Luna", v: 27.9 }, { m: "Mistral Large 4", v: 26.1 },
];

function AAChart() {
  const rows = [...AA].sort((a, b) => b.v - a.v);
  return (
    <div className="flex flex-col gap-[6px]">
      {rows.map((r) => (
        <div key={r.m} className="flex items-center gap-3">
          <span className={"w-[150px] shrink-0 text-[12.5px] " + (r.ours ? "font-semibold text-primary" : "text-secondary")}>{r.m}</span>
          <div className="relative h-[18px] grow rounded bg-wash">
            <div className={"absolute left-0 top-0 h-full rounded " + (r.ours ? "bg-[rgb(var(--text-blue))]" : "bg-[rgb(var(--text-secondary))] opacity-40")} style={{ width: ((r.v - 20) / 20) * 100 + "%" }} />
          </div>
          <span className="w-[36px] shrink-0 text-right font-mono text-[12.5px] text-primary">{r.v.toFixed(1)}</span>
        </div>
      ))}
      <Small>Artificial Analysis Index v5.0, from TML's benchmark table; axis starts at 20. A selection of the table's columns.</Small>
    </div>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col">
      <Stage step={1} title="A model meant to be trained further">
        <P>
          Thinking Machines sells training, not just a model. Tinker customers take an open-weights model and run their own
          fine-tuning and RL on it, so the model's value depends on how well it responds to that. "Some models respond better to
          fine-tuning, independent of their out-of-the-box performance. We wanted Inkling 2 Small to be a strong base model for
          customization." Per the Zhihu review, Inkling 2 Small may be the first model to treat <Term def="How much a model improves when a customer trains it further on a fixed task, data and budget.">customizability</Term> as
          a launch-blocking evaluation, and users had complained that the first Inkling Small was harder to fine-tune than Qwen.
        </P>
        <P>
          The test is a post-training run of the kind customers do: an investment-analysis task built from public earnings calls,
          graded against expert judgement with a held-out rubric. Every model gets the same setup.
        </P>
        <Steps items={[
          { title: "Same data, same algorithm", body: "Tinker Cookbook abstractions, the async RL loop and the StableReinforce loss from lesson 4, 200 steps." },
          { title: "Each model tuned fairly", body: "A learning-rate sweep per model, so no one loses because of a bad default." },
          { title: "Cost counted too", body: "Sampling and training tokens multiplied by current Tinker per-token prices, assuming prefix-cache hits within a group." },
          { title: "Variance acknowledged", body: "Inkling results are averaged over three seeds; the other models are single runs." },
        ]} />
        <KeyIdea>
          Customizability measures the <b>slope</b>, not the starting point: how much reward a customer buys per training step or
          per dollar.
        </KeyIdea>
        <Src>TML launch post, "Customizability" and the "Evaluating Model Finetunability" figure; Zhihu review, customizability paragraph</Src>
      </Stage>

      <Stage step={2} title="Why it might adapt faster, and how to read the scores">
        <H3>A hypothesis from the review</H3>
        <P>
          TML does not explain why Inkling 2 Small adapts faster. The Zhihu review proposes a mechanism from the forgetting
          literature: <b>flatter solutions</b>. Earlier work found that pretraining for longer makes weights more sensitive to change,
          so fine-tuning helps less, while methods that favour flat minima (SAM, higher learning rates, shorter annealing) reduce
          later forgetting. Inkling 2 Small's 12.55T tokens are few for its size (<LessonLink to="pretrain" />), so the smaller budget
          may have bought plasticity. The review offers the plainer explanation too: this is one rung of a scaling ladder, sized for
          recipe iteration.
        </P>
        <Eq label="Sharpness, the quantity flat-minimum methods keep small (textbook, SAM-style definition)">
          sharpness(<V>θ</V>) = max<sub>‖<V>ε</V>‖ ≤ <V>ρ</V></sub> <V>L</V>(<V>θ</V> + <V>ε</V>) − <V>L</V>(<V>θ</V>)
        </Eq>
        <Where items={[
          [<V>θ</V>, "the pretrained weights"],
          [<V>ε</V>, "a small change to the weights, such as fine-tuning makes"],
          [<V>ρ</V>, "how large a change is considered"],
          ["low sharpness", "loss on old data barely rises when the weights move, so new training forgets less"],
        ]} />
        <P>
          One data point fits the story. Held-out code loss rose only 0.0050 bits per byte across all of post-training, so RL moved
          the model a long way in behavior without disturbing its fit to ordinary code. That is consistent with flat weights but
          does not prove them.
        </P>
        <H3>Reading factuality scores</H3>
        <P>
          RL used uncertainty-sensitive rewards on some question answering (<LessonLink to="rl" />). Such rewards make "I don't
          know" a good answer when the model is unsure, which is what they are for, but it also changes how benchmark numbers
          should be read.
        </P>
        <AbstainDemo />
        <Src>Zhihu review, customizability and evaluation paragraphs; sharpness definition from Foret et al., "Sharpness-Aware Minimization"</Src>
      </Stage>

      <Stage step={3} title="Results and caveats">
        <Findings items={[
          <span><b>Fine-tuning.</b> From similarly low starting scores, Inkling 2 Small reached Inkling Small's final held-out rubric reward after 75 steps and finished substantially ahead; TML reports it learns faster than its previous models across several customer-derived scenarios and is competitive with open models of similar size (GLM 5.3 Flash, DeepSeek V4.1 Flash 1017, Qwen 3.5 397B).</span>,
          <span><b>Overall.</b> 30.6 on the AA Index v5.0, ahead of every non-Chinese open-weights model in the table, including Mistral Large 4 at 26.1, and close to Gemini 3.8 Flash at 30.8.</span>,
          <span><b>Coding.</b> 86.3% on SWE-Bench Pro v2 Hard (mini-swe-agent), behind DeepSeek V4.1 Flash and MiMo V2.6 Flash at 89.7%.</span>,
          <span><b>Knowledge and factuality.</b> AA-Omniscience 16.1 with a 73.3% non-hallucination rate; Muse Spark Open scores 25.8 and 72.0%.</span>,
        ]} />
        <Panel title="Artificial Analysis Index" caption="Higher is better.">
          <AAChart />
        </Panel>
        <Surprise title="Terminal-Bench: 81.3% on one version, 13.1% on the next">
          Per the Zhihu review, Inkling 2 Small scores 81.3% on Terminal-Bench v2.1 but 13.1% on v4.0, behind DeepSeek V4.1 Flash
          (33.8%) and GLM 5.3 (41.9%). Whatever v4.0 changed, the model's terminal skill did not carry over, a warning that RL
          on many harnesses still does not guarantee robustness to new ones. The review reports the same pattern from users: behind
          GPT-6 Luna in the Codex harness, ahead of it in pi, mini-swe-agent and Claude Code.
        </Surprise>
        <Surprise title="Fewer hallucinations, about the same knowledge">
          The review argues the lower hallucination rate comes mostly from abstaining more: accuracy rose only about 2 points. As
          the demo shows, that is exactly what uncertainty-sensitive rewards do. It is the intended behavior, a model that says
          when it does not know, but it is not more knowledge.
        </Surprise>
        <P>
          Two more caveats from the review. The evaluation budget grew from 256K to 1M tokens per trajectory since Inkling Small,
          which helps long-horizon scores by itself. And TML, like Kimi and DeepSeek, says little about its pretraining data
          recipe, which is the part of the pipeline other labs would most like to copy.
        </P>
        <H3>What carries over to your own post-training</H3>
        <Findings items={[
          "Measure base quality with bits per byte on held-out data, and recover a base when you only have a post-trained model.",
          "Put deployment-format trajectories into the last pretraining phases, filtered for honesty as well as correctness.",
          "If rollouts are long-tailed, go asynchronous, and use a loss that removes mismatch drift rather than one that only reweights samples.",
          "Count your task mix by tokens as well as rollouts, and put an alignment reward on every task, not just the safety ones.",
          "Evaluate customizability as a slope per step and per dollar, with a learning-rate sweep per model.",
        ]} />
        <Src>TML launch post, benchmark table and "Customizability"; Zhihu review, capability and evaluation paragraphs</Src>
      </Stage>
    </div>
  );
}
