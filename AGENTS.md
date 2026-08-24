# AGENTS.md

## Project purpose

The project is named **Mechanism Design Explorer**. Build a coherent library of
textbook-style interactive modules for canonical
mechanism-design problems. EconGraphs is the main interaction reference: each
module centers one precise economic question, one main manipulation, and a
graphical argument that updates immediately.

The primary audience is undergraduate or early graduate economics students.
Assume the user understands economics better than software development. Explain
coding choices in plain language and introduce technical detail only when it
helps the user make a decision.

Before substantial work, read PROJECT_PLAN.md and any theory note for the
module being changed.

## Text authorship

The user is the sole author of visible introductory and explanatory teaching
text for new modules.

- Do not independently draft or expand the page's model description,
  interpretation, derivation, source discussion, pedagogical explanation, or
  concluding prose.
- Before implementation, provide only a broad outline naming the purpose and
  order of the proposed text sections. Wait for the user to supply the prose.
- Preserve user-supplied prose unless the user asks for an edit. If it appears
  theoretically incorrect, identify the issue separately rather than silently
  rewriting it.
- Converting mathematics in user-supplied prose to LaTeX markup is a formatting
  task, not permission to rewrite, expand, or reinterpret the surrounding
  prose.
- Structural placeholders may be used in planning documents or non-visible
  comments. Do not publish placeholder lesson copy on a module page.
- Short functional labels, control names, mathematical symbols, accessibility
  descriptions, validation errors, and navigation statuses may be written as
  needed. If a label itself teaches or interprets an economic result, request
  the user's wording.

The broad page-text outline for a new module is:

1. User-supplied title.
2. User-supplied economic environment and assumptions.
3. User-supplied focal decision, fixed opponent behavior, and solution concept.
4. User-supplied strategy or benchmark statement needed to read the graph.
5. Interactive model parameters and figure.
6. A section for user-supplied derivation or formal analysis.
7. A Notes section containing user-supplied bulleted notes.
8. A References section containing bibliographic citations.

This is a structural checklist, not permission to generate the prose within
those sections.

## Current status and module organization

The first-price IPV module is the approved reference implementation for the
project's visual and interaction style. It is available at:

    auctions/first-price/index.html

The root index.html is the module menu. It groups modules into horizontal
category rows. There are currently two categories, Auctions and Bilateral
Trade. Both the first-price and second-price auction modules are implemented
and selectable. The second-price route is:

    auctions/second-price/index.html

Its functional demonstration is implemented, but its introductory,
explanatory, derivation, and scope prose remain reserved for the user. Its Notes
section is an empty list with a comment marking where user-authored list items
belong. Its separate References section contains the user-requested Krishna
citation. Do not fill those locations without the user's text.

The Bilateral Trade category's **Myerson-Satterthwaite Theorem** module is
implemented and selectable at:

    bilateral-trade/myerson-satterthwaite-theorem/index.html

Its interactive engine (the paintable 20x20 allocation-rule grid, each cell
split into two independently paintable L/R triangles by its own diagonal,
both for exact diagonal-threshold presets and for direct diagonal painting,
Bayesian (interim) IC monotonicity checks, minimal-rent envelope transfers,
induced budget balance, and the efficiency comparison) is fully implemented
as a compact dashboard: a sized-down main paint chart with a deliberately
narrow q-slider and a horizontal "Presets:" row (five presets, including an
adjustable posted price and the Chatterjee-Samuelson double auction), beside
an explicit three-column by two-row grid of all six diagnostic panels on
wide screens (two 1D interim-probability step charts plus four v-c
triangle-mesh heatmaps), each with its own colored (green/red) text
directly beneath it: the buyer IC and seller IC panels state \(Q_B\)/
\(Q_S\)'s own monotonicity directly (no "Buyer IC: yes/no" wrapper); the
buyer- and seller-utility panels show an always-green expected-rent line,
since ex-post IR holds automatically for any q; and the net-revenue panel
is a single "Expected revenue: [number]." line with no separate yes/no
no-deficit wording, but still colored green/red by whether E[R] is a
deficit, same as every other panel that has a condition to violate — its
plot remains a full pointwise heatmap like the rest — and no explanatory
prose or formula blocks in that diagnostics area (removed at the user's
direction). The selected triangle's
cell range and L/R side appear dynamically in the slider's own label (using
"∈" set-membership notation) and as an in-graph marker, with no separate
text readout. The page title and
introductory environment/assumptions prose are user supplied, and its separate
References section cites Myerson and Satterthwaite (1983). Its Notes list
remains reserved and empty for the user.

Both auction modules use a translated and scaled Beta value distribution. The
shape parameters are always available, with alpha = beta = 1 as the default
uniform case. There is no distribution selector. This implemented modeling
capability is not permission for the assistant to add visible explanatory
prose about distributions.

Both module pages load the project's vendored MathJax 4 TeX-to-SVG build for
ordinary HTML mathematics. The assets and configuration are local so the pages
remain usable offline through file://; custom graph SVG labels remain plain.

## Communication

- Answer the user's question directly. Do not add adjacent features or redesign
  the project unless asked.
- If a theoretical or implementation claim is uncertain, say "I don't know"
  and explain what would resolve it.
- State material economic assumptions instead of silently choosing among
  different models.
- Distinguish an approved convention, a module-specific choice, and a temporary
  placeholder.
- When answering theoretical questions, consult relevant primary literature
  and quote it where relevant. Give precise page, proposition, theorem, or
  equation references when available.

## Reusable page and interaction style

Use these conventions across modules unless the user changes them:

- Use a plain white page and Times New Roman for ordinary visible text,
  controls, and SVG labels. HTML mathematics is rendered by the project's local
  MathJax fonts.
- Keep the module page barebones. Avoid shadows, rounded cards, decorative
  callouts, icons, ornamental badges, and dashboard-style metric panels.
- Use ordinary textbook headings. Avoid editorial labels such as "Read the
  move" or "What to notice."
- Reserve page locations for the user-authored environment before the demo,
  user-authored derivation after it, and user-authored bullets in Notes.
- Use page-level horizontal rules only between the introduction and demo,
  between the demo and derivation, and as a faint separator before Notes.
  On the auction pages this introduction-to-demo rule is the `border-top`
  already carried by `.model-specifications` (`margin: 3.2rem 0 1.4rem;
  padding: 1.45rem 0 0.55rem; border-top: 1px solid var(--line);` in
  `styles.css`), since that section sits between `.introduction` and
  `.explorable`. A module with no `.model-specifications` section — the
  bilateral-trade module, which has no adjustable shape controls — has
  nothing to carry that rule, so `.explorable` would otherwise sit flush
  against the introduction with no separator at all. `styles.css` provides
  a `.explorable-divider` modifier class that reproduces the identical top
  margin/padding/border-top values (see the "Bilateral-trade module"
  section of `styles.css`); the bilateral-trade `index.html` applies it as
  `class="explorable explorable-divider"` so the introduction-to-demo rule
  matches all three modules' spacing exactly. Give any future module with
  no `.model-specifications` section the same `explorable-divider` class
  rather than inventing new spacing values.
- Put n, a, b, alpha, beta, and the live value-PDF preview above the graphic in
  one compact, top-aligned horizontal row whenever the available width permits.
  Reflow that single parameter group responsively rather than creating a
  separate shape-control section.
- Align the "PDF of Value" caption with the left edge of its plotted density
  area. Do not add a separate value-distribution equation below the parameter
  row.
- Keep the gap from the parameter row to the panels and the gap after the
  interactive figure modest. Display an introductory equilibrium equation at
  the same size as ordinary body text.
- Give the interactive figure most of the available width. Put
  learner-specific controls to its right on wide screens and below it on narrow
  screens.
- Pair editable number inputs with sliders. Keep both synchronized with graph
  dragging, keyboard interaction, random draws, resets, and parameter changes.
- Update deterministic outputs continuously; do not add a Run button.
- Prefer direct graph labels to legends. Keep relevant metrics in the SVG near
  the objects they describe rather than duplicating them in result cards.
- The first panel's shaded area and the second panel's selected-point guide both
  report probability of winning. In the second panel, place the full dynamic
  probability label at the probability axis rather than beside the selected
  bid; it must not create a title-row metric. The expected-payoff annotation
  appears in the second panel.
- Probability and expected-payoff annotations must always remain visible. Keep
  a first-panel probability annotation inside its highlighted geometry only
  when both its width and height fit; otherwise attach it beside the selected
  bid marker, preferring the marker's right side and flipping left near the plot
  boundary. Keep expected payoff anchored near the selected in-graph bid
  control when it leaves its colored area. For expected payoff,
  horizontal width alone determines whether the annotation moves: insufficient
  height must not dislodge it. Do not put these metrics to the right of panel
  titles.
- Keep graph annotations compact. Try semantic one-, two-, and three-line SVG
  layouts before suppressing optional labels. Use a white halo where text may
  cross plotted geometry and never allow labels to leave the viewBox.
- Use MathJax only for mathematics in ordinary HTML. Custom graph SVG labels
  remain Unicode/plain text and must not be included in MathJax typesetting
  targets.
- Use common colors consistently across linked panels, but also use line style,
  shape, and direct labels so color is never the sole signal.
- Put axes at economically meaningful zero points when applicable. Share a
  domain across aligned panels when doing so is not misleading.
- Clamp direct graph dragging to the support endpoints: when the pointer leaves
  the plot on either horizontal side, the selected bid must be exactly a or b,
  not merely close to the endpoint.
- Keep reset and random-draw actions quiet and plainly labeled.
- Do not show a visible paragraph explaining dragging, keyboard shortcuts, or
  responsive control placement. Preserve those capabilities through semantic
  markup and accessible descriptions.
- Reuse layout and interaction conventions, not mechanism-specific graph
  content. Each new mechanism must earn its own visual representation.

The root menu is the one place where rectangular module tiles are appropriate.
Arrange them in category rows with square corners, restrained borders, module
titles, and plain availability statuses. Do not add theoretical summaries to
the menu unless the user supplies them. Do not make an unfinished module a
clickable dead end.

## Economic standards

- Consult primary mechanism-design literature for theoretical claims.
- Never call a mechanism or strategy optimal without stating the objective,
  beliefs, admissible choices, and assumptions under which it is optimal.
- Every module must have user-supplied text stating its agents, timing,
  information, preferences, type distributions, strategies held fixed, and
  solution concept before the interaction is considered complete.
- Distinguish exact formulas, numerical quadrature, numerical optimization, and
  Monte Carlo simulation in code and interface labels.
- Do not infer a general theorem from a special case such as iid uniform values.
- Clearly distinguish payment conditional on winning, expected payment, payoff
  conditional on winning, and expected payoff.
- Treat continuous-type ties as zero-probability events and state the chosen
  tie rule in the user-authored model text.
- Derive and test the economics before drawing the graph.

## First-price reference model contract

The current first-price module has:

- one indivisible object;
- n >= 2 risk-neutral bidders;
- iid private values drawn from the translated and scaled Beta distribution on
  [a,b];
- finite support endpoints satisfying 0 <= a < b;
- a focal bidder 1 with known value v_1 in [a, b];
- n - 1 opponents using the symmetric first-price equilibrium strategy; and
- a focal bid x_1 chosen from [a, b].

The implemented distribution is

    Value = a + (b-a)Z, where Z ~ Beta(alpha,beta)

with alpha and beta independently adjustable on [0.2,10]. Alpha = beta = 1 is
the default and gives Uniform[a,b]. Do not interpret a and b as separate
location and scale parameters: they remain the lower and upper endpoints of
the value support.

Let X_1, ..., X_(n-1) be independent draws from the common distribution and
define Y_1 = max{X_1, ..., X_(n-1)}. The symmetric first-price equilibrium
strategy is:

    beta^I(v) = E[Y_1 | v > Y_1].

For Uniform[a, b]:

    beta^I(v) = a + ((n - 1) / n)(v - a).

For Uniform[a,b], against equilibrium opponents, the focal bidder's probability
of winning with bid x_1 is:

    0,                                                     if x_1 <= a
    [n(x_1-a) / ((n-1)(b-a))]^(n-1),                      if a < x_1 < beta^I(b)
    1,                                                     if x_1 >= beta^I(b).

The displayed quantities are:

    payment if the bidder wins = x_1
    payoff if the bidder wins = v_1 - x_1
    expected payment = x_1 Pr(win | x_1)
    expected payoff = (v_1 - x_1) Pr(win | x_1).

Expected payoff is maximized at beta^I(v_1). Any further distribution must
provide a tested CDF, equilibrium bid function, and inverse strategy where
needed. Do not enable a distribution until its economic and numerical contract
is implemented.

For transformed Beta values, evaluate the same equilibrium definition using
the selected CDF. Use numerical integration for the equilibrium bid and
numerical inversion where the highest-opposing-bid distribution requires it.
Retain the analytic Uniform formulas as tested shortcuts. The shared
js/distributions.js kernel supplies validation, CDFs, PDFs, quantiles, and
integration; mechanism files remain responsible for auction-specific formulas.

## First-price reference visual contract

These details describe the existing first-price module. They are a regression
contract for that module, not a mandatory graph design for second-price or
other mechanisms.

- The bid and value number inputs and sliders span [a, b] and remain
  synchronized. The proposed-bid number is rounded to the nearest tenth without
  a trailing zero for whole numbers.
- A separate button draws a focal private value without changing the proposed
  bid or global model parameters.
- The first panel is titled "PDF of highest opposing bid." Do not append a beta
  expression to this title. It shades the density through x_1, capped at
  beta^I(b), and always labels the resulting "Probability of winning," moving
  it beside the x_1 marker when either its width or height does not fit.
- The second panel has no vertical- or horizontal-axis title. The CDF rectangle
  has height Pr(win | x_1), signed width v_1 - x_1, and signed area equal to
  expected payoff. Its single
  expected-payoff annotation is always visible. Keep it on the rectangle when
  it fits horizontally even if the rectangle is too short; when the rectangle
  is too narrow, attach it beside the selected x_1 marker and flip sides at a
  plot boundary.
- Label the selected horizontal coordinate only as x_1. Bracket the interval
  from x_1 to v_1 as "Payoff if you win." Do not add a separate payment panel.
- A dashed horizontal guide connects the selected CDF point to its probability.
  Its dynamic label reads "Probability of winning = [number]" at the
  probability axis and stays in the foreground, including at zero and one.
- Label the equilibrium marker as "beta^I(v_1) = [number]." Do not append
  "Maximum at."
- Use solid red geometry, not dashed red geometry, when expected payoff is
  negative.
- Keep the two panels aligned on the same bid domain. Do not add panel
  subtitles, a legend, a separate results section, or an equilibrium-comparison
  section.

## Second-price model and visual contract

The second-price module uses n >= 2 bidders and iid values from the transformed
Beta distribution on [a,b], with finite endpoints satisfying 0 <= a < b.
Alpha = beta = 1 is the default uniform case; shape bounds match the first-price
module. The focal value and proposed bid both
span [a,b]. Its n - 1 opponents bid truthfully:

    beta^II(v) = v.

Let Y_1 be the highest opposing value. Truthful opposing bids imply that the
highest opposing bid is beta^II(Y_1) = Y_1. If F is the selected value CDF,
then G(x)=F(x)^(n-1) is the winning probability. For x in [a,b], define

    I(x) = integral_a^x G(y) dy.

The tested model computes

    Pr(win | x_1) = G(x_1)
    E[payment * 1{win}] = x_1 G(x_1) - I(x_1)
    E[payment | win] = x_1 - I(x_1)/G(x_1), when G(x_1) > 0
    E[payoff] = (v_1-x_1)G(x_1) + I(x_1).

Uniform cases use analytic shortcuts. General transformed-Beta cases use the
shared numerical integration routines. The conditional expected payment is
undefined whenever the winning probability is zero. The focal bid x_1 is a
winning threshold, not the payment; the realized second-price payment is Y_1.

The second-price figure retains the two-panel stacked layout and the shared
controls. Its first panel is titled "PDF of highest opposing bid," without a
beta expression in the title, and shades the PDF of beta^II(Y_1) = Y_1 through
x_1 while retaining the probability-of-winning area label. Its second panel
plots the CDF G of that variable without a vertical-axis title.
For x_1 <= v_1, the green area is

    integral_a^x_1 G(y) dy + (v_1-x_1)G(x_1) = E[payoff].

For x_1 > v_1, retain the truthful green area and show the payoff loss

    integral_v_1^x_1 [G(x_1)-G(y)] dy

as a solid red area. Label the truthful marker
"beta^II(v_1) = [number]." Do not reuse the first-price rectangle
(v_1-x_1)G(x_1), because x_1 is not the second-price payment. Keep probability
and payoff metrics, direct labels, solid negative geometry, and synchronized
interactions consistent with the reference style.
The dashed second-panel guide carries the full dynamic label "Probability of
winning = [number]" at the probability axis rather than near the selected bid.
The green truthful area and red overbid-loss area remain visually distinct, but
do not label them with separate payoff amounts. Show one always-visible net
"Expected payoff" annotation instead. Do not place probability or expected
payoff metrics to the right of the panel titles.
For an overbid, attach a positive or zero net expected-payoff label immediately
left of the selected x_1 marker. Attach a negative net expected-payoff label
immediately right of the selected x_1 marker. Flip sides only when needed to
keep the label within the plot; do not send either label to a detached lower
fallback.
The value control, bid control, and shared graph domain stay on [a,b], and all
update when a or b changes. Reject and revert any bound edit that does not
satisfy 0 <= a < b with finite endpoints. Display both the private-value and
proposed-bid number fields rounded to the nearest tenth, omitting the decimal
place for whole numbers; retain the unrounded internal value for calculations.

## Bilateral-trade model and visual contract

The bilateral-trade module has one buyer with private value v and one seller
with private cost c, both on the fixed support [0,1] and drawn Uniform[0,1]
(no shape controls, no distribution selector, no adjustable support — this
is a module-specific simplification, confirmed with the user, not the
adjustable-Beta-on-[a,b] convention used by the auction modules). The
learner's only control is the allocation rule q(v,c) in [0,1], painted on a
20x20 grid of genuine 0.05x0.05 cells (`CELL_RESOLUTION`/`CELL_SIZE` in
`bilateral-trade/myerson-satterthwaite-theorem/model.js`); every other displayed
quantity is derived from it, never chosen directly.

**Grid architecture (the second, more thorough numerical redesign; at the
user's direction, replacing an earlier 21x21 point-sampled grid).** Cell
(i,j) covers v in [i\*CELL_SIZE, (i+1)\*CELL_SIZE), c in [j\*CELL_SIZE,
(j+1)\*CELL_SIZE) — a genuine interval, not a point, so every cell including
the ones touching v=0, v=1, c=0, c=1 is a full-width square with no
half-width edge tiles. Each cell is further split by its own
bottom-left-to-top-right diagonal into two triangles: `lower` (the
higher-v/lower-c half) and `upper` (the higher-c/lower-v half). A grid is
therefore `{lower, upper}`, two parallel 20x20 arrays (`createCellGrid` in
`model.js`). Painting a cell sets both its triangles to the same value —
from the interaction's point of view this is still "one value per 0.05x0.05
square," matching what the learner directly controls. Only the three exact
preset generators (`efficientGrid`, `postedPriceGrid`,
`chatterjeeSamuelsonGrid`) ever set a cell's two triangles independently.

**Why triangles: exact representation of diagonal thresholds.** A diagonal
threshold like v=c or v-c=1/4 runs exactly along a cell's own diagonal
whenever the threshold is a whole multiple of CELL_SIZE — v=c along every
cell with i=j, v-c=1/4=5\*CELL_SIZE along every cell with i-j=5 — so
`efficientGrid`/`chatterjeeSamuelsonGrid` set that cell's lower-right
triangle (where the threshold interior is strictly satisfied) to 1 and its
upper-left triangle to 0, with zero approximation error, not an
approximation refined by a finer grid. This is why the user asked for the
redesign: a discontinuous q(v,c) painted onto ordinary rectangular cells
cannot represent such a threshold exactly at any finite resolution, but a
triangular mesh aligned with the threshold's own slope can. Posted price
(an axis-aligned, not diagonal, threshold) does not need the triangle split
either way — see below.

**Exact integration, not quadrature.** Because q is piecewise constant on
800 triangles (never interpolated, never resampled onto a second hidden
grid), every quantity this module needs is computed by a genuinely exact
closed form rather than an approximation whose error shrinks with
resolution:
- Welfare W(q)=E[(V-C)q] and the expected-utility identities
  E[U_B]=E[(1-V)q], E[U_S]=E[C\*q] (see below) are each `sumOverTriangles` in
  `model.js`: since the weight (v-c, 1-v, or c) is affine, evaluating it at
  a triangle's centroid and multiplying by the triangle's area
  (`TRIANGLE_AREA`, `triangleCentroid`) reproduces that triangle's exact
  integral — a standard fact about integrating affine functions over a
  region, not a numerical approximation.
- The cumulative envelope utilities U_B(v,c)=integral_0^v q(x,c)dx and
  U_S(v,c)=integral_c^1 q(v,y)dy have closed forms
  (`cumulativeBuyerUtilityAt`/`cumulativeSellerUtilityAt` in `model.js`:
  full rows/columns below/right of the query point contribute exactly, and
  the row/column containing the query point contributes a closed-form
  partial term) that can be evaluated exactly at any (v,c), not merely
  interpolated from samples. Every diagnostic heatmap (buyer/seller
  utility, net revenue, over/under-trade) evaluates these closed forms at
  each of the 800 triangle centroids (`pointwiseTriangleGrid` in
  `model.js`), so what is displayed is an exact value at that specific
  point, not a smoothed or quadrature-approximated one.
- Interim allocation probabilities are exact cell averages, not a
  quadrature approximation of a continuous curve — see below.
- Do not reintroduce a hidden finer grid, bilinear interpolation, or
  trapezoidal quadrature into this module without the user's direction;
  the whole point of this architecture is that none of those are needed.
- One residual approximation: the diagnostic *heatmaps* only sample the 800
  triangle centroids, never the true domain boundary (v=0, v=1, c=0, c=1)
  exactly — the closest centroid is at CELL_SIZE/3 from an edge. This means
  `minValue`/`maxValue` scans of those heatmaps do not report the true
  boundary extremes. `summarize()` therefore sets `minBuyerUtility`/
  `minSellerUtility` to the structural constant 0 directly (see the ex-post
  IR paragraph below) rather than scanning the heatmap sample, and the
  ex-post budget-balance verdicts derive `minRevenue`/`maxRevenue` from the
  centroid sample, which is exact for posted price (R=0 identically, so the
  sample point does not matter) and does not change the qualitative
  pass/fail verdict for the efficient benchmark or the double auction
  (their revenue is far enough from `BALANCE_TOLERANCE` that a
  centroid-vs-corner difference cannot flip the verdict).
- Implementability is checked as Bayesian (interim) incentive compatibility,
  not dominant-strategy/ex-post IC (DSIC) — a deliberate change from the
  module's first version, made at the user's direction after confirming the
  theory. Define the interim allocation probabilities
  `Q_B(row i) = integral_0^1 q(v,c) dc` for v uniform within that row, and
  `Q_S(col j)` symmetrically (`interimBuyerProbability`/
  `interimSellerProbability` in `model.js`): an exact area-weighted average
  over that row/column's 40 triangles, not a quadrature approximation.
  Bayesian IC (Myerson 1981) holds iff `Q_B` is nondecreasing and `Q_S` is
  nonincreasing — strictly weaker than pointwise `q(v,c)` monotonicity,
  since a non-monotonic row/column can still average to a monotonic interim
  probability. `checkBuyerMonotonicity`/`checkSellerMonotonicity` (the
  stronger, pointwise/ex-post condition, adapted to check both a cell's
  triangles row-to-row/column-to-column) remain in `model.js` as tested
  utilities, but are not part of the live diagnostic; do not reintroduce
  them as the primary implementability check without the user's direction.
  `tests/bilateral-trade-model-tests.js` has a dedicated regression test
  constructing a rule that fails pointwise monotonicity on both sides yet
  is exactly Bayesian-IC (columns 0-9 increasing in row, columns 10-19
  decreasing, so every row and column averages to exactly 0.5) — keep it
  passing if this area changes.
- The minimal-rent envelope transfers use the same formulas regardless of
  which IC notion is being checked:

      U_B(v,c) = integral_0^v q(x,c) dx,   p_B(v,c) = v*q(v,c) - U_B(v,c)
      U_S(v,c) = integral_c^1 q(v,y) dy,   p_S(v,c) = c*q(v,c) + U_S(v,c)
      R(v,c) = p_B(v,c) - p_S(v,c)

  This is not a coincidence: averaging the pointwise formula over the
  opponent's type (Fubini) reproduces exactly the standard interim envelope
  expression `(v-v̂)Q_B(v̂) + integral_0^v̂ Q_B(x)dx`, so Bayesian IC of
  `Q_B`/`Q_S` is sufficient for these same transfers to be interim
  incentive compatible — no separate payment formula is needed for the
  weaker notion. These values are still computed (never hidden) when q is
  not IC-implementable. The interface previously showed an explicit caveat
  line ("q is not IC-implementable; this is a formal value only, not an
  achieved outcome.") on the buyer-utility, seller-utility, and net-revenue
  panels whenever `v.icImplementable` was false; that caveat text was
  removed at the user's direction, so those three panels now show only
  their own single line regardless of IC-implementability. The underlying
  fact has not changed — these are still formal envelope-formula values
  rather than an achieved incentive-compatible outcome when q is not
  IC-implementable — do not reintroduce the caveat line without the user's
  direction.
- U_B(v,c) >= 0 and U_S(v,c) >= 0 for any q in [0,1], monotonic or not under
  either notion (this is a fact about the construction, not a consequence of
  IC: IC and IR are logically independent conditions in general, but here
  dU_B/dv = q(v,c) >= 0 and dU_S/dc = -q(v,c) <= 0 always, so combined with
  U_B(0,c)=0 and U_S(v,1)=0 the minimum of each utility over the whole
  domain is always exactly 0). Ex-post IR is therefore automatic under this
  zero-boundary normalization regardless of q, and the module's real,
  discoverable tension is between IC, efficiency, and budget balance, not
  IR. Because the minimum never varies, the IR panels display expected
  utility (information rent), `expectedBuyerUtility`/`expectedSellerUtility`
  in `model.js` (`E[U_B]`, `E[U_S]` under Uniform[0,1]), not the always-zero
  minimum — that is the quantity that actually moves with q. At the user's
  direction these two lines ("Expected buyer rent: [number]." and
  "Expected seller rent: [number].") are always rendered in the pass
  (green) color, unconditionally, rather than the earlier neutral color —
  IR cannot fail here, so the display now always shows it as satisfied
  rather than staying colorless.
- Budget balance is reported at three strengths: ex-post budget balance
  (R=0 everywhere), ex-post no-deficit (R>=0 everywhere), and expected
  budget balance/no-deficit (E[R]>=0), the last computed exactly via
  `welfare(grid) - expectedBuyerUtility(grid) - expectedSellerUtility(grid)`
  (a linear identity from R=(v-c)q-U_B-U_S that survives exactly into the
  expectations, so E[R] needs no separate integral).
- The efficiency benchmark is q\*(v,c)=1{v>c} (`efficientGrid()`). W(q\*)=1/6
  and E[U_B]=E[U_S]=1/6 exactly (not approximately) under Uniform[0,1], so
  E[R]=-1/6 exactly — the intermediary loses exactly the gains from trade on
  every trade because both sides' minimal-rent transfer captures the full
  surplus. The efficiency panel highlights over-trade (v<c, q>0) and
  under-trade (v>c, q<1) triangles with both a color and a non-color mark.
  `efficientGrid()`'s interim probabilities are exactly monotonic (a
  combinatorial fact: `Q_B(row i)` is a sum over a strictly growing set of
  fully-1 columns as `i` grows), so it is IC-implementable under both
  notions.
- `efficientWelfare()` (the W(q\*) benchmark used for every efficiency-loss
  comparison) must be `welfare(efficientGrid())` — the identical function
  `summarize()` calls for any painted grid's own welfare, on the identical
  fixed grid — so painting exactly the efficient preset always reports
  exactly zero efficiency loss. `tests/bilateral-trade-model-tests.js` has a
  dedicated regression test for this — keep it passing if this changes.
- The default view on load, and the target of the "Efficient benchmark"
  preset, is the efficient benchmark — it already demonstrates the core
  IC/IR/efficiency-versus-budget-balance tension the module exists to show.
  There is no separate Reset button and no Random preset; the five presets
  are Efficient benchmark, Always trade, Never trade, Posted price, and the
  Chatterjee-Samuelson double auction.
- Posted price (`postedPriceGrid(price)` in `model.js`): trade iff v>=price
  and c<=price. Its own price slider/number input (`#posted-price-control`,
  `step="0.05"`, matching CELL_SIZE) is unhidden when this preset is
  selected and fully regenerates the grid from the new price on every
  input, discarding any prior manual edits, the same way every other preset
  overwrites the grid; painting a cell manually, or choosing a different
  preset, hides the slider again (`hidePostedPriceControl()` in `app.js`).
  `postedPriceGrid` rounds price to the nearest cell boundary
  `k*CELL_SIZE` and classifies whole cells, not sampled points: row i is
  v>=price throughout iff i>=k; column j is c<=price throughout iff j<k.
  Both triangles of a cell always get the same value (posted price has no
  diagonal dependence). Its minimal-rent transfers work out to exactly
  p_B(v,c)=p_S(v,c)=price\*q(v,c), so R(v,c)=0 everywhere — exact ex-post
  budget balance, at the cost of trading only when both sides clear the
  single price rather than whenever v>c (inefficient whenever 0 < |v-c| gap
  is on the wrong side of the price). Unlike the module's first,
  point-sampled architecture (where a price landing exactly on a grid
  coordinate broke this exactness and needed a `POSTED_PRICE_GRID_NUDGE`
  workaround, since removed), R(v,c)=0 now holds at *every* price,
  including the grid-aligned ones and the p=0/p=1 boundaries, because a
  boundary between whole cells is never inside a cell's own interior — there
  is no tie to break. `tests/bilateral-trade-model-tests.js` verifies this
  pointwise at every one of the 800 triangle centroids for a spread of
  prices, not just in expectation.
- Chatterjee-Samuelson double auction (`chatterjeeSamuelsonGrid()` in
  `model.js`): the allocation induced by the symmetric linear Bayes-Nash
  equilibrium of the k=1/2 double auction (Chatterjee and Samuelson 1983)
  under Uniform[0,1] — b(v)=2/3 v+1/12, a(c)=2/3 c+1/4, trade iff
  b(v)>=a(c), which reduces to v-c>=1/4. Trade is decided by comparing the
  integer cell indices `i-j >= 5` directly (never by subtracting two
  floating-point coordinates), so — unlike the module's first architecture,
  where `v-c>=0.25` occasionally lost the comparison to floating-point
  cancellation right at the boundary and needed an `EPSILON` guard, since
  removed — there is no floating-point cancellation possible here at all.
  W(q)=E[(V-C)1{V-C>=1/4}]=9/64 exactly and E[R]=0 exactly (not merely
  convergent with resolution): this module's own minimal-rent transfers for
  this q differ pointwise from the double auction's actual (a+b)/2 price,
  but by revenue equivalence their expected value must agree, and the real
  double auction is budget balanced by construction (a direct bilateral
  trade with no intermediary) — this exact match is a correctness check on
  the envelope-formula transfers, not a claim that the displayed pointwise
  R(v,c) equals the real mechanism's own price.
- The net-revenue plot itself (`#budget-chart`) is unchanged: still the
  pointwise v-c heatmap of R(v,c) via `drawTriangleMesh`/`divergingScale`,
  same as the other three heatmap panels. The `.diagnostic-text` block
  beneath it (`#budget-text`) has gone through a few rounds of
  simplification at the user's direction: first from three lines (ex-post
  budget balance, ex-post no-deficit, expected no-deficit) down to a single
  "Expected no-deficit (E[R] = [number]): yes/no." line colored by
  `expectedNoDeficit`; then the wording was trimmed to just "Expected
  revenue: [number]." with no yes/no phrase — briefly rendered in the
  neutral color, but the user then asked that violated conditions always
  read red, so it is colored by `expectedNoDeficit` again (`"pass"` when
  E[R] >= 0, `"fail"` — red — when it is a deficit), same as every other
  panel that has a condition to violate; only the "no-deficit: yes/no."
  wording stays gone, not the coloring. The three underlying verdicts
  (`exPostBudgetBalanced`, `exPostNoDeficit`, `expectedNoDeficit`) remain
  available as `#budget-text` dataset attributes (and are still asserted
  in tests) even though only `expectedNoDeficit` now drives the visible
  color and none of the three is spelled out as text.

The diagnostics area carries no independently authored explanatory prose or
formula blocks: it is a compact dashboard, not a sequence of
`.derivation`-style sections.

**A blank `.derivation` section now sits below the demo** (below
`.explorable`, above `.notes`), heading "Incentive compatibility, individual
rationality, and the payment rule" (`id="payment-rule-title"`), added at the
user's explicit request as an empty container only — currently just the
`<h2>` and a placeholder HTML comment, no `<p>`, no equations, no `<h3>`
subsections. **Do not draft, expand, or pre-fill any prose, derivation, or
formula into this section under any circumstance, even if asked to "add a
section" or "add content" elsewhere on this page.** This is the same
Text authorship rule at the top of this file, restated here because it was
violated once already for this exact section: a full derivation (IC
monotonicity, the envelope/payment-rule construction, the budget-balance
identity) was drafted and published into it unprompted, then had to be torn
back out at the user's correction. The user is the sole author of this
section's text; wait for them to supply it. `.derivation`'s shared CSS
(`styles.css`) and its MathJax typeset registration (see "Mathematics
rendering contract") are already wired up so their prose renders correctly
the moment they add it — that wiring is not an invitation to add the prose
yourself.

The interaction area is `.bilateral-layout`, a
row with two children: `.bilateral-main-column` (the sized-down paint chart
stacked above its controls) and `.diagnostic-panel-grid` (positioned to the
right of the main column on wide screens and wrapping below it on narrow
ones). `.diagnostic-panel-grid` uses `grid-template-columns:
repeat(3, minmax(0, 1fr))`, with a 600px flex basis beside the 480px main
column, so all six panels form three columns and two rows while the overall
interaction uses the same full `.page-width` as the auction demos. At the
existing narrow breakpoint the grid becomes a single centered column. DOM
order (buyer IC, seller IC, buyer utility, seller utility, net revenue,
efficiency) is preserved. Buyer IC (`Q_B(v)`) and seller IC (`Q_S(c)`) are
1D step charts; the other four remain v-c heatmaps. Each panel is a small
figure with a short figcaption; directly below each panel's figure, its own
`.diagnostic-text` block reports the relevant condition(s) as short,
always-visible lines, colored green (`.verdict-pass`) when the condition
holds and red (`.verdict-fail`) when it does not.

The learner paints individual triangles, not whole cells: each cell's
lower-right ("R") and upper-left ("L") triangle is independently selectable
and paintable (`state.selected = {i, j, isLower}` in `app.js`; `isLower:
true` is R, `false` is L), so a diagonal pattern can be painted directly by
dragging along a cell's own diagonal, not just by the exact preset
generators. Selecting one triangle never reads or writes the other — there
is no averaging or copying between them. `l`/`L` and `r`/`R` keys select the
current cell's left/right triangle respectively (declared in
`aria-keyshortcuts` alongside the arrow keys and Home/End, which move
between cells while preserving the current L/R side); the in-graph cursor
(`.cell-cursor`) is now the specific triangle's own `<polygon>`, not the
whole cell's `<rect>`.

The selected-triangle control label (`#cell-value-control-label`) reads
"Allocation probability on v ∈ [lo, hi), c ∈ [lo, hi), L" (or "R") with the
selected cell's own v- and c-ranges (`formatCellRange`/
`formatSelectionDescription` in `app.js`) and the selected triangle's side,
e.g. "Allocation probability on v ∈ [0.35, 0.40), c ∈ [0.60, 0.65), R" —
updated on every selection change in `syncCellControls()`. The "∈" is a
plain Unicode character (U+2208), not MathJax: this label updates on every
paint stroke, arrow key, and drag frame, and MathJax's
typesetClear/typesetPromise lifecycle used elsewhere in the project for
dynamic HTML math would add visible lag/flicker at that update rate for no
benefit, since "∈" already renders correctly in any font without it — do not
convert this label to a MathJax target without the user's direction. The
diagnostic figcaptions remain MathJax, since they only render once on load
(`\(Q_B(v)\)`, `\(Q_S(c)\)`, `\(U_B\)`, `\(U_S\)`, `\(R\)`). The dynamic
`.diagnostic-text` verdict lines below the buyer/seller IC panels reference
the same `Q_B`/`Q_S` notation, but for the same reason as the selected-
triangle label they are not a MathJax target: they update on every paint
stroke. Writing the variable name as a literal underscore ("Q_B") read as
unrendered raw notation next to the properly-typeset figcaption above it,
so `renderDiagnosticLines`/`appendFormattedText` in `app.js` build these
two lines from `segments` arrays (a plain string, or a `[base, sub]` pair
rendered as text followed by an actual `<sub>` element) instead of a plain
string — a lightweight DOM-level subscript, not MathJax, consistent with
this text staying outside the MathJax typesetting lifecycle. There is no
longer a separate "Selected cell: ..." text readout below the slider
(removed at the user's direction); the same range and L/R side are also
shown as a halo-backed in-graph label (`drawCellLabel` in `app.js`) anchored
just above the selected cell's outline on the main paint chart, flipping
below when too close to the top edge and flipping its horizontal anchor near
the left/right edges — this is the only in-SVG dynamic text on the page
besides axis ticks, and (per the project's Unicode/plain-text convention for
custom graph labels) it is not a MathJax target. The preset buttons are
`.preset-buttons`, a horizontal (`flex-direction: row`, wrapping) row
prefixed with a plain "Presets:" label (`.preset-buttons-label`), not a
vertical stack. The module's `app.js` typesets `.introduction`,
`.choice-controls`, `.explorable`, `.notes`, and `.references` for the
remaining static HTML math (the figcaptions). Do not add prose paragraphs,
equation-display blocks, or section headings back into the diagnostics area
without the user's direction — the user explicitly removed them in favor of
this compact, colored-verdict layout.

The two IC panels are a new visual form for this module: since Bayesian IC
is a statement about the cell-averaged interim probability (the agent's own
type averaged over the opponent's), they are drawn as staircase/step charts
(`drawStepChart` in `app.js`, not the earlier `drawInterimCurve` line
chart) — one horizontal segment per row/column's exact average, one
vertical step between consecutive cells, with a violating step drawn in red
and its endpoints marked with a filled circle; connecting cell averages with
a straight diagonal line (as the module's first, point-sampled architecture
did) would imply a continuous interpolation between rows that the new
cell-averaged quantity does not represent. The four v-c heatmap panels
render every cell as two triangles (`drawTriangleMesh` in `app.js`, SVG
`<polygon>` elements, not `<rect>`): a cell whose two triangles happen to
share a value (the common case — either both untouched, both set by a
diagonal-respecting preset off its threshold, or both painted the same way)
reads as an ordinary flat square, while a preset cell straddling a
diagonal threshold, or a cell whose two triangles were deliberately painted
differently, visibly shows the split — there is no separate "display
resolution" and no interpolation-driven blending, since `drawTriangleMesh`
renders exactly the 800-triangle mesh the model computes on. Do not
reintroduce a smoothed/finer display grid, or revert diagnostic heatmaps to
flat per-cell rectangles, without the user's direction. All six panels
update immediately and together as the learner paints; there is no Run
button and no per-panel show/hide toggle. Painting always edits the true
selected triangle (`Math.floor(coordinate / CELL_SIZE)` from the pointer
position for the cell, clamped to [0, CELL_RESOLUTION-1], plus a
local-offset comparison — `pointerToTriangle` in `app.js` — for which of
the cell's two triangles the pointer is over; not nearest-index snapping to
a point, and not "both triangles of the nearest cell"). Keyboard users
select a triangle with arrow keys for the cell (Home/End jump to the
leftmost/rightmost column, preserving the current L/R side) plus `l`/`r` for
the side, and edit its value with the paired "selected triangle" slider and
number input — this pair is the complete keyboard/AT path for painting, in
addition to preset buttons for bulk patterns. Text sizing
throughout — SVG axis/caption text and the diagnostic-text lines — follows
the same size conventions already used elsewhere on the page (`.axis-text`
at 12px, `.panel-caption` at 14px, small status/label text at 0.82-0.88rem),
and panel viewBox dimensions are chosen so on-screen SVG text renders at
close to a 1:1 unit-to-pixel ratio, matching the rest of the page rather
than appearing oversized or undersized relative to it.

## Shared distribution contract

- Both modules always use Value=a+(b-a)Z with Z distributed Beta(alpha,beta);
  a and b are support endpoints. There is no distribution selector.
- Alpha and beta each remain within [0.2,10]. Their typed fields and sliders
  stay synchronized and are always visible. Alpha = beta = 1 is the default
  and reproduces Uniform[a,b].
- Put n, a, b, alpha, beta, and a small live figure labeled "PDF of Value" in
  one compact parameter row on wide screens. Align its caption with the plotted
  PDF area. The figure uses the current a, b, alpha, and beta, and the row
  reflows on narrower screens. Do not repeat the value-distribution equation
  beneath the row.
- Both focal values and proposed bids remain in [a,b] for both mechanisms.
- Random private values are produced by applying the current Beta
  distribution's quantile function to a uniform random draw.
- Endpoint-singular Beta densities are mathematically permitted. Plotting code
  must keep every SVG coordinate finite while preserving accurate interior
  calculations.
- The user-authored first-price section "Optimal bid for bidder 1" proves the
  best response for the full supported continuous Beta family through the
  opponent-maximum CDF \(G(y)=F(y)^{n-1}\). Keep it visible for every shape and
  do not replace or expand its teaching prose without the user's text.

## Multi-module architecture

- Keep the site static and no-build during this stage. Its only vendored runtime
  dependency is MathJax 4; HTML, CSS, JavaScript, and the local MathJax assets
  must work through file:// without a server, account, build step, or network
  connection.
- Root index.html is the menu, not a lesson page.
- Use explicit module routes of the form:

      <category-slug>/<module-slug>/index.html

  for example `auctions/first-price/index.html` or
  `bilateral-trade/myerson-satterthwaite-theorem/index.html`. Explicit index.html links
  are required because directory-index resolution is unreliable through
  file://.
- Keep shared visual styles in root styles.css. Keep mechanism calculations in
  pure functions and DOM/SVG behavior separate.
- Shared distribution mathematics belongs in js/distributions.js. It exposes
  validation, CDF, PDF, quantile, and integration operations used by the
  auction mechanisms, which share the adjustable-Beta-on-[a,b] convention. The
  bilateral-trade module fixes Uniform[0,1] for both types and does not use
  this shared kernel; its own small numerical kernel (grid interpolation,
  monotonicity checks, envelope integrals, quadrature) lives entirely in its
  own model.js.
- The first-price module uses auctions/first-price/model.js and app.js. The
  second-price module uses auctions/second-price/model.js and app.js with
  the isolated global SPAModel. The bilateral-trade module uses
  bilateral-trade/myerson-satterthwaite-theorem/model.js and app.js with the
  isolated global BilateralTradeModel. Each additional mechanism should
  receive module-specific files rather than overloading an existing model.
- Shared page scaffolding that is byte-for-byte identical across module
  pages lives in js/components.js as native (autonomous) Custom Elements,
  at the user's direction, rather than being copy-pasted into each
  index.html: `<page-header category="..." home="...">` renders the
  wordmark-plus-category row, `<page-footer>` renders the shared footer
  content, and `<model-parameter-controls>` renders the entire Beta-shape
  parameter row (bidder count, support bounds, alpha/beta sliders, the
  live "PDF of Value" preview, and the input-error region) that
  first-price and second-price share exactly. Each element renders into
  its own light DOM (no shadow root), so the nodes it injects are ordinary
  document children — reachable by `document.getElementById`/
  `querySelector` and styled by the shared styles.css exactly as if they
  had been typed by hand, with no `::part`/`::slotted` piercing needed.
  The outer semantic wrapper — `<header class="site-header">`,
  `<footer class="site-footer">`, and
  `<section class="model-specifications" aria-labelledby="parameters-title">`
  — stays hand-written in each index.html rather than being absorbed into
  the custom element, so the page keeps its native `banner`/`contentinfo`
  landmark roles (from the real `<header>`/`<footer>` tags) and its
  `.model-specifications` CSS spacing (the introduction-to-demo rule) with
  no extra role/class attributes needed on the custom tag itself; only the
  markup that actually varied or was duplicated goes inside the custom
  element. Each page loads `js/components.js` with `defer`, ordered before
  its own model.js/app.js, so by the time `DOMContentLoaded` fires and
  `app.js` looks up ids like `#bidder-count`, the custom elements have
  already upgraded and injected their content (custom elements upgrade
  synchronously as soon as `customElements.define` runs, and deferred
  scripts run in document order before `DOMContentLoaded`). Root
  index.html (the menu) intentionally does NOT load js/components.js or
  use these elements — its header/footer stay hand-written, since
  tests/menu-tests.js asserts the menu page loads zero `<script>` tags at
  all; do not add components.js there without revisiting that test and
  its underlying "keep the menu barebones" intent. This is deliberately
  the native-browser-API answer to duplication, not a framework or
  bundler: `class ... extends HTMLElement` is the one place in the
  project's JavaScript that uses ES6 class syntax rather than the
  project's usual ES5 (var, no arrow functions, no template literals)
  style, because the Custom Elements API requires a real class —
  HTMLElement cannot be subclassed with a plain ES5 constructor function.
- Keep model, interface, distribution, and menu tests runnable in a browser
  under tests/. The shared kernel is covered by tests/distribution-tests.html
  and tests/distribution-tests.js. The shared page components are covered by
  tests/components-tests.html and tests/components-tests.js.
- Do not introduce a framework, bundler, backend, database, analytics, or
  account system unless the user requests it.
- Duplication has already made a shared component system useful once (the
  page header/footer and the auction pages' parameter row, above); reassess
  further only when new duplication or the user's authoring workflow calls
  for it. Prefer extending js/components.js with another light-DOM custom
  element over copy-pasting markup into a new module's index.html.

## Mathematics rendering contract

- Write inline mathematics in HTML with `\(...\)` and display mathematics with
  `\[...\]`. Do not use `$...$` or `$$...$$` delimiters.
- Load `js/mathjax-config.js` before `assets/mathjax/tex-svg.js`. Both files are
  local project assets so module pages continue to work offline through
  file://. Do not replace them with a CDN URL.
- The shared configuration disables automatic startup typesetting and excludes
  `svg` elements. Each module explicitly typesets its initial HTML mathematics
  in the top-level section classes that are present. The first-price and
  second-price pages typeset `.introduction`, `.model-specifications`,
  `.choice-controls`, `.derivation`, `.notes`, and `.references` — including
  `.model-specifications`, so the `\(n\)`/`\(a\)`/`\(b\)`/`\(\alpha\)`/
  `\(\beta\)` delimiters rendered by `<model-parameter-controls>` (see
  "Multi-module architecture") are typeset the same as if that markup had
  been typed by hand, since it is ordinary light-DOM content by the time
  this selector runs. The bilateral-trade module's diagnostics area still
  carries no formula blocks of its own (see "Bilateral-trade model and
  visual contract"), but the page now also has a blank `.derivation` region
  below the demo, reserved for the user's own text (see the callout in that
  same section — do not fill it in). It typesets `.introduction`,
  `.choice-controls`, `.explorable`, `.derivation`, `.notes`, and
  `.references`.
- For a dynamic HTML math node, call `MathJax.typesetClear([node])` before
  replacing its contents, then call `MathJax.typesetPromise([node])` after the
  replacement. Serialize these operations and expose the current queue through
  `window.mechanismMathReady` so tests and later updates can wait for rendering.
- Set a dynamic node's raw TeX with `textContent`; do not inject it as HTML. Do
  not send custom graph SVG nodes through MathJax.
- Preserve the local MathJax license and every asset needed by the configured
  TeX-to-SVG build when updating the vendored package.

## Mathematical and numerical validation

- Derive or cite every displayed formula.
- Test endpoints, shifted supports, bidder counts, and invalid parameters.
- Prevent NaN, Infinity, or plausible-looking output from invalid settings.
- Test the absence of a distribution selector, always-visible shape controls,
  shape limits, transformed supports, distribution quantiles, and Beta(1,1)
  agreement with Uniform.
- Test endpoint-singular Beta shapes and require finite rendered SVG geometry.
- Generate a visual object and its numerical label from the same model
  function.
- Test claimed optima on a dense grid or with an exact argument as appropriate.
- Distinguish analytic curves from simulated estimates.
- Add mechanism-specific invariants before declaring a module complete.
- Verify that every module loads MathJax only from local paths, renders its
  initial HTML equations, and leaves no visible raw `\(` or `\[` delimiters.
- After each dynamic math update, wait for `window.mechanismMathReady` and test
  both the new source and rendered output. Confirm that repeated updates do not
  accumulate obsolete MathJax output.
- Confirm that custom graph SVGs contain no MathJax containers and that their
  Unicode/plain labels continue to update normally.

For the first-price reference module, retain tests that probability lies in
[0,1], reaches one at beta^I(b), and is weakly increasing; payment conditional
on winning equals x_1; and expected payoff is maximized at beta^I(v_1).

For the bilateral-trade module, retain tests that the exact diagonal-threshold
presets and direct diagonal painting reproduce their control values exactly
(no finer display grid, no interpolation) and preserve row/column
monotonicity; both the pointwise (`checkBuyerMonotonicity`/
`checkSellerMonotonicity`) and interim (`checkInterimBuyerMonotonicity`/
`checkInterimSellerMonotonicity`) monotonicity detectors correctly flag
deliberately broken synthetic grids and clear clean ones;
`interimBuyerProbability`/`interimSellerProbability` match exact closed
forms; the dedicated regression test showing Bayesian IC is strictly weaker
than pointwise DSIC (a rule failing pointwise monotonicity on both sides
while its interim probabilities stay exactly linear) keeps passing; the
q=0, q=1, and efficient-benchmark closed forms in the "Bilateral-trade model
and visual contract" section above hold at a resolution independent of the
live pipeline's constants; U_B and U_S stay nonnegative and vanish at their
boundary type for both monotonic and non-monotonic grids; and every verdict
scalar and display grid stays finite for the default, random, all-zero, and
all-one grids, including when IC fails.

## Accessibility and responsive design

- Associate every control with a programmatic label.
- Make the complete interaction usable by keyboard.
- Give each SVG a dynamic accessible title and description.
- Provide a restrained aria-live summary for changing results.
- Use visible focus indicators and touch targets of roughly 44 CSS pixels.
- Never rely on color alone and maintain WCAG AA contrast.
- Respect reduced-motion preferences.
- Test at 320, 375, 768, and 1280 CSS pixels and at 200 percent zoom.
- Keep graph manipulation supplemental; all choices must remain controllable
  through synchronized labeled form controls.

## Workflow for a new module

1. Confirm the economic question, assumptions, and learner-controlled choice.
2. Check the relevant theory and primary literature.
3. Give the user only a broad outline for the page text.
4. Wait for the user to supply introductory and explanatory prose.
5. Derive and test pure model functions.
6. Build the smallest interaction that makes the intended comparison visible.
   Use the shared `<page-header>`/`<page-footer>` custom elements from
   js/components.js for the new page's header and footer (and
   `<model-parameter-controls>` if the module uses the adjustable-Beta-on-
   [a,b] convention) rather than copy-pasting that markup.
7. Insert the user-supplied text without independently expanding it.
8. Run mathematical, interface, accessibility, responsive, and visual checks.
9. Add the module's working link to the appropriate menu category.
