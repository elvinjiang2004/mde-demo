# Mechanism Design Explorer: Multi-Module Project Plan

Status: first-price reference module established; second-price functional demo
implemented; both modules available from the Auctions menu with a shared
translated-and-scaled Beta value distribution. Alpha = beta = 1 is the default
uniform case. Local MathJax 4 renders mathematics in ordinary HTML while the
custom interactive SVG labels remain plain text. A third module, the
Myerson-Satterthwaite Theorem, is now implemented under a Bilateral Trade
menu category: the learner paints a q(v,c) allocation rule on a paintable
control grid, and Bayesian (interim) IC monotonicity, minimal-rent envelope
transfers, induced budget balance, and efficiency all update live from that
painted grid under fixed Uniform[0,1] buyer and seller type distributions.
The General Topics category now holds two modules. The fourth module was
originally built and titled "The Envelope Theorem," using a single-agent
allocation curve Q(v) (up to nine draggable control points, interpolated by
a monotone cubic Hermite spline) to derive a payment rule and a live
global-IC diagnostic; at the user's direction that module has been
relabeled "Payments from an Allocation Rule (draft)," marked work in
progress, and moved to general-topics/payments-from-allocation-rule/, since
its actual content -- a mechanism-design worked example with an IC/IR
framing -- turned out to be a special case rather than the general theorem
itself, and its final home is still unresolved (it may become the seed of a
future revenue-equivalence or optimal-auction module). The "Envelope
Theorem" name and general-topics/envelope-theorem/ slot were freed and are
now occupied by a fifth, separate module that visualizes Theorem 2 of
Milgrom and Segal's "Envelope Theorems for Arbitrary Choice Sets"
(Econometrica 70(2), 2002: 583-601) directly and in general form, with no
mechanism-design/IC framing at all: the learner drags a small,
letter-labeled family of straight lines (three by default, up to eight)
within a plot fixed to [0,1] on both axes, with either point of a line
draggable onto any of the plot's four edges (not only the two vertical
ones), so a line's own t-domain can be squeezed arbitrarily narrow to make
its slope arbitrarily steep without either axis ever moving; their exact
upper envelope V(t), its active slope f_t(x*(t),t) as a step function, and
the steepest slope currently required to dominate the family all update
live. See section 6c for the draft module's continued documentation and
section 6d for the new general module.

## 1. Direction

The project is a collection of textbook-style interactive mechanism-design
modules. EconGraphs remains the main interaction reference. Each module should
focus on one economic question and let the learner manipulate one central
choice while linked graphs update continuously.

The first-price IPV module has established the project's preferred style. The
project is now moving from a single prototype to a small module library. This
does not yet justify a framework or a generalized component system.

## 2. Text authorship workflow

The user will write all visible introductory and explanatory teaching text for
new modules. The implementation workflow is:

1. The economic setting and intended interaction are identified.
2. The assistant supplies only a broad outline of the page sections and the
   function of each section.
3. The user supplies the actual prose.
4. The assistant implements that prose without independently expanding or
   replacing it.

The assistant may create functional interface labels, accessibility text,
validation messages, and navigation statuses. It should not independently
write model exposition, interpretation, derivations, source summaries, or
pedagogical paragraphs for the public page.

Adding a new model choice, including a distribution, does not alter this rule.
If the implemented choice needs lesson text, the assistant provides only a
broad structural outline and waits for the user to supply the wording.

Broad text outline for each module:

1. Title.
2. Economic environment and assumptions.
3. Focal learner, controlled choice, fixed opponent behavior, and solution
   concept.
4. Strategy or theoretical benchmark required to interpret the figure.
5. Interactive figure and controls.
6. Derivation or formal analysis.
7. Notes containing user-supplied bulleted entries.
8. References containing bibliographic citations.

Items 1-4 and 6-9 are locations for user-authored copy, not drafts to be filled
automatically. Each current auction page keeps its Notes list empty except for a
nonvisible comment showing where user-authored list items belong. The
user-requested Krishna citation appears in a separate References list.

Mathematical typesetting does not change this authorship workflow. Existing or
user-supplied mathematics may be marked up with `\(...\)` for inline math and
`\[...\]` for display math without changing the surrounding prose. Dollar-sign
delimiters are not used.

## 3. Main menu and module organization

The root index.html is the module menu. Modules are grouped into rows by
category, like a small app library.

Current menu state:

- Category: Auctions.
- Available: First-Price Auction Equilibrium.
- Available: Second-Price Auction Equilibrium.
- Category: Bilateral Trade.
- Available: Myerson-Satterthwaite Theorem.
- Category: General Topics.
- Available: The Envelope Theorem.
- Available: Payments from an Allocation Rule (draft).

The menu uses lightweight rectangular selections with square corners, simple
borders, titles, and availability statuses. It contains no theoretical module
summaries unless the user supplies them. An unfinished module must not be a
clickable dead end. "Payments from an Allocation Rule (draft)" is not an
unfinished/dead-end tile in that sense -- it is a fully working module whose
final scope and category placement are simply still undecided, so it stays
listed and clickable with "(draft)" in its own title rather than being
hidden.

Use explicit file paths so the site works when opened directly through file://:

    index.html
    auctions/first-price/index.html
    auctions/second-price/index.html
    bilateral-trade/myerson-satterthwaite-theorem/index.html
    general-topics/envelope-theorem/index.html
    general-topics/payments-from-allocation-rule/index.html

## 4. Established reusable module pattern

The following choices from the first-price module carry forward:

- plain white page;
- Times New Roman for body text, controls, and SVG labels;
- ordinary textbook headings rather than editorial or promotional phrases;
- sparse boxes and separators;
- page-level rules only at the introduction-to-demo and demo-to-derivation
  boundaries, plus a faint rule before Notes. On the auction pages the
  introduction-to-demo rule comes from `.model-specifications`'s own
  `border-top` (that section sits between the introduction and the demo).
  A module without a `.model-specifications` section — bilateral-trade,
  which has no adjustable shape controls — has nothing to carry that rule,
  so it applies the shared `.explorable-divider` modifier class (in
  `styles.css`, under the "Bilateral-trade module" section) to reproduce
  the identical top margin/padding/border-top values on `.explorable`
  itself, keeping the rule's spacing consistent across all three modules;
  give any future shape-control-free module the same class;
- the site header/footer and the auction pages' Beta-shape parameter row
  (bidder count, support bounds, alpha/beta sliders, PDF-of-Value preview)
  are rendered by shared `<page-header>`/`<page-footer>`/
  `<model-parameter-controls>` custom elements (js/components.js), at the
  user's direction, rather than copy-pasted into every module's index.html;
  see "6b. Shared page components" and AGENTS.md's "Multi-module
  architecture" for the design (light DOM, no shadow root; native
  `<header>`/`<footer>`/`<section>` wrappers kept hand-written for
  landmark semantics and CSS targeting; only the markup that actually
  duplicated goes inside the custom element); give any new module the same
  elements rather than hand-writing this markup again;
- n, a, b, alpha, beta, and the live value-PDF preview in one compact horizontal
  and top-aligned parameter row above the graph whenever width permits;
- modest vertical gaps between the parameter row and panels and below the
  interactive figure;
- introductory equilibrium displays set at ordinary body-text size;
- a large responsive SVG as the dominant visual object;
- learner-specific choices to the right of the graph on wide screens and below
  it on narrow screens;
- synchronized number inputs and sliders;
- no distribution selector: Beta shape controls are always visible and default
  to alpha = beta = 1;
- a compact live "PDF of Value" figure at the right of the same parameter row
  on wide screens, with its caption aligned to the plotted PDF area and the row
  reflowing on narrow screens;
- no separate value-distribution equation below the model-parameter row;
- direct graph dragging and keyboard control when useful;
- direct graph dragging clamped exactly to a and b when the pointer leaves the
  plot horizontally;
- immediate deterministic updates without a Run button;
- direct labels instead of legends;
- local MathJax rendering for mathematics in ordinary HTML, with custom graph
  SVG labels kept as Unicode/plain text and excluded from MathJax targets;
- metrics placed in or beside their graphical objects instead of separate
  results cards;
- an always-visible probability annotation in the first panel, a full
  axis-anchored "Probability of winning = [number]" guide label in the second
  panel, and one always-visible expected-payoff annotation, with no metrics
  beside panel titles;
- first-panel probability and second-panel payoff annotations anchored near the
  selected in-graph bid control when they move outside their colored areas;
- dynamic SVG labels that wrap before being suppressed and use halos where
  needed;
- restrained, consistent colors supplemented by shapes, line styles, and text;
- quiet reset and random-draw controls; and
- accessible titles, descriptions, live summaries, focus states, and
  responsive layouts.

The plot content remains mechanism-specific. The second-price module reuses the
page rhythm and interaction quality without copying the first-price module's
payoff rectangle or payment representation.

Across both current modules, finite support endpoints satisfy 0 <= a < b.
Focal values and proposed bids both use [a,b]. The common distribution is

    Value = a + (b-a)Z, where Z ~ Beta(alpha,beta),

with alpha and beta independently adjustable on [0.2,10]. The default
alpha = beta = 1 reproduces Uniform[a,b]. Random-value buttons draw from the
current distribution through its quantile function. Shape choices with
endpoint-singular densities remain supported, but every rendered SVG
coordinate must be finite.

## 5. First-price reference module

### Purpose

The existing module examines a focal bidder's proposed bid when all opponents
use the symmetric Bayes-Nash equilibrium of an iid private-values first-price
auction.

### Implemented scope

- n selectable risk-neutral bidders, n >= 2;
- iid translated-and-scaled Beta values, with Beta(1,1) as the uniform default;
- editable finite support endpoints satisfying 0 <= a < b;
- Beta alpha and beta shape controls on [0.2,10];
- focal private value v_1 and proposed bid x_1;
- both focal choices constrained to [a,b];
- synchronized typed inputs, sliders, graph dragging, and keyboard control;
- random private-value draw and reset;
- exact Uniform shortcuts and deterministic numerical integration and inversion
  for general Beta cases, rather than simulation; and
- direct file operation without installation or a server.

The user-authored first-price section "Optimal bid for bidder 1" uses the
opponent-maximum CDF \(G(y)=F(y)^{n-1}\), so it applies to every supported
continuous Beta shape and remains visible as the shape parameters change. The
assistant does not replace or expand that lesson prose without the user's text.

### Reference visual

The first panel is titled "PDF of highest opposing bid," with no beta expression
in its title, and shades the probability of winning. The second uses winning
probability as the vertical coordinate and a bid-to-value rectangle whose
signed area is expected payoff. It includes the selected bid, focal value,
equilibrium marker labeled "beta^I(v_1) = [number]," probability guide,
payoff-if-win bracket, and direct metrics.

The first panel retains its probability annotation. In the second panel, the
y-axis title is removed and the selected-point guide reads "Probability of
winning = [number]" at the probability axis rather than near the selected bid.
This is intentional repetition across the two panels, not a title-row metric.
The first-panel probability label moves beside the selected-bid marker if
either width or height is insufficient, preferring the marker's right side and
flipping left near the plot boundary. Expected payoff appears once and leaves
its rectangle only when the rectangle is too narrow; insufficient height alone
does not dislodge it. The expected-payoff annotation remains anchored near the
selected bid when outside its colored area. No metric is placed beside a panel
title.

These objects are retained as the first-price regression contract. They are not
the default diagram for every auction format.

### Regression requirements

- Probability remains in [0,1], increases weakly with x_1, and reaches one at
  beta^I(b).
- Payment conditional on winning equals x_1.
- Expected payoff is maximized at beta^I(v_1).
- Density area and CDF height agree.
- The payoff rectangle's signed area agrees with the model function.
- Beta(1,1) agrees with Uniform for the same support and bidder count.
- Endpoint-singular Beta shapes produce finite SVG coordinates.
- No supported parameter combination renders NaN or Infinity in the interface.
- Labels remain within the SVG at desktop and compact widths.
- Both probability readouts and expected payoff remain visible at zero, one,
  narrow, and negative states without title-row metrics.
- The first-price model and interface browser suites continue to pass after
  menu or shared-style changes.

## 6. Module 02: second-price IPV best response

### Implemented scope

The functional demo uses n risk-neutral bidders with iid values from the
translated-and-scaled Beta distribution on [a,b], where 0 <= a < b. The
default alpha = beta = 1 is uniform. The n - 1 opponents bid truthfully,
beta^II(v) = v. The focal bidder chooses x_1 in [a,b] for a displayed value v_1
in [a,b]. Bidder count, support bounds, Beta shapes, value, and bid are
interactive; the
number inputs, sliders, graph dragging, keyboard controls, random value draw,
and reset remain synchronized. Invalid bound edits revert to the last valid
support, while shape inputs are constrained to the supported range. Displayed
private values and proposed bids are rounded to the nearest tenth without a
trailing zero, while calculations retain the
unrounded choices.

Let Y_1 denote the highest opposing value. Because opponents bid truthfully,
the highest opposing bid is beta^II(Y_1) = Y_1. If F is the selected value CDF,
then G(x)=F(x)^(n-1). Define I(x)=integral_a^x G(y)dy. The tested model
computes:

    Pr(win | x_1) = G(x_1)
    E[payment * 1{win}] = x_1 G(x_1) - I(x_1)
    E[payment | win] = x_1 - I(x_1)/G(x_1), when G(x_1) > 0
    E[payoff] = (v_1-x_1)G(x_1) + I(x_1).

Uniform cases use analytic shortcuts. General transformed-Beta cases use
deterministic numerical integration through the shared distribution kernel.
Conditional expected payment is undefined when winning probability is zero.
The realized payment after a win is Y_1, not x_1.

### Implemented visual

The two panels share the [a,b] bid domain. The first is titled "PDF of highest
opposing bid," without a beta expression in the title, and shades the PDF of
the highest truthful opposing bid through x_1. The second panel plots its CDF
without a vertical-axis title. Its dashed selected-point guide instead reads
"Probability of winning = [number]" at the probability axis. For
x_1 <= v_1, expected payoff is the green area

    integral_a^x_1 G(y)dy + (v_1-x_1)G(x_1).

For x_1 > v_1, the truthful green area remains and the loss

    integral_v_1^x_1 [G(x_1)-G(y)]dy

is shown as a solid red area. A dashed probability guide, selected bid, focal
value, and "beta^II(v_1) = [number]" marker are directly labeled. The
first-price payoff rectangle is not reused because x_1 is not the payment in a
second-price auction.

The first-panel probability label remains. The second-panel probability label
stays at the probability axis, while the expected-payoff label remains anchored
near the selected bid when it must leave a colored area. The green
truthful-payoff area and red overbid-loss area do not receive separate numeric
labels. One net "Expected payoff" annotation replaces both and remains visible
in every bid state. Neither metric appears to the right of a panel title.

When an overbid has positive or zero net expected payoff, its label attaches
immediately left of the selected x_1 marker. When net expected payoff is
negative, the red label attaches immediately right of that marker. It may flip
sides at a plot boundary, but it does not move to a detached lower lane.

The public introduction, explanation, derivation, and scope sections remain
intentionally empty until the user supplies their prose. Notes is an empty
user-authored bullet list. References contains the user-requested Krishna
citation.

## 6a. Module 03: bilateral trade, one buyer and one seller

### Purpose

The module examines whether a learner-chosen allocation rule q(v,c), the
probability of trade between one buyer with value v and one seller with
cost c (both on [0,1]), can be implemented in a Bayes-Nash equilibrium
(Bayesian/interim incentive compatibility), satisfy ex-post individual
rationality, balance the intermediary's budget, and reach the efficient
outcome, all simultaneously. The learner controls only q; every other
displayed quantity is derived from it.

### Implemented scope

- One buyer with value v and one seller with cost c, both on the fixed
  support [0,1], drawn Uniform[0,1] with no adjustable shape controls (no
  distribution selector, matching the project's existing convention, but
  with a fixed rather than adjustable support for this module).
- A paintable 20x20 grid of genuine 0.05x0.05 cells for q(v,c) in [0,1]
  (cell (i,j) covers v in [i*0.05,(i+1)*0.05), c in [j*0.05,(j+1)*0.05), so
  every cell is a full-width square with no half-width edge tiles), edited
  by pointer dragging or by a keyboard-navigable selected-triangle slider
  and number input. Each cell is further split by its own bottom-left-to-
  top-right diagonal into two independently paintable triangles, "L"
  (upper-left) and "R" (lower-right) — at the user's direction, the learner
  paints individual triangles directly, not whole cells, so a diagonal
  pattern can be painted by dragging along a cell's own diagonal, in
  addition to the three exact preset generators (efficient benchmark,
  posted price, Chatterjee-Samuelson) setting a cell's two triangles
  independently for their own diagonal thresholds. A diagonal threshold like
  v=c or v-c=1/4 is represented with zero approximation error whenever it is
  a whole multiple of the 0.05 cell size — it then runs exactly along that
  cell's own diagonal split. This is the second,
  more thorough numerical redesign of the grid (after removing a separate
  hidden integration grid, see the bug-fix history below), undertaken at
  the user's direction specifically so the three threshold-shaped presets
  display and compute with no numerical error at all, not merely a smaller
  one. Every v-c panel renders exactly that 800-triangle mesh (or a
  diagnostic quantity evaluated once per triangle centroid) — a cell whose
  two triangles happen to share a value reads as a flat square, while a
  preset cell straddling a threshold, or a cell deliberately painted with
  two different triangle values, visibly shows the split. There is no hidden
  finer grid, no trapezoidal quadrature, and no interpolation anywhere in
  the model: welfare, expected utilities, and expected revenue are computed
  by exact triangle-centroid integration (exact because the integrand --
  v-c, 1-v, or c -- is affine, so evaluating it at a triangle's centroid and
  multiplying by its area reproduces that triangle's exact integral), and
  the cumulative envelope utilities U_B/U_S have closed forms evaluable
  exactly at any (v,c), not merely interpolated from samples.
- Preset allocation rules: the efficient benchmark q*(v,c)=1{v>c} (also the
  default on load), always-trade, never-trade, posted price
  q(v,c)=1{v>=p, c<=p} (reveals its own adjustable price slider, which
  fully regenerates the grid on every move), and the Chatterjee-Samuelson
  double auction q(v,c)=1{v-c>=1/4}. There is no random preset and no
  separate reset button; the presets are laid out horizontally, prefixed
  with a plain "Presets:" label.
- Implementability checked as Bayesian (interim) incentive compatibility —
  not dominant-strategy/ex-post IC (DSIC), which the module used at first
  but replaced at the user's direction after confirming the theory. Define
  the interim allocation probabilities Q_B(row i) and Q_S(col j) as exact
  area-weighted averages of q over that row's/column's 40 triangles (an
  exact cell average, not a quadrature approximation of a continuous
  curve); Bayesian IC (Myerson 1981) holds iff Q_B is nondecreasing and Q_S
  is nonincreasing. This is strictly weaker than pointwise q(v,c)
  monotonicity, since a non-monotonic row/column can still average to a
  monotonic interim probability, and it is the notion actually used in
  Myerson-Satterthwaite (1983) itself. The two IC diagnostic panels are 1D
  staircase/step charts of Q_B and Q_S (not smooth line charts, since each
  value is a cell average, not a point sample), not v-c heatmaps, with
  violating steps highlighted in red. The pointwise/ex-post check remains
  available in model.js as a tested utility but is not part of the live
  diagnostic.
- Minimal-rent envelope transfers via the same formulas regardless of which
  IC notion is checked, with both boundary utilities normalized to zero;
  buyer and seller utility surfaces. The induced quantities are still
  computed and shown even when q is not IC-implementable (never hidden),
  but they are formal envelope-formula values rather than an achieved
  incentive-compatible outcome in that case. An earlier version flagged
  this with an explicit caveat line on the buyer-utility, seller-utility,
  and net-revenue panels; that caveat text was removed at the user's
  direction, so those panels no longer display it regardless of
  IC-implementability. This works because averaging the pointwise payment
  formula over the opponent's type reproduces exactly the standard interim
  envelope expression, so Bayesian IC of Q_B/Q_S is sufficient for these
  same transfers to be interim incentive compatible. Ex-post IR is
  automatic under this construction for any q in [0,1] (not a consequence
  of IC, which is a logically separate condition), so the minimum utility
  is always exactly 0 and never fails; the IR panels instead display
  expected utility (information rent), which does move with q. At the
  user's direction these two lines ("Expected buyer rent: [number]." and
  "Expected seller rent: [number].") are always rendered in the pass
  (green) color rather than the earlier neutral color, since IR cannot
  fail here. The Q_B/Q_S notation in the buyer/seller IC panels' own
  verdict lines is rendered with an actual `<sub>` element rather than a
  literal underscore, so it reads as a proper subscript next to the
  MathJax-rendered figcaption above it, without adding those
  frequently-updating lines to the MathJax typesetting lifecycle. At a
  later request those two lines also dropped their "Buyer IC: yes/no (...)"
  / "Seller IC: yes/no (...)" wrapper text; they now state Q_B's/Q_S's own
  monotonicity directly ("Q_B nondecreasing." or "Q_B nonmonotonic at
  [count] points.", and likewise for Q_S), still colored green/red by
  whether a violation exists.
- Induced net revenue R(v,c)=p_B(v,c)-p_S(v,c). The net-revenue panel's
  plot itself is an ordinary pointwise v-c heatmap, unchanged from the
  other three heatmap panels. Its diagnostic text went through a few
  rounds of simplification at the user's direction: first from three lines
  (ex-post budget balance, ex-post no-deficit, expected no-deficit) down to
  a single "Expected no-deficit (E[R] = [number]): yes/no." line colored
  green/red by that verdict; then the wording was trimmed to just
  "Expected revenue: [number]." with no yes/no phrase, briefly in the
  neutral color; the user then asked that any violated condition read red,
  matching the other panels, so the line is colored green/red by
  `expectedNoDeficit` again — only the "no-deficit: yes/no." wording is
  gone, not the coloring. All three underlying verdicts (ex-post budget
  balance, ex-post no-deficit, expected no-deficit) remain computed and
  available as data attributes; only `expectedNoDeficit` now drives the
  visible color, and none of the three is spelled out as text.
- Expected gains from trade W(q), compared against the first-best W(q*)
  under the same exact triangular-mesh integration, with the efficiency loss and
  highlighted over-trade (v<c) and under-trade (v>c) regions.
- A compact dashboard layout: `.bilateral-layout` is a row with the
  sized-down main paint chart and its controls (including a q-slider
  deliberately capped much narrower than the chart) on the left, and an
  explicit three-column by two-row grid of all six diagnostic panels (buyer
  IC, seller IC, buyer utility, seller utility, net revenue, efficiency, in
  that DOM order) to its right on wide screens. The layout fills the same
  shared page width as the auction demos and wraps below the main chart on
  narrower screens. Each panel has its own short
  colored verdict text (green when the condition holds, red when it does
  not) immediately below its figure. The selected triangle's cell v- and
  c-ranges and L/R side appear dynamically in the "Allocation probability on
  v ∈ [lo, hi), c ∈ [lo, hi), L" (or "R") slider label — using a real
  Unicode "∈" character, not MathJax, since this label updates on every
  paint stroke and re-typesetting MathJax that often would add visible lag
  — and as a halo-backed in-graph marker near the selected triangle, with no
  separate text readout. All panels and text update immediately together as
  the learner paints; there is no Run button and no per-panel show/hide
  toggle.

### Verified closed-form benchmarks

Under the current 20x20 triangular-mesh architecture these are exact (to
floating-point precision), not merely convergent, and are covered by
tests/bilateral-trade-model-tests.js:

- q=0 (never trade): all transfers, utilities, and revenue are exactly zero,
  so expected buyer/seller rent are both 0.
- q=1 (always trade): p_B=0 and p_S=1 exactly everywhere, so R=-1
  everywhere — a constant, certain ex-post deficit. U_B(v,c)=v and
  U_S(v,c)=1-c exactly (verified via the closed-form point evaluator at
  several non-grid-aligned points, not just at grid coordinates), so
  expected buyer rent = E[V] = 0.5 and expected seller rent = E[1-C] = 0.5
  under Uniform[0,1].
- q*(v,c)=1{v>c} (efficient benchmark): v=c runs exactly along the grid's
  own diagonal split, so p_B(v,c)=c and p_S(v,c)=v wherever v>c hold exactly
  (not approximately), giving R(v,c)=-(v-c) there — the intermediary loses
  exactly the gains from trade on every trade, because both sides'
  minimal-rent transfer captures the full surplus. W(q*)=1/6 and
  E[U_B]=E[U_S]=1/6 exactly under Uniform[0,1] (verified via exact
  triangle-centroid integration, not a quadrature tolerance), so
  E[R]=-1/6 exactly — both sides individually claim the full gains from
  trade as rent, against a pot that only holds it once. Q_B and Q_S are
  also exactly monotonic (a combinatorial fact: each row/column average is
  a sum over a strictly growing/shrinking set of fully-1 triangles), so the
  efficient benchmark is IC-implementable under both notions. Since
  U_B(v,c)=integral_0^v q(x,c)dx >= 0 and U_S(v,c)=integral_c^1 q(v,y)dy >=
  0 for any q in [0,1] regardless of monotonicity, ex-post IR is automatic
  under this normalization and is not a consequence of IC; the module's
  real, discoverable tension is between IC, efficiency, and budget balance.
  Because the minimum utility is therefore always exactly 0 regardless of
  q, the IR panels display expected utility (information rent) instead, as
  neutral informational text rather than a pass/fail line.
- A rule that fails pointwise/ex-post monotonicity on both sides (columns
  0-9 increasing in row, columns 10-19 decreasing) can still be exactly
  Bayesian-IC: by construction every row and every column is an equal mix
  of the increasing and decreasing halves, so both interim probabilities
  are exactly the constant 0.5 — trivially monotonic despite the pointwise
  failures, demonstrating that Bayesian IC is strictly weaker than
  pointwise DSIC.
- Posted price q(v,c)=1{v>=p, c<=p}: pointwise monotonic on both sides
  (DSIC-implementable, not just Bayesian IC), and p_B(v,c)=p_S(v,c)=
  price*q(v,c) exactly, so R(v,c)=0 everywhere — exact ex-post budget
  balance, at the cost of inefficiency whenever v>c but the two are on
  opposite sides of the posted price. Under the triangular-mesh
  architecture this holds at *every* price, including grid-aligned ones and
  the p=0/p=1 boundaries (verified pointwise at every one of the 800
  triangle centroids), because `postedPriceGrid` classifies whole cells
  against the rounded price, and a boundary between whole cells is never
  inside a cell's own interior — there is simply no tie to break, unlike the
  module's first, point-sampled architecture (see the superseded bug fixes
  below).
- Chatterjee-Samuelson double auction q(v,c)=1{v-c>=1/4} (the allocation
  induced by the k=1/2 linear Bayes-Nash equilibrium b(v)=2/3 v+1/12,
  a(c)=2/3 c+1/4 under Uniform[0,1]; Chatterjee and Samuelson 1983): also
  pointwise monotonic on both sides. 1/4=5*0.05 runs exactly along the
  grid's own diagonal split (five cells over from the main diagonal), so
  W(q)=E[(V-C)1{V-C>=1/4}]=9/64 exactly versus the first-best 1/6 (a loss
  of 5/192), and E[R]=0 exactly — by revenue equivalence with the real
  double auction, which is budget balanced by construction (no
  intermediary), even though this module's own pointwise transfers for the
  same allocation differ from the real (a+b)/2 price.

### Superseded numerical fixes (architecture history)

Two earlier point-sampled-grid bugs — a floating-point cancellation in
`chatterjeeSamuelsonGrid`'s `v - c >= 0.25` comparison, and a revenue
imbalance in `postedPriceGrid` at grid-aligned prices that needed a
`POSTED_PRICE_GRID_NUDGE` workaround — were fixed individually, then made
moot entirely by the 20x20 triangular-mesh redesign above: trade is now
decided by comparing integer cell indices directly (no floating-point
subtraction to cancel), and whole cells (never sampled points) are
classified against a price (no boundary tie to break). Kept here only as
history; neither `EPSILON`-guarded comparisons nor
`POSTED_PRICE_GRID_NUDGE` exist in the current `model.js`. The earlier fix
to `efficientWelfare()` (making it and `summarize()`'s own welfare run the
identical computation on the identical grid, removing a separate hidden
integration grid entirely) remains the current architecture's approach,
just restated for the 20x20 grid: `efficientWelfare()` is
`welfare(efficientGrid())`.

### Text authorship

The page is titled “The Myerson-Satterthwaite Theorem” and now contains the
user-supplied economic environment, four desired mechanism properties, and
instructions for the interactive demo. Its separate References section cites
Myerson and Satterthwaite (1983), while Notes remains reserved and empty. At
the user's direction, the diagnostics area itself carries no explanatory
prose, section headings, or formula blocks — only the six panels, their short
figcaptions, and their colored pass/fail verdict text. No independent
interpretive or pedagogical prose has been added.

## 6b. Shared page components

Once three modules existed, two blocks of markup were byte-for-byte
duplicated across module pages: the site header/footer wordmark-plus-brand
row, and — between first-price and second-price specifically — the entire
Beta-shape parameter row (bidder count, support bounds, alpha/beta sliders,
live "PDF of Value" preview, input-error region). At the user's direction,
this is now eliminated with native browser features rather than a build
step: `js/components.js` defines three autonomous Custom Elements —
`<page-header category="..." home="...">`, `<page-footer>`, and
`<model-parameter-controls>` — each rendering into its own light DOM (no
shadow root), so the nodes they inject are ordinary document children,
reachable by `document.getElementById`/`querySelector` and styled by the
existing `styles.css` selectors exactly as if the markup had been typed by
hand. No fetch, no CORS dependency, no bundler, and (unlike a
`customized-built-in` `is="..."` element, which Safari does not support)
no cross-browser risk: this works identically offline through `file://`
and once hosted.

The outer semantic wrapper elements — `<header class="site-header">`,
`<footer class="site-footer">`, and
`<section class="model-specifications" aria-labelledby="parameters-title">`
— stay hand-written in each index.html rather than being absorbed into the
custom element. This was a deliberate choice, not an oversight: an
autonomous custom element has no implicit ARIA landmark role, so
templating the wrapper tags themselves would have silently dropped the
`banner`/`contentinfo` landmark roles that `<header>`/`<footer>` provide
for free at the top of `<body>`. Keeping the real tags costs two or three
hand-written lines per page and avoids that regression entirely; only the
markup that actually varied (the category text, the home link) or was
purely duplicated (the footer content, the entire parameter row) lives
inside the custom element.

Each module page loads `js/components.js` with `defer`, ordered before its
own `model.js`/`app.js`. Custom elements upgrade synchronously as soon as
`customElements.define` runs, and deferred scripts execute in document
order before `DOMContentLoaded` fires, so by the time each page's `app.js`
looks up ids like `#bidder-count` on `DOMContentLoaded`, the custom
elements have already expanded into ordinary DOM content. The same timing
means MathJax typesetting needs no special handling either: the
`\(n\)`/`\(a\)`/`\(b\)`/`\(\alpha\)`/`\(\beta\)` delimiters rendered by
`<model-parameter-controls>` are ordinary light-DOM content by the time
each page's `typesetInitialHtmlMath()` runs its existing
`.model-specifications` selector.

Root `index.html` (the menu) intentionally does not use these elements or
load `js/components.js` — its header/footer stay hand-written, since
`tests/menu-tests.js` asserts the menu page loads zero `<script>` tags at
all, reflecting an existing "keep the menu barebones" design intent. Adding
components.js there would need that test (and the intent behind it)
revisited first, and menu-page duplication was not the problem this change
was solving — the duplication cost specifically compounds with each new
mechanism module added, which the menu page does not.

`class ... extends HTMLElement` is the one place in the project's
JavaScript that uses ES6 class syntax rather than the project's otherwise
ES5 (`var`, no arrow functions, no template literals) style: the Custom
Elements API requires a real class, since `HTMLElement` cannot be
subclassed with a plain ES5 constructor function. Everything else in
`js/components.js` — variable declarations, string building — stays in the
project's usual ES5 style. `tests/components-tests.html` and
`tests/components-tests.js` cover all three elements directly (registered
definitions, attribute-driven rendering, every id the auction pages
depend on, and the preserved MathJax delimiters), independent of the
per-module UI test suites that already exercise them indirectly through
full page loads.

## 6c. Module 04 (draft, pending rework): payments from an allocation rule (General Topics category)

**Status: work in progress.** This module was built and titled "The
Envelope Theorem"; it is now relabeled "Payments from an Allocation Rule
(draft)," moved from general-topics/envelope-theorem/ to
general-topics/payments-from-allocation-rule/ (files, root-menu link, and
test files all moved/renamed together; the exported global was renamed
from `window.EnvelopeTheoremModel` to
`window.PaymentsFromAllocationRuleModel` specifically to avoid colliding
with the new module of the same conceptual name now occupying the old
slot), and its final scope is unresolved -- see the Status paragraph at the
top of this document and section 6d for the new, separate general-Theorem-2
module that now occupies the freed "Envelope Theorem" name and slot. The
rest of this section describes the draft module exactly as implemented
today, with paths updated to match the move; nothing about its behavior
changed.

### Purpose

The first three modules each examine one specific mechanism. This module
instead examines the primitive underneath all of them: given only an
allocation rule Q(v) for a single quasilinear agent, local incentive
compatibility (the envelope theorem) forces the interim rent U(v) and
payment P(v), and separately, monotonicity of Q is what makes that locally
-forced payment rule actually globally incentive compatible. The learner
controls only Q; U, P, and the global-IC verdict are all derived from it, the
same "paint the one free choice, watch everything else update" pattern as
the other three modules.

### Implemented scope

- A single agent with quasilinear utility vq-p, type v on the fixed support
  [0,1] (Uniform is not invoked -- there is no distribution or expectation
  anywhere in this module, deliberately: the envelope theorem is a pointwise
  statement in v, not an expectation, so unlike every other module there is
  no shape control and no Beta kernel dependency).
- Q(v) is defined by up to nine draggable control points (five by default, at
  v = 0, 0.25, 0.5, 0.75, 1, each height initialized to Q(v)=v), interpolated
  by a monotone cubic Hermite spline (Fritsch-Carlson tangent construction).
  The two endpoints v=0 and v=1 always exist and are not addable or
  removable; "up to nine total points" means up to seven interior points on
  top of those two. An "Add point" control bisects whichever gap between
  consecutive points is currently largest and initializes the new point's
  height to the curve's own current value there, so adding a point never
  itself changes Q's shape; "Remove selected point" removes the selected
  interior point (disabled on either endpoint or when the selection is not
  interior). The ceiling is nine, not ten, deliberately: repeated adds from
  the five default points bisect the largest gap each time, and that
  sequence lands on a perfectly even 0.125 spacing (0, 0.125, 0.25, ...,
  1) at exactly nine points; a tenth add would break that even spacing by
  bisecting down to an off-grid 0.0625, which is worth avoiding rather than
  exposing as the normal end state of repeatedly clicking "Add point."
  Painting is free, including non-monotonic curves on purpose, since the
  module's real content is what happens to global IC when Q stops being
  monotone.
- Fritsch-Carlson tangents are chosen specifically because a plain/natural
  cubic spline can overshoot a locally-monotone run of control points, which
  would corrupt the one diagnostic this module exists to show: an apparent
  IC violation must be real (implied by the placed points), never a spline
  artifact, and a real one must never be hidden by one either. The
  monotonicity-preserving construction is not merely cosmetic here.
- Q(v), U(v), and P(v)=vQ(v)-U(v) are exact closed forms, not numerical
  quadrature: U(v) is the exact antiderivative of the piecewise cubic
  Hermite interpolant (a piecewise quartic, evaluated via its own closed-form
  antiderivative on each segment), matching the project's existing exactness
  discipline from the bilateral-trade grid. The one place this module is
  not exact is the global-IC violation search: whether a candidate
  deviation-payoff line ever rises above U(v) is decided by a dense sample
  (40 samples per segment) rather than by solving the cubic that would
  locate the exact extrema of the resulting quartic difference, and this
  distinction is called out directly in model.js's comments rather than left
  implicit.
- No presets and no reset button, at the user's direction: the module opens
  on the default five-point Q(v)=v curve and offers no other precomputed
  starting shape; every other configuration is reached only by painting.
  (An earlier version had five presets -- never/always allocate, linear,
  a steep threshold, and a deliberately non-monotonic curve -- removed once
  the module reached this simplified state; the corresponding model.js
  generator functions were deleted along with the buttons, not merely
  hidden, and the two shapes worth keeping as regression fixtures --
  evenly-spaced Q(v)=v and the non-monotonic case -- now live as local test
  fixtures in tests/payments-from-allocation-rule-model-tests.js instead of
  product-facing presets.)
- Three panels on two layouts, not one: the main paintable Q(v) chart uses
  its own larger 660x450 SVG viewBox and CSS max-width, deliberately bigger
  than the two diagnostic panels, which share a smaller 440x300 layout and
  max-width so they match each other. (An intermediate version briefly gave
  all three panels the same size; the user then asked specifically for the
  main panel to read as larger, and for the whole demo area's combined
  width to land in the same range as the other three modules' demo areas
  -- roughly 1100px combined across the two columns plus their gap, close
  to bilateral-trade's own ~1112px main-plus-diagnostic-grid width.) The
  main chart is drawn as an exact cubic Bezier path per Hermite segment, an
  exact rendering of the interpolant, not a sampled polyline. The envelope
  panel shows U(v) shaded beneath it together with one straight
  deviation-payoff line per control point (gray if it never exceeds U(v),
  red if it does anywhere, blue if it belongs to the currently selected
  point); the payment panel shows P(v). All three update immediately
  together as the learner drags, adds, or removes points -- no Run button.
  Every panel's y-axis carries only its numeric tick labels, with no
  rotated y-axis title; the x-axis keeps its "Type, v" title on all three.
- Text placement went through two rounds before settling. The first round
  removed everything outside the two diagnostic-panel `<div>`s (the main
  chart's on-canvas caption, its dynamic `<desc>`, the `#live-summary`
  aria-live region, and the point-height control's visible label) while
  leaving the diagnostic panels' own figcaptions and verdict text alone.
  The user then clarified the intent was the opposite: the figcaptions
  ("Information rent U(v) and the envelope of deviation payoffs", "Payment
  rule P(v) = vQ(v) - U(v)") and the verdict/range sentences ("Global IC
  holds/violated...", "P ranges from...") were exactly the text meant to
  go, while everything from the first round should come back. The final
  state is therefore: the main chart keeps its on-canvas caption, dynamic
  `<desc>`, and the point-height control keeps its visible, dynamically
  updating label (with the corresponding `aria-valuetext` on the slider);
  `#live-summary` is back as an aria-live region; and the two diagnostic
  panels lost their figcaptions, their on-canvas captions, and their
  `envelope-text`/`payment-text` verdict `<div>`s (deleted from both
  index.html and app.js, not merely hidden). Each diagnostic SVG keeps its
  own `<title>`/`<desc>` for a baseline accessible name and description,
  which were never targeted by either round since they carry no visible
  text; the violation/no-violation state that the removed verdict sentence
  used to spell out is still visually legible from the deviation lines'
  own red/gray coloring.
- Selection/editing follows the established multi-modal-input convention:
  pointer drag directly on a control point (vertical-only, since only height
  is draggable -- x-position is fixed once a point is created, matching the
  simpler "fixed anchors, free heights" design chosen over fully free (x,y)
  placement specifically so this module reuses the project's existing
  accessible drag/keyboard patterns rather than inventing a new interaction
  paradigm), a synced slider/number input for the selected point, and
  keyboard control on the focused chart: ArrowLeft/ArrowRight move the
  selection between points, Home/End jump to the first/last point, and
  ArrowUp/ArrowDown nudge the selected point's height directly (a bonus the
  2D bilateral-trade grid does not have spare arrow keys for, since all four
  arrows are needed there for 2D cell navigation).

### Verified closed-form benchmark

Covered by tests/payments-from-allocation-rule-model-tests.js: for the
default five evenly-spaced points, which lie exactly on the line Q(v)=v, every secant
slope is identical and the Fritsch-Carlson tangent construction reproduces
that same slope everywhere with no rescaling triggered -- the monotone
Hermite interpolant is therefore exactly the line Q(v)=v across the whole
domain, not merely at the five control points, giving U(v)=v^2/2 and
P(v)=v^2/2 exactly (verified at several non-grid-aligned v, not just at
control points). The Q=1-everywhere fixture similarly gives U(v)=v and
P(v)=0 exactly; the Q=0-everywhere fixture gives U(v)=P(v)=0 exactly. A
hand-built monotone-but-unevenly-spaced point set is also verified to stay
nondecreasing at 400 sampled points, a direct regression test of the
no-overshoot property the whole diagnostic depends on; a deliberately
non-monotonic fixture is verified to violate global IC, while every
monotone fixture is verified not to. Repeated addPoint calls from the five
default points are also verified to land on an exactly even 0.125 grid at
the nine-point ceiling, the specific fact that makes nine (not ten) the
right ceiling.

### Text authorship

The page is titled "Payments from an Allocation Rule (draft)," updated
from its original "The Envelope Theorem" title along with the rest of the
relabeling. Its introduction and derivation sections contain only headings
and HTML placeholder comments, now including a work-in-progress note about
the relabeling and possible future rework, reserved for the user's own
environment description and formal derivation; Notes and References are
empty lists, all matching the existing per-module text-authorship
convention. No independent interpretive or pedagogical prose has been
added.

## 6d. Module 05: the envelope theorem (Theorem 2, general form; General Topics category)

### Purpose

Where the draft module above specializes the envelope theorem to a single
mechanism-design worked example, this module demonstrates Theorem 2 of
Milgrom and Segal, "Envelope Theorems for Arbitrary Choice Sets"
(Econometrica 70(2), 2002: 583-601), directly and in general form: an
arbitrary choice set X, a parameter t, a jointly defined f(x,t), and the
value function V(t) = sup_{x in X} f(x,t). Verified (via web search
excerpts of the paper, since every mirror found -- Princeton, Yale, two
Stanford faculty copies -- turned out to be a copy-protected PDF this
project's tooling could not open) statement of the theorem: given f(x,.)
absolutely continuous in t for every x in X with |f_t(x,t)| <= b(t) for an
integrable bound b uniform in x, V is absolutely continuous, so
V(t) = V(0) + integral_0^t f_t(x*(s),s) ds for any selection x*(s) of a
maximizer. No mechanism-design, allocation/payment, or IC/IR vocabulary
appears anywhere on this page, at the user's explicit direction.

### Implemented scope

- X is realized as a small, letter-labeled (not numbered, to underline
  that X carries no order or topology of its own -- the point of "arbitrary
  choice sets") family of straight lines: three by default (A, B, C,
  chosen so the default envelope already shows two crossings/kinks on
  load), up to eight (the size of the fixed label pool A-H). Each line is
  exactly two points, p0 and p1; there is no shared spline and no Hermite
  interpolation anywhere in this module, since a pointwise maximum of
  finitely many affine functions is already exactly piecewise-linear.
  "Add line" appends a new flat, full-domain line at the family's current
  average value (so it is visible without instantly dominating); "Remove
  selected line" removes the whole line the selected point belongs to
  (disabled at the one-line floor).
- Both plot axes are fixed to [0,1] -- never rescaled -- and *either* of a
  line's two points may be dragged anywhere along the plot's own edge (all
  four sides, not only the two vertical ones), landing on whichever edge
  is nearest via `projectToEdge`. `movePoint` also checks the dragged
  point's resulting t against its own line's other (untouched) point: if
  the gap is under `VERTICAL_SNAP_THRESHOLD` (0.01), it snaps t to be
  exactly equal, producing a genuinely vertical line (`slopeOf` then
  returns signed `Infinity`, or exactly `0` for a fully degenerate
  coincident-point line) rather than merely a very steep finite one. This
  replaced an earlier `MIN_DOMAIN_WIDTH` floor that only ever prevented an
  exact-zero-width domain as a numerical safety net; the current version
  is a deliberate feature, not a guard rail, since true infinite slope is
  now a first-class, exactly-representable case each panel handles on its
  own terms (see below) rather than an unbounded-but-always-finite number.
- The exact upper envelope is now searched *universally* rather than
  domain-gated: every finite-slope line's own affine formula
  (`valueAt`) is extrapolated across the *entire* [0,1] t-range for
  envelope purposes, not only the sub-interval between its own two drawn
  points, so there is no coverage-gap/undefined-V case left at all (the
  earlier gap concept -- `segment.lineIndex -1`, drawn as a break in the
  bold envelope -- has been removed along with the code path that
  produced it). Vertical lines are excluded from the search entirely
  (`crossing` and `V` both skip any line with a non-finite `slopeOf`),
  since a vertical line cannot participate in a pointwise-maximum-of-
  affine-functions envelope. `computeEnvelope` collects the domain
  endpoints {0,1} together with every finite-line pairwise crossing
  (`crossing` no longer checks domain overlap, only parallel/identical
  and vertical exclusion) as candidate breakpoints, evaluates the
  midpoint of each resulting sub-interval against every finite line's
  universally-extrapolated value to find that sub-interval's winner, and
  merges adjacent same-winner sub-intervals -- the default three-line
  family still produces exactly three segments (B, C, A) with breakpoints
  at exactly t=1/2 and t=2/3, unchanged from every earlier version of
  this module. Because a segment's value is now a true extrapolation, it
  can legitimately fall outside [0,1] (e.g. a short, steep winning
  segment whose formula keeps climbing past where its own two drawn
  points sit); the app layer, not the model, is responsible for clamping
  this for display (see below) -- `computeEnvelope` itself reports the
  true unclamped v0/v1.
- Three panels sharing the same larger-main-plus-two-matched-diagnostics
  layout as the draft module (660x450 main, 440x300 diagnostics, no
  y-axis title on any panel, x-axis titled "Parameter, t" rather than
  "Type, v" since t carries no mechanism-design meaning here): the main
  chart shows every line across only its own native `[p0,p1]` segment
  (which can itself be a literal vertical segment) at constant medium
  opacity in its own color, with a small letter matching the line's own
  id centered inside each endpoint circle so a line stays identifiable
  after it crosses others; both diagonals of the unit square are drawn
  faintly as a guide to where a drag will snap; the bold exact envelope
  is drawn segment-by-segment in each segment's own winning line's color,
  split by `clipSegmentForDisplay` into solid pieces (where the
  extrapolated value is within [0,1]) and dotted pieces clamped to y=0 or
  y=1 (where it is not), so an out-of-range winning segment is visible as
  a flat dotted line at the top or bottom of the plot rather than
  rescaling the axes or being silently hidden; kink markers are only
  drawn where the kink's value itself is within [0,1], since a kink
  between two clamped pieces has no meaningful on-plot position. The
  "Active slope" panel plots the active line's own (constant, finite)
  slope as a step function of t over the ordinary segments, jumping
  exactly at the kinks shown on the main panel; a vertical line does not
  appear as a step (it is excluded from the envelope, and a "value" of
  infinity cannot be a step height anyway), so instead each vertical
  line's own t is marked with a full-height dotted vertical line in the
  line's own color (`.slope-infinite-marker`), drawn independently of the
  step function.
  The "Steepest slope required" panel is ordinarily a small bar chart
  (auto-scaled), one bar per current line at |slope|, with a dashed guide
  at the current maximum; if any line is vertical, the panel switches to
  an all-or-nothing mode instead -- only vertical lines get a bar, drawn
  at full height, and the top y-tick is labeled "∞" in place of a number,
  since no finite maximum exists to anchor the usual scale and mixing a
  finite bar chart with an infinite entry would be misleading (a bar of
  "infinite height" drawn to scale next to finite ones is not a
  meaningful comparison, so finite bars are omitted in this mode rather
  than drawn at a token height). All three panels update immediately
  together as the learner drags, adds, or removes -- no Run button, and
  no "Steepen" button (removed once edge-dragging and vertical-snapping
  together made it redundant).
- Selection/editing follows the draft module's established multi-modal
  convention, adapted for two independently-positioned points per line
  rather than N shared spline points: every line's two points are
  flattened into one ordered list (line-by-line, p0 before p1) that
  ArrowLeft/ArrowRight cycle through on the focused chart, Home/End jump
  to the first/last point, and ArrowUp/ArrowDown nudge the selected
  point's value by a fixed step (0.02), re-projected onto the perimeter
  each time (so a nudge can itself cross a diagonal and snap onto a
  different edge). The precise-entry controls are two number inputs plus
  two range sliders, one pair per axis ("t-axis intercept" and
  "V(t)-axis intercept") -- resolving the earlier "no slider" design
  (when a single slider could not describe a freely 2D-draggable point)
  by using one 1D slider per axis instead of one slider for the whole
  point, alongside direct dragging.

### Verified closed-form benchmarks

Covered by tests/envelope-theorem-model-tests.js (24/24 passing as of this
writing): `projectToEdge` reproduces the nearest-edge geometry exactly,
including at an exact tie (e.g. (0.1,0.9), equidistant from the left and
top edges) -- an epsilon-tolerant comparison was needed here, not exact
`===`, since `1 - 0.9` is not bit-for-bit equal to `0.1` in IEEE 754 and
the naive version silently broke the tie the wrong way, caught by this
test before it shipped; `valueAt` is verified to extrapolate correctly
outside a line's own domain, and `slopeOf` is verified to return signed
`Infinity` for a vertical line and exactly `0` for a fully degenerate
coincident-point line; `crossing` reproduces a hand-solved intersection
exactly both for the default full-domain A/B lines (t=7/12) and for a
pair of lines with a shared nonzero p0.t, is verified positive even when
the crossing point lies outside either line's own drawn sub-interval
(the universal-search behavior that replaced the old
non-overlapping-domain-returns-null case), returns null for parallel and
identical lines, and returns null whenever either line is vertical;
`computeEnvelope` on the default three-line family still produces exactly
three segments in the order B, C, A with breakpoints at exactly t=1/2 and
t=2/3 (confirmed against V's own continuity, not merely the winner
label), is separately verified to search with no gaps and to report a
segment whose v0/v1 falls outside [0,1] when a winning line's own
extrapolation demands it (with an explicit sub-case asserting a negative
v0), and is verified to exclude vertical lines from the search entirely;
`movePoint` is verified both to project correctly and to leave the
line's other point and the rest of the array untouched, to snap to an
exactly vertical line once a drag lands within `VERTICAL_SNAP_THRESHOLD`
of the line's other point, and to *not* snap when a drag is still well
outside that threshold; and `summarize` is verified to populate
`infiniteLines`/`hasInfiniteLine` correctly and to exclude any vertical
line's slope from `maxAbsSlope`, so the "Steepest slope required" panel's
ordinary auto-scaled mode is never accidentally driven by an infinite
value.

### Text authorship

The page is titled "The Envelope Theorem." Its introduction and derivation
sections contain only headings and HTML placeholder comments, reserved for
the user's own environment description, the formal statement/proof sketch
of Theorem 2, and an explanation of why a finite line family always
trivially satisfies its hypothesis (V is automatically piecewise-linear,
hence Lipschitz, hence absolutely continuous) even though no b(t) fixed in
advance could dominate every family reachable by dragging, since either
point of a line can be dragged onto the plot's own top or bottom edge to
squeeze its domain arbitrarily narrow while its value still spans [0,1];
Notes is an empty list. References currently contains one
assistant-added bibliographic entry (the Milgrom-Segal citation itself,
author/title/journal/year/pages only, no summary or interpretation) since
the module's entire premise depends on correctly identifying that source;
flag to the user for confirmation or removal rather than assuming it
belongs. No independent interpretive or pedagogical prose has been added.

## 7. File and code organization

Current structure:

    index.html                              module menu
    styles.css                             shared page and menu styles
    assets/
      mathjax/
        tex-svg.js                         vendored MathJax 4 TeX-to-SVG build
        LICENSE                            vendored MathJax license
        a11y/, fonts/, input/, sre/         local runtime support assets
    auctions/
      first-price/
        index.html                         first-price module page
        model.js                           first-price model functions
        app.js                             first-price state and SVG behavior
      second-price/
        index.html                         second-price functional page
        model.js                           second-price model functions
        app.js                             second-price state and SVG behavior
    bilateral-trade/
      myerson-satterthwaite-theorem/
        index.html                         bilateral-trade module page
        model.js                           bilateral-trade grid, envelope, and
                                            welfare/revenue functions
        app.js                             bilateral-trade painting state and
                                            SVG behavior
    general-topics/
      envelope-theorem/
        index.html                         envelope-theorem module page
                                            (Theorem 2, general form)
        model.js                           exact line-crossing/upper-envelope
                                            geometry, no spline or sampling
        app.js                             envelope-theorem line-editing
                                            state and SVG behavior
      payments-from-allocation-rule/
        index.html                         draft module page (originally
                                            "The Envelope Theorem")
        model.js                           monotone-Hermite curve, exact
                                            U/P closed forms, violation search
        app.js                             payments-from-allocation-rule
                                            point-editing state and SVG
                                            behavior
    js/
      mathjax-config.js                    shared local MathJax configuration
      distributions.js                     shared Uniform/Beta math kernel
      components.js                        shared page-header/page-footer/
                                            model-parameter-controls custom
                                            elements
    tests/
      distribution-tests.html
      distribution-tests.js
      components-tests.html
      components-tests.js
      menu-tests.html
      menu-tests.js
      model-tests.html
      model-tests.js
      ui-tests.html
      ui-tests.js
      second-price-model-tests.html
      second-price-model-tests.js
      second-price-ui-tests.html
      second-price-ui-tests.js
      bilateral-trade-model-tests.html
      bilateral-trade-model-tests.js
      bilateral-trade-ui-tests.html
      bilateral-trade-ui-tests.js
      envelope-theorem-model-tests.html
      envelope-theorem-model-tests.js
      payments-from-allocation-rule-model-tests.html
      payments-from-allocation-rule-model-tests.js
    AGENTS.md
    PROJECT_PLAN.md
    README.md

Keep root styles shared while the visual language remains small. Give new
mechanisms their own model and interaction files rather than mixing
second-price or bilateral-trade logic into the existing first-price files.
Genuine duplication across module pages (the header/footer, and the
first-price/second-price parameter row) has already made a shared
component system worth having once — see "6b. Shared page components" —
so extend `js/components.js` with another light-DOM custom element the
next time markup would otherwise be copy-pasted into a new module's
index.html, rather than reintroducing the duplication and waiting for a
third instance. The distribution kernel (`js/distributions.js`) is shared
because both auction mechanisms need the same validation, CDF, PDF,
quantile, and integration operations; the bilateral-trade module fixes
Uniform[0,1] for both types and so does not depend on it, keeping its own
small self-contained numerical kernel in its `model.js`. Both General
Topics modules likewise keep their own self-contained kernels (the
payments-from-allocation-rule module's monotone-Hermite construction and
its exact closed-form integrals; the envelope-theorem module's exact
line-crossing/upper-envelope geometry) and, unlike every other module, have
no distribution at all: the envelope theorem is a pointwise statement in a
parameter, not an expectation over a type distribution.

The site remains static and works through file:// without a build step,
framework, server, account, or network connection — `js/components.js`'s
Custom Elements are a native browser API, not a framework or templating
language, so this holds even though page scaffolding is no longer
hand-copied into every index.html. MathJax 4 is the sole vendored runtime
dependency: each module loads `js/mathjax-config.js` before
`assets/mathjax/tex-svg.js`. Automatic startup typesetting is disabled so
each module's scripts can explicitly typeset its own top-level section
classes — `.introduction`, `.model-specifications`, `.choice-controls`,
`.derivation`, `.notes`, and `.references` for first-price/second-price;
and `.introduction`, `.choice-controls`, `.explorable`, `.derivation`,
`.notes`, and `.references` for bilateral-trade and both General Topics
modules (envelope-theorem and payments-from-allocation-rule) — while always
excluding custom graph SVGs.

Dynamic HTML math updates follow one shared lifecycle. Before replacing a
previously rendered node, clear it with `MathJax.typesetClear([node])`; set the
new TeX as text; then render it with `MathJax.typesetPromise([node])`. Updates
are serialized and exposed as `window.mechanismMathReady` so browser checks and
subsequent updates can wait for the current render.

## 8. Validation strategy

Every module needs:

- exact benchmark cases;
- endpoint and invalid-input tests;
- absence of a distribution selector, always-visible shape controls, and shape-
  control synchronization tests;
- transformed-support and quantile checks, including Beta(1,1) agreement with
  Uniform;
- mechanism-specific mathematical invariants;
- synchronization checks across controls and graphs;
- finite SVG coordinates, including for Beta shapes with singular endpoint
  densities;
- the live Beta value-PDF preview and its response to support and shape
  changes;
- singular and compact states that exercise marker-adjacent, side-flipping
  probability placement and expected payoff's width-only placement rule;
- keyboard and accessible-name checks;
- desktop and narrow visual inspection;
- verification that all page links work through file://;
- local-only MathJax script paths, successful initial HTML typesetting, and no
  visible raw TeX delimiters;
- serialized dynamic typesetting that replaces obsolete output and settles
  through `window.mechanismMathReady`; and
- confirmation that graph SVGs contain no MathJax output and retain their
  Unicode/plain dynamic labels.

The menu needs checks that:

- Auctions, Bilateral Trade, and General Topics are the only current
  categories;
- modules appear in a category row;
- every implemented module links to its explicit index.html path;
- no unavailable module is presented as a working link; and
- the menu does not load mechanism-specific JavaScript.

The bilateral-trade module additionally needs:

- structural exactness of the three preset generators' triangle values
  (efficientGrid, postedPriceGrid, chatterjeeSamuelsonGrid) against their
  combinatorial definitions, not just their aggregate welfare/revenue
  numbers;
- both the pointwise and interim monotonicity-violation detectors against
  known-good and deliberately broken synthetic grids, and the dedicated
  regression test showing Bayesian IC is strictly weaker than pointwise
  DSIC;
- the q=0, q=1, and efficient-benchmark closed forms above, verified exactly
  (not within a loose quadrature tolerance) via both the aggregate
  triangle-centroid integrals and the closed-form point evaluator at
  specific non-grid-aligned (v,c);
- the general U_B>=0/U_S>=0-and-vanishes-at-the-boundary invariant across
  monotonic and non-monotonic grids, checked at triangle centroids for
  nonnegativity and at the true v=0/c=1 boundary (via the point evaluator,
  not a centroid-sampled heatmap) for exact vanishing;
- pointwise R(v,c)=0 for posted price at every one of the 800 triangle
  centroids, across grid-aligned and off-grid prices and the p=0/p=1
  boundaries;
- finite SVG coordinates and finite verdict scalars across the default,
  non-monotonic, all-zero, and all-one grids, including when IC fails; and
- keyboard grid-cursor navigation, the synchronized selected-cell slider and
  number input, preset buttons, and edge-clamped pointer painting.

The payments-from-allocation-rule module additionally needs:

- the interpolation-exactness invariant (the curve passes exactly through
  every one of its own control points) across each local test fixture;
- the evenly-spaced-Q(v)=v, Q=1-everywhere, and Q=0-everywhere closed-form
  benchmarks above, verified at several non-grid-aligned v via the
  closed-form Q/U/P evaluators, not sampled from a rendered chart;
- the no-overshoot invariant (a monotone point set stays nondecreasing
  everywhere when densely sampled), the module's core regression guard
  against Fritsch-Carlson implementation mistakes;
- global-IC verdicts against known-monotone and deliberately-broken point
  sets (mirroring the bilateral-trade module's "Bayesian IC is strictly
  weaker than pointwise DSIC" regression, this module's analogous
  local-vs-global-IC regression);
- add/remove-point boundary behavior: the nine-point ceiling (including
  that repeated adds from the five default points land on an exactly even
  0.125 grid there, not an off-grid 0.0625), the two-point (endpoints-only)
  floor, endpoint removal always rejected, and a newly added point's height
  matching the curve's own prior value there so adding never itself
  changes Q; and
- keyboard point-cursor navigation (ArrowLeft/ArrowRight/Home/End),
  ArrowUp/ArrowDown height nudging, the synchronized selected-point slider
  and number input, and pointer dragging.

tests/payments-from-allocation-rule-model-tests.js covers the first five
of these (16/16 passing as of this writing); only the last (keyboard/pointer
interaction) was verified interactively rather than as a committed test —
including a scripted Chrome DevTools Protocol pass simulating add/remove
clicks, keyboard navigation, and a pointer drag, all against the live page —
but not yet captured as a committed
payments-from-allocation-rule-ui-tests.js alongside the model tests. Add
one the next time this module is revisited, matching
bilateral-trade-ui-tests.js's role for that module.

The envelope-theorem module additionally needs:

- the edge-projection invariant (`projectToEdge` reproduces the correct
  nearest-edge geometry, including at an exact tie between two edges,
  where an epsilon-tolerant comparison is required -- see the caught bug
  above -- and that a wildly out-of-range raw drag still lands exactly on
  the perimeter);
- the extrapolation invariants: `valueAt` reproduces the correct value
  outside a line's own domain, and `slopeOf` returns signed `Infinity`
  for a vertical line and exactly `0` for a fully degenerate
  coincident-point line;
- the exact-crossing invariant, now universal rather than domain-gated:
  `crossing` reproduces a hand-solved intersection to floating-point
  precision both for full-domain lines and for a line pair with a shared
  nonzero p0.t, is positive even when the crossing point lies outside
  either line's own drawn sub-interval, and correctly returns null for
  parallel/identical lines and whenever either line is vertical;
- the exact-envelope invariant on the default three-line family: exactly
  three merged segments in winner order B, C, A, with breakpoints at
  exactly t=1/2 and t=2/3, confirmed both against the hand-derivation and
  against V's own continuity (consecutive segments must agree in value at
  their shared breakpoint) -- this is also the regression guard on the
  "merge adjacent same-winner sub-intervals" step, since the default
  family's own A-B crossing at t=7/12 is a real crossing that must be
  merged away rather than reported as a spurious fourth segment;
- the universal-search invariant: no gap/undefined-V case exists any
  longer, a winning segment's own v0/v1 may legitimately fall outside
  [0,1] when its line's extrapolation demands it (checked with an
  explicit negative-v0 sub-case), and vertical lines are excluded from
  the envelope search entirely;
- degenerate cases: a single full-domain line has zero kinks and V equal
  to that line everywhere;
- add/remove-line boundary behavior: the eight-line ceiling and one-line
  floor exactly, a blocked add/remove verified as a true no-op, and a
  newly added line's flat, full-domain starting value verified against
  the family's own current average;
- the movePoint invariants: it projects correctly and touches only the
  targeted point (the line's other point and the rest of the array are
  unchanged), it snaps to an exactly vertical line once a drag lands
  within `VERTICAL_SNAP_THRESHOLD` of the line's other point, and it does
  *not* snap when a drag is still well outside that threshold; and
- the summarize invariants: `infiniteLines`/`hasInfiniteLine` are
  populated correctly, and a vertical line's slope is excluded from
  `maxAbsSlope` so the ordinary auto-scaled bound panel is never silently
  driven by an infinite value.

tests/envelope-theorem-model-tests.js covers all of the above (24/24
passing as of this writing) except keyboard/pointer interaction, which
was verified interactively via a scripted Chrome DevTools Protocol pass
against the live page rather than as a committed test -- including
confirming a drag that snaps onto the top edge lands at the exact
projected (t,v), that dragging a point within `VERTICAL_SNAP_THRESHOLD`
of its sibling produces an exact vertical line whose infinite slope is
correctly reflected in the live summary text, the slope chart's red
dotted marker, and the bound chart's "∞"-labeled full-height bar, and
that a winning segment whose extrapolation exceeds [0,1] renders as a
dotted, edge-clamped piece in the correct line color -- the same gap as
the sibling module above. Add envelope-theorem-ui-tests.js the next time
this module is revisited.

Test responsive behavior at 320, 375, 768, and 1280 CSS pixels and at 200
percent zoom before calling a new module complete.

## 9. Near-term sequence

1. Review the second-price functional graph and interaction choices with the
   user.
2. Obtain and insert the user's second-price introductory and explanatory text.
3. Add the user's derivation and scope, and extend References with any
   user-supplied sources, if requested.
4. Re-run mathematical, interface, responsive, and visual checks after copy is
   inserted.
5. Review and iterate on the inserted user-authored Myerson-Satterthwaite
   introduction and the 1983 primary-paper citation.
6. Select the next module with the user.
7. Reconsider a shared component system only when genuine repeated structure
   emerges across modules.
8. Built the new General Topics module now occupying the "Envelope
   Theorem" name and slot (see section 6d): a letter-labeled family of
   straight lines, their exact upper envelope, an active-slope step-function
   panel, and a required-domination-bound bar panel, all unclamped so the
   learner can push a line's slope (via dragging past the chart's edge or
   the "Steepen" control) with no fixed ceiling, at the user's direction
   after the initial design discussion. Two adjustments from that initial
   discussion: the second diagnostic panel became a bar chart of each
   line's own |slope| (directly visualizing the required bound b) rather
   than an integral-reconstruction panel, since the running integral of a
   piecewise-constant slope is simply V itself and would have duplicated
   the main panel; and the "let absolute continuity break" idea was pulled
   into this same pass rather than deferred, realized as genuinely
   unbounded dragging/steepening rather than a literal break (a finite line
   family is always exactly piecewise-linear/Lipschitz, so nothing on
   screen at any instant actually stops being absolutely continuous --
   the module demonstrates that no bound fixed in advance can dominate an
   unboundedly extensible family, not that a specific finite V fails to be
   AC).
9. Reworked the envelope-theorem module's core interaction at the user's
   direction: both plot axes are now fixed to [0,1] rather than
   auto-scaling, either point of a line can be dragged onto any of the
   plot's four edges (not only the two vertical ones) via a new
   `projectToEdge` nearest-edge projection, a line's domain is therefore a
   genuine sub-interval of [0,1] rather than always the whole thing (with
   `computeEnvelope`/`computeKinks` extended to handle the resulting
   coverage gaps correctly), and the "Steepen" button was removed as
   redundant -- the same unbounded-steepness demonstration is now reached
   by dragging a point onto the top or bottom edge to squeeze a line's own
   domain arbitrarily narrow. See section 6d for the full writeup and the
   caught floating-point tie-break bug (exact `===` comparison of
   `1 - 0.9` against `0.1` silently broke a real tie) that came out of
   testing this redesign.
10. Review the envelope-theorem module's introduction/derivation text and
    References entry (currently one assistant-added bibliographic line for
    the Milgrom-Segal citation itself, pending the user's confirmation or
    removal) with the user, and decide the payments-from-allocation-rule
    module's final scope and category placement.
11. Reworked the envelope-theorem module's envelope search and edge cases
    at the user's direction: the search is now universal rather than
    domain-gated (every finite line's own formula is extrapolated across
    the whole [0,1] t-range for envelope purposes, removing the earlier
    gap/undefined-V concept entirely), a genuinely vertical, infinite-
    slope line is now reachable via a deliberate `VERTICAL_SNAP_THRESHOLD`
    snap (replacing the old `MIN_DOMAIN_WIDTH` numerical floor), and each
    panel handles the resulting edge cases on its own terms: the main
    chart clips a winning segment's own out-of-[0,1] excursion into a
    dotted, edge-clamped piece (`clipSegmentForDisplay`) instead of
    rescaling; the slope chart marks a vertical line with a full-height
    dotted vertical line in the line's own color (not a fixed color)
    rather than an undefined step; the bound
    chart switches to an all-or-nothing mode -- only vertical lines get a
    bar, at full height, with the top tick labeled "∞" -- whenever any
    line is vertical. Also at the user's direction: the two point-control
    number inputs are now paired with two range sliders (one per axis,
    labeled "t-axis intercept" and "V(t)-axis intercept"), and each
    endpoint circle now shows its own line's letter id so a line stays
    identifiable after crossing others. Verified end-to-end via a live
    scripted Chrome DevTools Protocol pass (both the vertical/infinity
    path and the clamped-envelope path), tests/envelope-theorem-model-
    tests.js grew from 22 to 26 tests (26/26 passing), and
    tests/menu-tests.html was independently re-confirmed at 8/8 -- an
    initial "0/8" result during this pass turned out to be a stale debug
    Chrome instance launched without `--allow-file-access-from-files`
    (needed for the menu test's iframe to reach `contentDocument` across
    separate `file://` origins), not a real regression; a fresh instance
    with that flag reproduced 8/8 immediately. See section 6d for the
    full writeup.

Later candidate modules may include reserve-price design, revenue
comparisons, and revenue equivalence or optimal-auction design as a rework
of the current payments-from-allocation-rule draft. Do not build any of
these ahead of user direction.
