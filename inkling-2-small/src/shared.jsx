// =====================================================================
// shared.jsx — the tutorial's design system. Lessons use these; they do
// not redefine them. Everything from the Devin artifact kit is in scope.
// =====================================================================
const NavContext = React.createContext({ go: () => {}, lessons: [] });
const useNav = () => React.useContext(NavContext);
const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";

// ---- text ----
const P = ({ children }) => <p className="text-[15px] leading-7 text-primary">{children}</p>;
const Lead = ({ children }) => <p className="text-[17px] leading-8 text-primary">{children}</p>;
const Small = ({ children }) => <p className="text-[12.5px] leading-5 text-secondary">{children}</p>;
const H3 = ({ children }) => <h3 className="pt-3 text-[16px] font-semibold leading-6 text-primary">{children}</h3>;
// A math variable: italic serif.
const V = ({ children }) => <span className="font-serif italic">{children}</span>;
// Inline code or identifier.
const Code = ({ children }) => <code className="rounded bg-wash px-1 py-[1px] font-mono text-[13px]">{children}</code>;
// A term with a hover definition. Use on first use of jargon.
function Term({ children, def }) {
  return (
    <Tooltip content={<span className="block max-w-[280px] text-[12px] leading-5">{def}</span>}>
      <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">{children}</span>
    </Tooltip>
  );
}
// Link to another lesson by id ("arch", "pretrain", "fp4", "rl", "infra", "align", "custom").
function LessonLink({ to, children }) {
  const { go, lessons } = useNav();
  const i = lessons.findIndex((l) => l.id === to);
  const label = children || (i > 0 ? "lesson " + i : "the map");
  return <Button variant="link" className="!inline !h-auto whitespace-nowrap !p-0 align-baseline !text-[length:inherit] !font-[inherit] !leading-[inherit] underline decoration-dotted underline-offset-4" onClick={() => go(to)}>{label}</Button>;
}

// ---- lesson structure ----
const STAGES = {
  1: { key: "intuition", label: "Intuition" },
  2: { key: "math", label: "Math and code" },
  3: { key: "results", label: "Results and findings" },
};
// The three parts of every lesson. step is 1, 2 or 3.
function Stage({ step, title, children }) {
  const s = STAGES[step];
  return (
    <section id={"stage-" + s.key} className="flex scroll-mt-6 flex-col gap-4 pt-10">
      <header className="flex flex-col gap-1 border-b border-primary pb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Part {step} · {s.label}</div>
        <h2 className="text-[21px] font-semibold leading-7 text-primary">{title}</h2>
      </header>
      {children}
    </section>
  );
}

// ---- blocks ----
// A bordered panel for a figure, table or chart. caption goes under the content.
function Panel({ title, caption, children }) {
  return (
    <Card><CardContent><CardBody className="flex flex-col gap-3">
      {title ? <Text size={13} weight="semibold">{title}</Text> : null}
      {children}
      {caption ? <Small>{caption}</Small> : null}
    </CardBody></CardContent></Card>
  );
}
// An interactive demo. takeaway is one or two sentences saying what to notice.
function Demo({ title, takeaway, children }) {
  return (
    <Card><CardContent><CardBody className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="blue">Try it</Badge>
        <Text size={13} weight="semibold">{title}</Text>
      </div>
      {children}
      {takeaway ? <Small>{takeaway}</Small> : null}
    </CardBody></CardContent></Card>
  );
}
// A displayed equation. label names it; note says where it comes from and what the symbols mean.
function Eq({ label, note, children }) {
  return (
    <figure className="rounded-lg bg-wash px-5 py-4">
      {label ? <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{label}</div> : null}
      <div className="overflow-x-auto whitespace-nowrap font-serif text-[17px] leading-9 text-primary">{children}</div>
      {note ? <figcaption className="pt-2 text-[12.5px] leading-5 text-secondary">{note}</figcaption> : null}
    </figure>
  );
}
// Symbol definitions under an equation: items is [[symbol, meaning], ...].
function Where({ items }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 px-1 text-[13.5px] leading-6">
      {items.map(([sym, meaning], i) => (
        <React.Fragment key={i}>
          <dt className="font-serif italic text-primary">{sym}</dt>
          <dd className="text-secondary">{meaning}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
// The one idea to hold on to from a passage.
function KeyIdea({ children }) {
  return (
    <div className="rounded-lg bg-tint-blue px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue">Key idea</div>
      <div className="text-[15px] leading-7 text-primary">{children}</div>
    </div>
  );
}
// A result that goes against expectation. title states it; the body gives the numbers.
function Surprise({ title, children }) {
  return (
    <div className="rounded-lg bg-tint-orange px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange">Surprising</div>
      <div className="text-[15px] font-semibold leading-7 text-primary">{title}</div>
      <div className="text-[14px] leading-6 text-primary">{children}</div>
    </div>
  );
}
// Plain bullet list of findings. items are strings or nodes.
function Findings({ items }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-7 text-primary">
      {items.map((s, i) => <li key={i}>{s}</li>)}
    </ul>
  );
}
// A numbered sequence: items is [{ title, body }].
function Steps({ items }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wash font-mono text-[12px] text-secondary">{i + 1}</span>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold leading-7 text-primary">{s.title}</span>
            <span className="text-[14px] leading-6 text-secondary">{s.body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
// A labelled range input.
function Slider({ label, value, min, max, step, onChange, fmt, labelWidth = 220 }) {
  return (
    <label className="flex items-center gap-3 text-[13px] text-primary">
      <span className="max-w-[45%] shrink-0 leading-5" style={{ width: labelWidth }}>{label}</span>
      <input type="range" className="grow" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-[60px] shrink-0 text-right font-mono">{fmt ? fmt(value) : value}</span>
    </label>
  );
}
// Where this part comes from, e.g. <Src>TML launch post, "Training Inkling 2 Small"</Src>.
const Src = ({ children }) => <Small>Source: {children}.</Small>;
