# Inkling 2 Small tutorial plan (session b2215583)
Repo: ~/repos/post-training-tutorial (chtran/post-training-tutorial, public, Pages to be enabled by user: main / root)
Layout: / landing page (links Beam + Inkling) ; /beam/ (copy of beam-post-training-tutorial index.html + src/) ; /inkling-2-small/ (index.html + src/)
Format/taste (from Beam session bf3b45ab): Devin artifact kit JSX, left sidebar nav, map page + lessons; each lesson = Part 1 Intuition, Part 2 Math and code, Part 3 Results and findings (surprises in orange), takeaways box; terms defined on first use (Term tooltip), symbols listed under equations, small interactive toy demos labelled as toy; label anything not from sources (textbook equations, illustrative code). Natural, easy-to-follow prose; top-grade front end; light/dark/narrow ok.
Sources in ~/inkling/sources (full_*.txt = full page text via playwright): TML intro news, model card, 4-bit blog, vLLM blog, HF README, SGLang cookbook, Tinker StableReinforce doc, Inkling 1 intro, Inkling 2 Mini, OPD blog, zhihu.txt (expert review by Sunt, Chinese).
Lessons:
0 map
1 arch: architecture & information flow (no RoPE relative attention, SWA:FA 5:1, Dynamic ShortConv, Block AttnRes 8x6, dynamic attention sink, gated attn, L2 clip QK, V RMSNorm, weight norm, softcapped SwiGLU 4/25, logit softcap 30, no shared expert, 384e top8, ViT 292M Perception Encoder, DSpark 5-layer drafter 7 tokens)
2 pretrain: H1 8.4T NVFP4 68h GB300 -> H2 3.8T 512K -> H3 ~320B traj 1M + replay -> H4 ~34B agent traj; Kimi K3 trajectories; BPB 0.2030 pre / 0.2080 post; base-recovered method; scaling ladder; total 12.55T low vs peers
3 fp4: end-to-end 4-bit training (NVFP4 fwd experts, MXFP8 bwd re-quant + stochastic rounding, Four Over Six, RHT combine, 8%/20% speedups)
4 rl: joint RL + StableReinforce score centering, staleness 17, task mix, graders, effort + length penalty, compaction, log-linear reward vs FLOPs
5 infra: RL systems (5:3 sampler:trainer, sticky routing, DRAM KV offload 93% prefix hit, CUDA graphs, GPUDirect RDMA weight transfer, NVFP4 KV cache, monitoring)
6 align: alignment & safety (success-at-any-cost, midtrain filtering, alignment reward, reward giving up, conduct-spec OPSD, sync/async monitors, network-block incident, evals table, HoneyBench)
7 custom: customizability & capabilities (finetunability eval 75 steps, flatness hypothesis, autoresearch Qwen3.5-4B demo, Terminal-Bench v2.1 vs v4.0, harness sensitivity, omniscience abstention, limitations)
