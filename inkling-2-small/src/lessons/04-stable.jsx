const meta = {
  id: "stable",
  nav: "StableReinforce",
  title: "StableReinforce: learning from samples 17 updates old",
  question: "When the model that wrote a rollout is not the model being trained, what goes wrong with the policy gradient, and what is the cheapest fix?",
  minutes: 14,
  takeaways: [
    "In asynchronous RL the sampler and the trainer never quite agree: the sampler's weights are stale (17 updates, at the median, in this run) and its numerics differ. This is the training-inference mismatch.",
    "Under mismatch the policy-gradient update splits into a signal term, the covariance of reward and score, and a drift term that depends only on the average reward. Drift distills the trainer toward the sampler at every prefix.",
    "Because the sampler is refreshed from the trainer, drift feeds back on itself and compounds instead of converging. Centering rewards within a group shrinks drift but does not remove it.",
    "Score centering subtracts, at every token, the expected score under the sampler. The drift term becomes exactly zero; the cost is storing a little of the sampler's distribution. StableReinforce, Tinker's loss and the one used for Inkling 2 Small, is a variant of it.",
    "Tinker adds a small sampler-learner KL term (coefficient 0.01 by default). The cookbook never discards stale data: it trains the oldest groups first.",
  ],
};

// ---------------------------------------------------------------------
// Demo: drift with no reward signal (toy, three-token vocabulary).
// ---------------------------------------------------------------------
const softmax = (z) => { const m = Math.max(...z); const e = z.map((x) => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
const BIAS = [0.0, 0.5, -0.5];

function simulate(gap, centered, steps = 300, lr = 0.5, R = 0.6) {
  let th = [0.4, 0, -0.4];
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const p = softmax(th);
    if (k % 5 === 0) out.push({ k, p1: +(p[1] * 100).toFixed(2) });
    const q = softmax(th.map((x, i) => x + gap * BIAS[i]));
    // E_q[R * grad log p(y)] in logit space is R * (q - p); centering subtracts E_q[grad log p] = q - p.
    const g = centered ? [0, 0, 0] : q.map((qi, i) => R * (qi - p[i]));
    th = th.map((x, i) => x + lr * g[i]);
  }
  return out;
}

function DriftDemo() {
  const [gap, setGap] = useState(0.2);
  const van = simulate(gap, false), sc = simulate(gap, true);
  const data = van.map((v, i) => ({ k: v.k, van: v.p1, sc: sc[i].p1 }));
  const end = data[data.length - 1];
  return (
    <Demo title="Every rollout scores the same, and the policy still moves"
      takeaway={gap === 0
        ? "With no mismatch the sampler is the trainer, the expected score is zero, and neither update moves the policy. That is the on-policy guarantee."
        : "Every rollout gets reward 0.6, so there is nothing to learn. The vanilla update still raises token B from " + data[0].van.toFixed(1) + "% to " + end.van.toFixed(1) + "% because the sampler slightly favours it, and each refresh of the sampler restarts the push. The score-centred update stays at " + end.sc.toFixed(1) + "%."}>
      <Slider label="Sampler-trainer mismatch" value={gap} min={0} max={0.6} step={0.05} onChange={setGap} fmt={(v) => v.toFixed(2)} />
      <ChartContainer config={{ van: { label: "Vanilla policy gradient", color: chartColors[0] }, sc: { label: "Score-centred", color: chartColors[1] } }} style={{ height: 220, width: "100%" }}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <ChartGrid /><ChartXAxis dataKey="k" type="number" domain={[0, 300]} ticks={[0, 100, 200, 300]} /><ChartYAxis title="p(token B) %" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
          <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
          <ChartLine dataKey="van" dot={false} isAnimationActive={false} />
          <ChartLine dataKey="sc" dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <div className="-mt-1 text-center text-[12px] text-secondary">Training steps</div>
      <Small>
        Toy model: one prefix, three possible next tokens, exact expected updates, constant reward 0.6. The sampler sees the
        trainer's logits plus a fixed bias (standing in for quantization or staleness) and is refreshed after every step.
      </Small>
    </Demo>
  );
}

function Lesson() {
  return (
    <div className="flex flex-col">
      <Stage step={1} title="The sampler is never quite the trainer">
        <P>
          RL for language models runs two copies of the model. The <b>sampler</b> generates rollouts as fast as possible, using
          inference kernels and, here, 4-bit numerics. The <b>trainer</b> recomputes the probability of every sampled token and
          takes the gradient. In theory the two are the same model. In practice they disagree a little, which is called the <Term def="Any difference between the distribution the sampler drew from and the distribution the trainer computes, for the same context: different kernels, different precision, or older weights.">training-inference mismatch</Term>.
        </P>
        <P>
          Inkling 2 Small makes the mismatch large on purpose. The run is asynchronous: samplers keep generating while the trainer
          updates, so a rollout that took four hours was written by weights that are many updates old. The median <Term def="The number of trainer updates between the weights that produced a rollout and the weights it is trained into.">staleness</Term> was
          <b> 17 updates</b>. Waiting for every rollout to finish would leave most GPUs idle behind the slowest one.
        </P>
        <P>
          The surprising part, from the score-centering paper that StableReinforce builds on, is that the harm does not come mainly
          from noise. It comes from a <b>bias</b> that points the same way at every step. Every rollout carries a small pull toward
          the sampler, independent of whether it succeeded. The trainer moves toward the sampler, the sampler is then refreshed
          from the trainer and is again slightly off in the same direction, and the error compounds.
        </P>
        <DriftDemo />
        <KeyIdea>
          Off-policy RL has a <b>drift</b> problem before it has a variance problem. Fix the drift and most of the instability
          goes away.
        </KeyIdea>
        <Src>TML launch post, "Stable training" table; Marek and Ryabinin, "Score Centering Stabilizes Off-policy Reinforcement Learning" (Together AI, arXiv 2609.20807), section 3</Src>
      </Stage>

      <Stage step={2} title="Drift, signal, and score centering">
        <P>
          Fix one prefix, the text so far. The trainer's <Term def="The gradient of the log-probability of a token with respect to the weights. Policy gradient multiplies it by the reward.">score</Term> for
          token <V>y</V> is <V>s</V><sub><V>y</V></sub> = ∇<sub><V>θ</V></sub> log <V>p</V><sub><V>θ</V></sub>(<V>y</V>). Tokens are drawn
          from the sampler <V>q</V>. Splitting an expectation of a product into product of expectations plus covariance gives:
        </P>
        <Eq label="Policy-gradient update at one prefix (paper, equation 3)">
          𝔼<sub><V>q</V></sub>[ <V>R</V> <V>s</V><sub><V>y</V></sub> ] = 𝔼<sub><V>q</V></sub>[ <V>R</V> ] · <V>s̄</V> &nbsp;+&nbsp; Cov<sub><V>q</V></sub>( <V>R</V>, <V>s</V><sub><V>y</V></sub> ),&nbsp;&nbsp; <V>s̄</V> = 𝔼<sub><V>y</V>∼<V>q</V></sub>[ <V>s</V><sub><V>y</V></sub> ]
        </Eq>
        <Where items={[
          [<V>R</V>, "the reward (or advantage) of the rollout this token belongs to"],
          [<span><V>s</V><sub><V>y</V></sub></span>, "the trainer's score for token y"],
          [<V>s̄</V>, "the expected score when tokens come from the sampler q. It is exactly zero when q = p, and not otherwise"],
          ["first term", "drift: it depends on the rewards only through their mean, so it carries no information about which tokens were good"],
          ["second term", "signal: the covariance of reward with score, which is what policy gradient is supposed to follow"],
        ]} />
        <P>
          The drift direction <V>s̄</V> is the negative gradient of the cross-entropy against the sampler, so the first term is
          literally SFT toward the sampler, weighted by the prefix's expected reward. Centring rewards within a group (as GRPO does)
          does not cancel it: it makes advantages average to zero over a task, but not at each prefix. A prefix that is on track to
          succeed has positive expected advantage, and one that already contains a mistake has negative.
        </P>
        <P>
          Score centering removes the drift directly, by subtracting the expected score from every score:
        </P>
        <Eq label="Centred score (paper, equations 4 and 5)">
          <V>s̃</V><sub><V>y</V></sub> = <V>s</V><sub><V>y</V></sub> − <V>s̄</V> &nbsp;⇒&nbsp; 𝔼<sub><V>q</V></sub>[ <V>R</V> <V>s̃</V><sub><V>y</V></sub> ] = Cov<sub><V>q</V></sub>( <V>R</V>, <V>s</V><sub><V>y</V></sub> )
        </Eq>
        <P>
          Only the signal is left. Unlike importance sampling, the correction is additive and the same for every token at the
          prefix, so it adds no variance and needs no clipping. When sampler and trainer agree it is exactly zero.
        </P>
        <H3>Making it affordable</H3>
        <P>
          Computing <V>s̄</V> exactly needs the sampler's whole next-token distribution at every position. The paper stores only the
          sampler's top 128 log-probabilities and fills in the tail with the trainer's, rescaled to the sampler's tail mass. It
          writes the result as a scalar loss whose gradient is the centred update:
        </P>
        <Eq label="Score-centering loss for one token (paper, equation 8)">
          <V>L</V> = − <V>R</V> ( log <V>p</V><sub><V>y</V></sub> − Σ<sub><V>v</V> ∈ <V>H</V></sub> sg[ <V>q</V><sub><V>v</V></sub> − <V>ρ</V> <V>p</V><sub><V>v</V></sub> ] log <V>p</V><sub><V>v</V></sub> )
        </Eq>
        <Where items={[
          [<V>H</V>, "the sampler's top-k tokens at this position (k = 128 in the paper; k = 32 also matched exact centering)"],
          [<V>ρ</V>, "the sampler's tail mass divided by the trainer's tail mass"],
          ["sg[·]", "stop-gradient: the bracket is treated as a constant weight"],
        ]} />
        <Code>from the paper's reference snippet (JAX)</Code>
        <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-5 text-primary">{`def score_centering_loss(train_logp, samp_logp, topk_ids, sampled_token, advantage):
    train_head_logp = train_logp[topk_ids]
    tail_mass_ratio = (1 - jnp.exp(samp_logp).sum()) / (1 - jnp.exp(train_head_logp).sum())
    head_prob_residual = jnp.exp(samp_logp) - tail_mass_ratio * jnp.exp(train_head_logp)
    logp_correction = (stop_gradient(head_prob_residual) * train_head_logp).sum()
    return -advantage * (train_logp[sampled_token] - logp_correction)`}</pre>
        <H3>StableReinforce in Tinker</H3>
        <P>
          Thinking Machines calls its version StableReinforce, "a score centering variant", and ships it in Tinker as
          the <Code>stable_reinforce</Code> loss (in alpha). Sampling must record "stability info", and each training datum names
          the sampled sequence behind its tokens, so the trainer can look up what it needs about the sampler.
        </P>
        <Code>from the Tinker docs</Code>
        <pre className="overflow-x-auto rounded-lg bg-wash px-4 py-3 font-mono text-[12.5px] leading-5 text-primary">{`sampling_client = await training_client.save_weights_and_get_sampling_client(
    record_stability_info=True)
response = await sampling_client.sample(prompt=prompt, sampling_params=params, num_samples=4)
seq_id = response.sequences[0].sequence_id     # names this sequence in a training request

future = training_client.forward_backward(
    data, loss_fn="stable_reinforce", loss_fn_config={"kl_coeff": 0.01})`}</pre>
        <P>
          Two further details. First, the loss also contains a plain <b>sampler-learner KL</b> term, not a KL to a reference model,
          with coefficient 0.01 by default. Its k1 estimator raises the learner's probability of every sampled token regardless of
          advantage, keeping the learner near the sampler; a k3 estimator is offered too. Second, the docs do not say how the
          expected score is estimated. Per the Zhihu review, a third-party analysis of Tinker found that it draws 8 tokens from
          the sampler and averages their scores: unbiased, noisier than top-128, and much cheaper to store.
        </P>
        <P>
          Staleness is handled in the cookbook's async loop, the one the launch post links to. A cap on how far sampling may run
          ahead of training is set by <Code>max_steps_off_policy</Code>, but finished groups are never thrown away for being stale:
          each batch takes the groups sampled from the oldest weights first, so a slow rollout is trained when it finishes.
        </P>
        <Src>Paper section 4.1; Tinker docs, "StableReinforce (alpha)"; Tinker Cookbook rl/train.py, AsyncConfig; the 8-sample estimator is per the Zhihu review</Src>
      </Stage>

      <Stage step={3} title="What it bought">
        <Findings items={[
          <span>The main run trained stably for 1,075 steps with median staleness of 17 updates, rollouts up to 1.5M tokens, and 4-bit sampling, with reward rising log-linearly throughout (<LessonLink to="rl" />).</span>,
          <span>The Tinker docs describe the loss as having "led to extremely stable training, even under highly off-policy async RL and low precision numerics" in Thinking Machines' internal post-training.</span>,
          <span>In the paper, on models from 0.6B to 30B parameters, score centering alone matched or beat importance-sampling methods under quantized samplers, and the gap grew as the mismatch grew.</span>,
          <span>Under staleness, the paper's best results came from score centering combined with truncated or masked importance sampling, rather than from either alone.</span>,
        ]} />
        <Surprise title="The bias, not the variance, is what breaks off-policy RL">
          The usual story is that stale samples are noisy and need importance weights. The paper's account is that importance
          weights do cancel drift, but implementations clip or mask large weights for stability, and clipping puts drift back.
          Removing the drift with a deterministic, per-prefix correction stabilizes training without the extra variance.
        </Surprise>
        <Surprise title="All-positive rewards are stable offline and unstable online">
          With 0/1 rewards and a fixed sampler, policy gradient is just SFT on the successful rollouts and is perfectly stable. Let
          the sampler be refreshed from the trainer, and the same setup becomes the least stable, because drift (proportional to
          the mean reward) is largest when every reward is positive. Group-centred rewards are the most stable online setting,
          because they shrink the mean.
        </Surprise>
        <P>
          The Zhihu review notes a caveat. Holding steady at a median staleness of 17 could mean the algorithm truly tolerates long
          tails of staleness, or that the run simply did not contain many extremely long tasks. Thinking Machines' figures cannot
          tell the two apart.
        </P>
        <Src>TML launch post; Tinker docs; paper sections 3 and 5 and figures 2 to 4; Zhihu review, post-training section</Src>
      </Stage>
    </div>
  );
}
