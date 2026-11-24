# Inkling 2 Small, explained

A seven-lesson visual tutorial on how Thinking Machines Lab trained Inkling 2 Small, limited to pretraining data and
post-training: H1–H2 pretraining data, H3–H4 midtraining on agent trajectories, the joint RL run (task mix, graders,
effort and length), StableReinforce under staleness, long-horizon rollouts and their infrastructure, alignment inside the
run, and customizability and results.

View it: https://chtran.github.io/post-training-tutorial/inkling-2-small/

Facts come from TML's launch post, model card, training-data documentation and Tinker docs, and from the score-centering
paper (arXiv 2609.20807). Claims that appear only in the Zhihu expert review are labelled "per the Zhihu review". Toy demos,
illustrative equations and code sketches are labelled as such. Snapshots of the sources are in `sources/`.

Layout is the same as `beam/`: `src/shared.jsx` (components), `src/app.jsx` (navigation), `src/lessons/*.jsx` (one per
lesson), `src/build.py` (joins them into `body.html`), `src/shots.py` (screenshots).
