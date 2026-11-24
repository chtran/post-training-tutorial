# post-training-tutorial

Visual, interactive tutorials on LLM post-training pipelines. Site: https://chtran.github.io/post-training-tutorial/

| Tutorial | Path | Based on |
| --- | --- | --- |
| Beam post-training, explained | [`beam/`](beam/) | Reflection AI, Beam Model Technical Report |
| Inkling 2 Small, explained | [`inkling-2-small/`](inkling-2-small/) | Thinking Machines Lab launch post, model card and Tinker docs, with the Zhihu expert review |

Each tutorial is a single self-contained `index.html`, built from JSX sources in its `src/`:

```bash
cd inkling-2-small/src && python3 build.py   # writes ../body.html
# compile body.html to ../index.html with the Devin artifact kit, then:
python3 shots.py ../index.html /tmp/shots --width 1280   # screenshots + console-error check
```

The landing page source is `landing/body.html`, compiled to `/index.html`.
