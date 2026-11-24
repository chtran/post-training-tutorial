# Beam post-training, explained

A seven-lesson visual tutorial on the post-training pipeline of Reflection's Beam model, based on the
[Beam Model Technical Report](https://reflection.ai/documents/beam-model-tech-report), section 4 and section 7.2.

View it: https://chtran.github.io/post-training-tutorial/beam/

Each lesson goes intuition, then math and code, then experimental results with the surprising ones marked.
All figures are the report's own and were not independently verified. Equations, code sketches and demo
inputs that are not from the report are labelled as such in the lesson.

## Layout

- `index.html`: the compiled page that GitHub Pages serves.
- `src/shared.jsx`: shared components. `src/app.jsx`: navigation shell. `src/lessons/*.jsx`: one file per lesson.
- `src/build.py`: joins the sources into one JSX body, which is then compiled to `index.html` with the Devin artifact kit.
- `src/shots.py`: screenshots each lesson for review.
