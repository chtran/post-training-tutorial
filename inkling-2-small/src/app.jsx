// =====================================================================
// app.jsx — shell: left navigation, lesson header, takeaways, pager.
// LESSONS is injected by build.py as [{ meta, Lesson }, ...] in order.
// =====================================================================
const NAV = LESSONS.map((l, i) => ({ ...l.meta, n: i, Lesson: l.Lesson }));

function NavItem({ l, active, seen, onClick }) {
  return (
    <Button variant="ghost" onClick={onClick} aria-current={active ? "page" : undefined}
      className={"!h-auto w-full !justify-start gap-2 !px-2 !py-[6px] text-left " + (active ? "bg-wash" : "")}>
      <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] " + (active ? "bg-elevated text-primary" : "text-secondary")}>
        {seen && !active ? <IconCheckmark2Medium size={12} /> : l.n === 0 ? "·" : l.n}
      </span>
      <span className={"text-[13px] leading-5 " + (active ? "font-semibold text-primary" : "text-secondary")}>{l.nav}</span>
    </Button>
  );
}

function Sidebar({ cur, seen, go, jump }) {
  return (
    <nav aria-label="Lessons" className="flex shrink-0 flex-col gap-1 md:sticky md:top-6 md:w-[212px] md:self-start">
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Lessons</div>
      {NAV.map((l) => (
        <React.Fragment key={l.id}>
          <NavItem l={l} active={l.id === cur} seen={seen.has(l.id)} onClick={() => go(l.id)} />
          {l.id === cur && l.n > 0 ? (
            <div className="ml-[18px] flex flex-col border-l border-primary pl-2">
              {[1, 2, 3].map((s) => (
                <Button key={s} variant="ghost" onClick={() => jump("stage-" + STAGES[s].key)}
                  className="!h-auto w-full !justify-start !px-2 !py-[3px] text-left text-[12px] text-secondary">
                  {STAGES[s].label}
                </Button>
              ))}
            </div>
          ) : null}
        </React.Fragment>
      ))}
      <div className="px-2 pt-3 text-[11.5px] leading-4 text-secondary">{seen.size - (seen.has("map") ? 1 : 0)} of {NAV.length - 1} lessons opened</div>
    </nav>
  );
}

function LessonHeader({ l }) {
  if (l.n === 0) return null;
  return (
    <header className="flex flex-col gap-2">
      <div className="text-[12px] font-medium text-secondary">Lesson {l.n} of {NAV.length - 1} · about {l.minutes} min</div>
      <h1 className="text-[28px] font-semibold leading-9 text-primary">{l.title}</h1>
      <p className="text-[17px] leading-8 text-secondary">{l.question}</p>
    </header>
  );
}

function Takeaways({ l }) {
  if (!l.takeaways || !l.takeaways.length) return null;
  return (
    <section className="mt-10 rounded-lg bg-wash px-5 py-4">
      <div className="pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Takeaways</div>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-7 text-primary">
        {l.takeaways.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
    </section>
  );
}

function Pager({ l, go }) {
  const prev = NAV[l.n - 1], next = NAV[l.n + 1];
  return (
    <div className="flex items-center justify-between gap-3 pt-8">
      {prev ? <Button variant="secondary" onClick={() => go(prev.id)}>Previous: {prev.nav}</Button> : <span />}
      {next ? <Button onClick={() => go(next.id)}>Next: {next.nav}</Button> : <span />}
    </div>
  );
}

function Tutorial() {
  const [cur, setCur] = useState("map");
  const [seen, setSeen] = useState(() => new Set(["map"]));
  const top = useRef(null);
  const go = (id) => {
    setCur(id);
    setSeen((s) => new Set(s).add(id));
    requestAnimationFrame(() => { window.scrollTo(0, 0); if (top.current) top.current.scrollIntoView(); });
  };
  const jump = (anchor) => { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const l = NAV.find((x) => x.id === cur);
  const nav = useMemo(() => ({ go, lessons: NAV }), []);
  return (
    <PageLayout title="Inkling 2 Small, explained" themeToggle
      subtitle="A seven-lesson tutorial on how Thinking Machines built Inkling 2 Small, from its pretraining data to one joint, asynchronous RL run.">
      <NavContext.Provider value={nav}>
        <div ref={top} className="flex flex-col gap-8 md:flex-row md:gap-10">
          <Sidebar cur={cur} seen={seen} go={go} jump={jump} />
          <main className="flex min-w-0 grow flex-col [&_td]:align-top">
            <LessonHeader l={l} />
            <l.Lesson key={l.id} />
            <Takeaways l={l} />
            <Pager l={l} go={go} />
            <Footnote>
              Sources: Thinking Machines Lab, "Introducing Inkling 2 Small" (thinkingmachines.ai/news/inkling-2-small), the Inkling 2 Small model card,
              "End-to-End 4-Bit Training" (Connectionism blog), the Tinker StableReinforce docs, the vLLM and SGLang day-0 posts, and an expert review by Sunt on Zhihu
              (zhuanlan.zhihu.com/p/2107214533513289893). Figures are the sources' own and were not independently verified; claims that come only from the review are marked as such.
              Interactive demos use made-up toy inputs to show a mechanism, and say so.
            </Footnote>
          </main>
        </div>
      </NavContext.Provider>
    </PageLayout>
  );
}
render(<Tutorial />);
