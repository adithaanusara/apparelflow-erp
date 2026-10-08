import { ACCENT, LogisticsAnimation } from "./logistics-animation";
import { MotionToggle } from "./motion-toggle";

// The branding side of the sign-in page: the product name, a short promise
// and an isometric loop of a bundle being verified and dispatched.

// The dots use the same accent colours as the animation above them.
const STEPS = [
  { dot: ACCENT.kraft, label: "Cut and bundled" },
  { dot: ACCENT.green, label: "Verified at the gate" },
  { dot: ACCENT.blue, label: "Loaded and released" },
];

export function LoginHero() {
  return (
    <header className="relative isolate overflow-hidden bg-slate-950 bg-linear-to-br from-slate-950 via-[#17284a] to-slate-950 bg-[length:260%_260%] text-white motion-safe:animate-gradient-pan lg:sticky lg:top-0 lg:h-screen lg:self-start">
      <Backdrop />

      {/* On wide screens the whole panel is pinned to the viewport (sticky on
          the header itself), so it stays in view while the sign-in column
          scrolls. The animation takes whatever height the text leaves. */}
      <div className="px-6 py-8 sm:px-10 lg:flex lg:h-full lg:flex-col lg:px-14 lg:py-10">
        <div className="flex items-center gap-3 motion-safe:animate-fade-in">
          <LogoMark />
          <p className="text-lg font-semibold tracking-tight">
            ApparelFlow ERP
          </p>
        </div>

        <div className="mt-6 max-w-xl lg:mt-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-blue-200 uppercase motion-safe:animate-rise">
            Cutting Operations &amp; Gatekeeper Verification
          </p>
          <h1 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance motion-safe:animate-rise motion-safe:[animation-delay:90ms] sm:text-4xl xl:roomy:text-5xl">
            Precision at the cutting table. Certainty on the sewing floor.
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-200 motion-safe:animate-rise motion-safe:[animation-delay:180ms]">
            Every batch is counted component by component and signed off by an
            authorized verifier before it is released to the Sewing Queue.
          </p>
        </div>

        <figure className="relative mt-6 hidden h-56 motion-safe:animate-fade-in motion-safe:[animation-delay:300ms] sm:block lg:hidden lg:h-auto lg:min-h-0 lg:flex-1 lg:tall:block">
          <LogisticsAnimation className="h-full w-full" />
          <div className="absolute right-0 bottom-0">
            <MotionToggle />
          </div>
        </figure>

        <ol className="mt-4 hidden flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200 motion-safe:animate-fade-in motion-safe:[animation-delay:500ms] sm:flex">
          {STEPS.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                style={{ backgroundColor: step.dot }}
                className="size-2.5 shrink-0 rounded-full"
              />
              <span>
                <span className="font-semibold text-white">{index + 1}.</span>{" "}
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/25 backdrop-blur"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path
          d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5v-11Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m8 12.2 2.7 2.7L16 9.6"
          className="stroke-blue-300"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// Soft drifting light and a faint grid behind the content.
function Backdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.045)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute -top-24 -left-20 size-80 rounded-full bg-blue-500/15 blur-3xl motion-safe:animate-float" />
      <div className="absolute right-[-6rem] bottom-[-4rem] size-96 rounded-full bg-blue-600/15 blur-3xl motion-safe:animate-float motion-safe:[animation-delay:-5s]" />
      <div className="absolute top-1/3 right-1/4 size-56 rounded-full bg-blue-400/10 blur-3xl motion-safe:animate-float motion-safe:[animation-delay:-8s]" />
    </div>
  );
}
