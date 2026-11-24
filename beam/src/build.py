#!/usr/bin/env python3
"""Assemble src/shared.jsx + src/lessons/*.jsx + src/app.jsx into body.html.

Each lesson file defines `const meta = {...}` and `function Lesson() {...}`.
It is wrapped in its own scope, so top-level names never collide between lessons.
Usage: python3 build.py [only-these-lesson-ids ...]   e.g. python3 build.py map rl
"""
import glob, os, sys
here = os.path.dirname(os.path.abspath(__file__))
only = set(sys.argv[1:])
parts = [open(os.path.join(here, "shared.jsx")).read()]
names = []
for path in sorted(glob.glob(os.path.join(here, "lessons", "*.jsx"))):
    key = os.path.basename(path)[:-4].split("-", 1)[1]
    if only and key not in only:
        continue
    src = open(path).read()
    parts.append(f"const L_{key} = (() => {{\n{src}\nreturn {{ meta, Lesson }};\n}})();")
    names.append(f"L_{key}")
parts.append("const LESSONS = [" + ", ".join(names) + "];")
parts.append(open(os.path.join(here, "app.jsx")).read())
out = os.path.join(here, "..", "body.html")
open(out, "w").write('<div id="root"></div>\n<script type="text/jsx">\n' + "\n\n".join(parts) + "\n</script>\n")
print("wrote", os.path.abspath(out), "with lessons:", ", ".join(names))
