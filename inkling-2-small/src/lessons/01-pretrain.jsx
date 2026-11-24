const meta = {
  id: "pretrain",
  nav: "Pretraining data",
  title: "Pretraining data: a broad mix, then newer and better",
  question: "Why train on fewer tokens than comparable models, and how do you tell whether the data was good?",
  minutes: 11,
  takeaways: [
    "Pretraining has two phases. H1 is 8.4T tokens of a broad mix of natural language, code and images. H2 is 3.8T tokens of higher-quality, newer data the model had not seen, read at a 512K-token context.",
    "The whole budget, about 12.55T tokens including midtraining, is small for a model with 594B parameters. Comparable open models report 20T to over 30T tokens.",
    "Quality is measured as bits per byte on held-out internal code. Unlike per-token loss, this number does not depend on the tokenizer, so different models can be compared.",
    "The pretrained checkpoint scores 0.2030 bits per byte, the best in the comparison. After all of post-training it scores 0.2080, a loss of only 0.0050: heavy RL barely moved the model's fit to ordinary code.",
    "Thinking Machines says little about what is in the mix beyond provenance (public web, third-party, internal and synthetic data) and cleaning (deduplication, junk and safety filtering).",
  ],
};

// ---------------------------------------------------------------------
// Demo 1: why bits per byte, not loss per token (toy).
// ---------------------------------------------------------------------
const SNIPPET = "def mean(xs):\n    return sum(xs) / len(xs)\n";
const BYTES = 44;
const TOKENIZERS = [
  { id: "coarse", label: "Coarse tokenizer", tokens: 9, nats: 0.212 * 44 * Math.LN2 },
  { id: "medium", label: "Medium tokenizer", tokens: 14, nats: 0.212 * 44 * Math.LN2 },
  { id: "fine", label: "Byte-level", tokens: 44, nats: 0.212 * 44 * Math.LN2 },
];

function ReadOut({ label, value, note, tint }) {
  return (
    <div className={"flex flex-col rounded-lg px-3 py-2 " + (tint || "bg-wash")}>
      <span className="text-[12px] leading-4 text-secondary">{label}</span>
      <span className="font-mono text-[15px] leading-6 text-primary">{value}</span>
      {note ? <span className="text-[11.5px] leading-4 text-secondary">{note}</span> : null}
    </div>
  );
}

function BpbDemo() {
  const [tk, setTk] = useState("coarse");
  const t = TOKENIZERS.find((x) => x.id === tk);
  const perToken = t.nats / t.tokens;
  const bpb = t.nats / (Math.LN2 * BYTES);
  return (
    <Demo title="Same text, same model quality, three tokenizers"
      takeaway={"Loss per token changes with the tokenizer: a coarse tokenizer packs more text into each token, so each token is harder to predict. Bits per byte divides the same total by the number of bytes instead, and stays at " + bpb.toFixed(3) + " whichever tokenizer you pick. That is why Thinking Machines can rank models with different vocabularies on one axis."}>
      <SegmentedControl value={tk} onValueChange={(v) => v && setTk(v)} size="small" aria-label="Tokenizer">
        {TOKENIZERS.map((x) => <SegmentedControlItem key={x.id} value={x.id}>{x.label}</SegmentedControlItem>)}
      </SegmentedControl>
      <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[13px] leading-6 text-primary">{SNIPPET}</pre>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ReadOut label="Bytes in the text" value={BYTES} />
        <ReadOut label="Tokens" value={t.tokens} />
        <ReadOut label="Loss per token" value={perToken.toFixed(3)} note="nats" />
        <ReadOut label="Bits per byte" value={bpb.toFixed(3)} tint="bg-tint-blue" />
      </div>
      <Small>Toy numbers: we fixed the model's total surprise on this snippet and only changed how the text is cut into tokens.</Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Demo 2: how big is the token budget? Totals from the Zhihu review.
// ---------------------------------------------------------------------
const BUDGETS = [
  { m: "Inkling 2 Small", tokens: 12.55, total: 594, active: 17, src: "TML (sum of H1 to H4)" },
  { m: "Nemotron 3 Ultra", tokens: 20, total: 550, active: null, src: "per the Zhihu review" },
  { m: "GLM-5", tokens: 28.5, total: 744, active: null, src: "per the Zhihu review" },
  { m: "GLM-5.3-Flash", tokens: 30, total: 320, active: 18, src: "\"over 30T\", per the Zhihu review" },
  { m: "DeepSeek-V4 Flash", tokens: 30, total: null, active: null, src: "\"over 30T\", per the Zhihu review" },
];

function BudgetDemo() {
  const [mode, setMode] = useState("tokens");
  const rows = BUDGETS.map((b) => ({ ...b, v: mode === "tokens" ? b.tokens : b.total ? (b.tokens * 1000) / b.total : null }));
  const max = Math.max(...rows.filter((r) => r.v != null).map((r) => r.v));
  return (
    <Demo title="How many tokens is 12.55T?"
      takeaway={mode === "tokens"
        ? "Inkling 2 Small has the smallest budget of the group. The two Flash models that use about as many parameters per token (17B to 18B) both report more than 30T."
        : "Per parameter, the gap is larger. Inkling 2 Small sees about 21 tokens per stored parameter; the other models with a known size see 36 to 94. A lower ratio leaves each weight less thoroughly fit, which may or may not be the point (see Part 3)."}>
      <SegmentedControl value={mode} onValueChange={(v) => v && setMode(v)} size="small" aria-label="Measure">
        <SegmentedControlItem value="tokens">Training tokens (T)</SegmentedControlItem>
        <SegmentedControlItem value="ratio">Tokens per total parameter</SegmentedControlItem>
      </SegmentedControl>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.m} className="flex items-center gap-3">
            <span className="w-[140px] shrink-0 text-[12.5px] leading-4 text-primary">{r.m}</span>
            <div className="relative h-[20px] grow rounded bg-wash">
              {r.v != null ? (
                <div className={"absolute left-0 top-0 h-full rounded " + (r.m === "Inkling 2 Small" ? "bg-[rgb(var(--text-blue))]" : "bg-[rgb(var(--text-secondary))] opacity-40")}
                  style={{ width: (100 * r.v) / max + "%" }} />
              ) : <span className="absolute left-2 top-0 text-[11.5px] leading-5 text-secondary">size not given</span>}
            </div>
            <span className="w-[52px] shrink-0 text-right font-mono text-[12.5px] text-primary">{r.v == null ? "–" : mode === "tokens" ? (r.m.includes("Flash") ? ">" : "") + r.v : Math.round(r.v)}</span>
          </div>
        ))}
      </div>
      <Small>
        Only the Inkling 2 Small total comes from Thinking Machines (8.4T + 3.8T + ~0.32T + ~0.034T). The others are the review's
        figures, and the two "over 30T" bars are drawn at 30T. Total sizes for GLM-5.3-Flash come from TML's benchmark table;
        the ratios are our arithmetic.
      </Small>
    </Demo>
  );
}

// ---------------------------------------------------------------------
// Results: held-out code bits per byte, from the launch post.
// ---------------------------------------------------------------------
const BPB = [
  { m: "GLM-5.3", how: "base-recovered", v: 0.2358 },
  { m: "DeepSeek V4 Pro Base", how: "base model", v: 0.2335 },
  { m: "GLM-5.3 Flash", how: "base-recovered", v: 0.2327 },
  { m: "DeepSeek V4.1 Flash 1017", how: "base-recovered", v: 0.2209 },
  { m: "Inkling 2 Small", how: "post-trained", v: 0.208, ours: true },
  { m: "Kimi K3.1 Pro", how: "base-recovered", v: 0.2068 },
  { m: "Inkling 2 Small", how: "pretrained", v: 0.203, ours: true },
];

function BpbChart() {
  const lo = 0.19, hi = 0.24;
  return (
    <div className="flex flex-col gap-2">
      {BPB.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex w-[170px] shrink-0 flex-col">
            <span className={"text-[12.5px] leading-4 " + (r.ours ? "font-semibold text-primary" : "text-primary")}>{r.m}</span>
            <span className="text-[11px] leading-4 text-secondary">{r.how}</span>
          </span>
          <div className="relative h-[20px] grow rounded bg-wash">
            <div className={"absolute left-0 top-0 h-full rounded " + (r.ours ? "bg-[rgb(var(--text-blue))]" : "bg-[rgb(var(--text-secondary))] opacity-40")}
              style={{ width: (100 * (r.v - lo)) / (hi - lo) + "%" }} />
          </div>
          <span className="w-[52px] shrink-0 text-right font-mono text-[12.5px] text-primary">{r.v.toFixed(4)}</span>
        </div>
      ))}
      <div className="flex justify-between pl-[182px] pr-[64px] text-[11px] text-secondary"><span>0.19</span><span>lower is better</span><span>0.24</span></div>
    </div>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col">
      <Stage step={1} title="Read broadly first, then read what matters">
        <P>
          A language model learns almost everything it knows during <Term def="Training the model to predict the next token of ordinary documents, at very large scale.">pretraining</Term>.
          Inkling 2 Small splits pretraining into two phases with different jobs. Thinking Machines names its training phases
          H1 to H4; the first two are pretraining proper, and the last two (<LessonLink to="midtrain" />) switch to agent
          trajectories.
        </P>
        <Steps items={[
          { title: "H1: a broad mix, 8.4T tokens", body: "Natural language, code and image data. This is where the model gets its general knowledge and its basic grasp of code and images. It ran for 68 hours on NVIDIA GB300 NVL72 racks, natively in the 4-bit NVFP4 format." },
          { title: "H2: newer, higher-quality data, 3.8T tokens", body: "Data the model had not seen in H1, chosen for quality and recency, and read at a 512K-token context so that long documents fit in one piece." },
        ]} />
        <P>
          The order matters. Early in training a model is still learning the basics, and the most useful data is simply varied
          data. Later, with the basics in place, each token of carefully chosen text teaches more, and long documents are worth
          their cost because the model can now use the extra context. Putting the newest data late also keeps the model's
          knowledge current, which matters most for code: libraries change every month.
        </P>
        <KeyIdea>
          Pretraining data is a <b>curriculum</b>, not a pile. The mix shifts from broad to selective, and from short contexts to
          very long ones, as training goes on.
        </KeyIdea>
        <H3>A small budget, maybe on purpose</H3>
        <P>
          Add up all four phases and Inkling 2 Small saw about 12.55T tokens. For a model with 594B parameters that is not a lot.
          The Zhihu review lists 20T for Nemotron 3 Ultra, 28.5T for GLM-5, and over 30T for two Flash models of similar per-token
          size.
        </P>
        <BudgetDemo />
        <P>
          Thinking Machines does not explain the size of the budget. It describes Inkling 2 Small as one rung of a "ladder" of
          models trained with similar recipes and predictable scaling, so the budget may simply be what this rung called for.
          The review suggests a second reason, which comes back in <LessonLink to="custom" />: a model that is pretrained for less
          long may stay easier to fine-tune.
        </P>
        <H3>What is in the mix</H3>
        <P>
          The launch post and model card give provenance and process, not proportions. The training data was drawn from publicly
          available sources (the public internet and public repositories), acquired from third parties, generated internally, or
          synthetically generated or augmented. It includes text, images and video. Cleaning varies by data type and "may include
          deduplication and filtering to remove junk or other low-quality data, or to advance safety or other objectives".
        </P>
        <Src>TML launch post, "Training Inkling 2 Small"; Inkling 2 Small model card, "Training data"; TML Training Data Documentation; budget comparisons per the Zhihu review</Src>
      </Stage>

      <Stage step={2} title="Measuring the data: bits per byte">
        <P>
          To judge a pretraining run, Thinking Machines measures how well the model predicts held-out text: code from an internal
          set labelled "Cutoff 2026-06" that none of the models trained on. The natural measure is the model's <Term def="The negative log-probability the model assigned to the token that actually came next. Lower means less surprised.">loss</Term> on
          that text. The problem is that loss is usually averaged per token, and every model family cuts text into tokens
          differently.
        </P>
        <BpbDemo />
        <P>
          The fix is to total the loss over the whole text and divide by the number of bytes instead of the number of tokens.
          Bytes are the same for every model, so the number means the same thing for all of them.
        </P>
        <Eq label="Bits per byte (standard definition, not from the post)">
          BPB = ( Σ<sub><V>t</V></sub> − ln <V>p</V><sub><V>θ</V></sub>( <V>x</V><sub><V>t</V></sub> | <V>x</V><sub>&lt;<V>t</V></sub> ) ) / ( ln 2 · <V>B</V> )
        </Eq>
        <Where items={[
          [<span><V>x</V><sub><V>t</V></sub></span>, "token t of the held-out text, cut by the model's own tokenizer"],
          [<span><V>p</V><sub><V>θ</V></sub></span>, "the probability the model gives that token given everything before it"],
          [<span><V>B</V></span>, "the number of bytes in the text, the same for every model"],
          ["ln 2", "converts nats (natural-log units) into bits"],
        ]} />
        <P>
          A score of 0.20 bits per byte means the model needs, on average, a fifth of a bit to encode each character of unseen
          code. A uniform guess over 256 byte values would need 8 bits.
        </P>
        <H3>Comparing against models that only ship post-trained</H3>
        <P>
          Most labs release only a post-trained model, and post-training changes how a model predicts ordinary documents. Comparing
          a base model with a chat model would be unfair. Thinking Machines therefore <b>base-recovers</b> those models: it briefly
          fine-tunes each one on pretrain-formatted code and documents, and only then measures. It checked the procedure on models
          whose real base checkpoint is public, and reports that it "mostly recovers" the base model's loss.
        </P>
        <Code>illustrative sketch, not TML code</Code>
        <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-5 text-primary">{`def bits_per_byte(model, docs):
    nats, nbytes = 0.0, 0
    for doc in docs:                       # held-out code, never trained on
        ids = model.tokenizer.encode(doc)
        logp = model.logprobs(ids)         # log p(x_t | x_<t) for every token
        nats += -sum(logp)
        nbytes += len(doc.encode("utf-8"))
    return nats / (math.log(2) * nbytes)

def score(released, base=None):
    if base is None:                       # only a post-trained checkpoint is public
        base = finetune(released, pretrain_formatted_code_and_docs)  # "base-recovered"
    return bits_per_byte(base, heldout_code)`}</pre>
        <Src>TML launch post, the "Internal Code" bits-per-byte figure and its caption</Src>
      </Stage>

      <Stage step={3} title="What the measurement showed">
        <Panel title="Held-out internal code (cutoff 2026-06), bits per byte"
          caption="Values from TML's launch post. Bars start at 0.19, so differences are magnified. Base-recovered models were briefly fine-tuned on pretrain-formatted data before measuring.">
          <BpbChart />
        </Panel>
        <Findings items={[
          <span>The pretrained Inkling 2 Small scores <b>0.2030</b>, below every other model in the figure, including Kimi K3.1 Pro (0.2068) and DeepSeek V4.1 Flash (0.2209).</span>,
          <span>The gap to the larger GLM-5.3 (0.2358) is 0.033 bits per byte, about 14% less surprise on the same code.</span>,
          <span>H1 got through 8.4T tokens in 68 hours, about 34M tokens per second across the cluster (our arithmetic).</span>,
        ]} />
        <Surprise title="Fewest tokens, lowest loss">
          Inkling 2 Small saw less than half the data of the Flash models it is compared with, yet predicts unseen code best. The
          comparison does not separate data quality from architecture or from the in-house code set, which may resemble
          Thinking Machines' own data more than other labs'. But it does show that a smaller, later-curated budget did not cost
          the model its fit to code.
        </Surprise>
        <Surprise title="All of post-training cost only 0.0050 bits per byte">
          After midtraining and nine days of RL, the released model scores 0.2080 against 0.2030 for the pretrained checkpoint. RL
          pushes a model hard toward its tasks, and some loss of fit to ordinary documents is expected. Here it is small enough
          that the post-trained model still beats every other base-recovered model except Kimi K3.1 Pro.
        </Surprise>
        <P>
          The second result is the one to carry into the rest of the tutorial. Post-training reshapes behavior, but in this run it
          left the knowledge of the pretrained model largely intact. Lessons 2 to 6 explain what that post-training did.
        </P>
        <Src>TML launch post, "Training Inkling 2 Small"; tokens-per-second is derived from the reported 8.4T tokens and 68 hours</Src>
      </Stage>
    </div>
  );
}
