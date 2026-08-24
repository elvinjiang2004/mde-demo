# Mechanism Design Explorer

A static, no-build collection of textbook-style, interactive, mechanism-design
modules. MathJax 4 is vendored locally for mathematical typesetting.

## Open the site

Open index.html in a modern browser. It is the module menu and requires no
installation, local server, or internet connection.

The available modules are located at:

    auctions/first-price/index.html
    auctions/second-price/index.html
    bilateral-trade/myerson-satterthwaite-theorem/index.html

Explicit index.html paths are used so navigation works through file://.

## Current menu

The menu currently contains two categories, Auctions and Bilateral Trade:

- First-Price Auction Equilibrium — available.
- Second-Price Auction Equilibrium — available.
- Myerson-Satterthwaite Theorem — available.

## Text workflow

The user writes the introductory and explanatory teaching prose for new
modules. Before implementation, the assistant provides only a broad outline of
the page sections and waits for the user's copy. New model controls do not grant
permission to add lesson explanations. The user-authored first-price optimal-bid
proof applies to the supported continuous Beta family and remains visible as
alpha and beta change. Both auction pages keep Notes as an empty user-authored
list with a nonvisible HTML comment marking where future `<li>` entries belong.
Each auction page places the user-requested Krishna citation in a separate
References list. The Myerson-Satterthwaite page contains the user's supplied
introduction, keeps Notes reserved and empty, and cites Myerson and
Satterthwaite (1983) in References. Its diagnostics area is a compact
dashboard of six panels with short colored (green/red) verdict text and no
explanatory prose or formula blocks, at the user's direction.

## Writing mathematics

Write mathematics in ordinary HTML with MathJax's LaTeX delimiters:

- Inline: `\(v_1\)`
- Display: `\[\beta^I(v)=\mathbb{E}[Y_1\mid v>Y_1]\]`

Do not use `$...$` or `$$...$$` delimiters. Converting an existing formula to
this markup does not permit changes to the surrounding user-authored prose.
Custom graph SVG labels remain Unicode/plain text because they are positioned
and updated directly by the graph code; they are not MathJax targets. Initial
HTML typesetting includes `.introduction`, `.derivation`, `.notes`, and
`.references` regions that are present.

MathJax is loaded from `js/mathjax-config.js` and the vendored
`assets/mathjax/tex-svg.js`, so typesetting continues to work through file://
without a network connection. Dynamic HTML math is cleared before replacement
with `MathJax.typesetClear`, rendered afterward with `MathJax.typesetPromise`,
and serialized through `window.mechanismMathReady`.

## Browser checks

Open these files in a browser:

- tests/menu-tests.html — menu structure, category, routes, and availability.
- tests/distribution-tests.html — shared Uniform/Beta kernel checks.
- tests/components-tests.html — shared page-header, page-footer, and
  model-parameter-controls custom-element checks.
- tests/model-tests.html — first-price economic model checks.
- tests/ui-tests.html — first-price interface and SVG checks.
- tests/second-price-model-tests.html — second-price economic model checks.
- tests/second-price-ui-tests.html — second-price interface and SVG checks.
- tests/bilateral-trade-model-tests.html — bilateral-trade grid, envelope,
  and welfare/revenue checks.
- tests/bilateral-trade-ui-tests.html — bilateral-trade interface and SVG
  checks.

The iframe-based menu and interface checks may require a local static server or
a browser configuration that permits local-file iframe access. This does not
affect ordinary use of the menu or module pages.

Interface checks should also verify that MathJax loads only from local paths,
initial and dynamic HTML formulas render without visible raw delimiters,
repeated updates replace old output, and custom graph SVGs contain no MathJax
containers.

## Files

- index.html — module menu.
- auctions/first-price/index.html — first-price module page.
- auctions/first-price/model.js — first-price model functions.
- auctions/first-price/app.js — first-price controls and SVG behavior.
- auctions/second-price/index.html — second-price functional module page.
- auctions/second-price/model.js — second-price model functions.
- auctions/second-price/app.js — second-price controls and SVG behavior.
- styles.css — shared module and menu styles.
- assets/mathjax/ — vendored MathJax 4 TeX-to-SVG build, license, fonts, and
  runtime support assets for offline use.
- js/mathjax-config.js — shared MathJax delimiter, SVG-output, offline-font, and
  SVG-exclusion configuration.
- js/distributions.js — shared validation, CDF, PDF, quantile, and integration
  functions for Uniform and transformed-Beta values.
- js/components.js — shared `<page-header>`, `<page-footer>`, and
  `<model-parameter-controls>` custom elements, defined once so the site
  header, footer, and the auction pages' Beta-shape parameter row do not
  need to be copy-pasted into every module's index.html.
- tests/menu-tests.html and tests/menu-tests.js — menu checks.
- tests/distribution-tests.html and tests/distribution-tests.js — shared
  distribution checks.
- tests/components-tests.html and tests/components-tests.js — shared
  page-component checks.
- tests/model-tests.html and tests/model-tests.js — first-price model checks.
- tests/ui-tests.html and tests/ui-tests.js — first-price interface checks.
- tests/second-price-model-tests.html and tests/second-price-model-tests.js —
  second-price model checks.
- tests/second-price-ui-tests.html and tests/second-price-ui-tests.js —
  second-price interface checks.
- bilateral-trade/myerson-satterthwaite-theorem/index.html — bilateral-trade
  module page.
- bilateral-trade/myerson-satterthwaite-theorem/model.js — bilateral-trade
  grid, envelope-formula, and welfare/revenue functions.
- bilateral-trade/myerson-satterthwaite-theorem/app.js — bilateral-trade
  painting state and SVG behavior.
- tests/bilateral-trade-model-tests.html and tests/bilateral-trade-model-tests.js —
  bilateral-trade model checks.
- tests/bilateral-trade-ui-tests.html and tests/bilateral-trade-ui-tests.js —
  bilateral-trade interface checks.
- PROJECT_PLAN.md — current product and implementation plan.
- AGENTS.md — standing instructions for future work.

## Current implementation boundary

The first-price and second-price functional modules both use the translated and
scaled Beta distribution

    Value = a + (b-a)Z, where Z ~ Beta(alpha,beta).

There is no distribution selector. Both modules require finite 0 <= a < b, and
both focal private values and proposed bids range over [a,b]. Alpha and beta are
independently adjustable on [0.2,10] and default to 1, so the initial density is
Uniform[a,b]. Random values use the current Beta distribution's quantile
function.

Both modules place n, a, b, alpha, beta, and a compact live figure labeled
"PDF of Value" in one responsive, top-aligned parameter row whenever width
permits. The curve updates with a, b, alpha, and beta. The vertical gap between
this row and the graph panels is intentionally compact. The caption is inset to
align with the preview's plotted PDF area. There is no separate value-
distribution equation beneath the parameter row.

The shared kernel retains analytic Uniform shortcuts and provides numerical
integration and inversion for general Beta cases. Endpoint-singular Beta
densities are supported while the interfaces keep all SVG coordinates finite.
Displayed value and bid fields round to the nearest tenth and omit trailing
zeros without changing the underlying calculation values.

Both first panels are titled "PDF of highest opposing bid," without a beta
expression in the title, and retain their probability-of-winning area labels.
Each second panel has no y-axis title; its selected-point guide instead places
"Probability of winning = [number]" at the probability axis. A first-panel
probability label leaves its highlighted area when it is too wide or tall.
Expected payoff leaves its area only when it is too wide, not when the area is
merely short, and stays immediately beside the selected in-graph bid when
outside. Neither metric is repeated beside a panel title. The equilibrium
marker includes the numerical value in "beta^I(v_1) = [number]" or
"beta^II(v_1) = [number]." Dragging beyond either horizontal side clamps the
bid exactly to a or b.
In the second-price graph, one net expected-payoff value replaces separate
truthful-payoff and payoff-loss numbers.

The second-price page intentionally contains no lesson exposition yet: its
introduction, interpretation, derivation, and scope await user-authored text.
Its Notes list is empty, and its References section contains the user-requested
Krishna citation.

The Myerson-Satterthwaite Theorem module has one buyer with value v and one seller with
cost c, both on [0,1] and drawn Uniform[0,1] with no shape controls. The
learner paints the allocation rule q(v,c) directly on a 20x20 grid of
genuine 0.05x0.05 cells (cell (i,j) covers v in [i*0.05,(i+1)*0.05), c in
[j*0.05,(j+1)*0.05), so every cell is a full-width square with no
half-width edge tiles). Each cell is split by its own bottom-left-to-
top-right diagonal into two independently paintable triangles, "L"
(upper-left) and "R" (lower-right) — the learner paints one triangle at a
time (arrow keys plus l/r select which; dragging along a cell's own
diagonal paints a diagonal pattern directly), and the three exact presets
(efficient benchmark, posted price, Chatterjee-Samuelson) also set a cell's
two triangles independently, which represents a diagonal threshold like v=c
or v-c=1/4 with zero approximation error whenever it is a whole multiple of
the cell size. Each v-c panel — the main paint chart and three of the six
diagnostics — renders exactly that 800-triangle mesh (or a diagnostic
quantity evaluated once per triangle centroid), with no finer display grid
and no interpolation-driven blending in what is drawn. Every other module
quantity is derived from that
same painted grid directly, with no hidden finer grid, no trapezoidal
quadrature, and no interpolation anywhere in the model, never chosen
directly: implementability is checked as Bayesian (interim) incentive
compatibility
(the interim allocation probabilities Q_B and Q_S, exact area-weighted
averages of q over each row's/column's 40 triangles, must be monotonic —
strictly weaker than requiring q(v,c) itself to be pointwise monotonic, and
the notion actually used in Myerson-Satterthwaite 1983), shown as two 1D
staircase/step-chart panels rather than heatmaps; plus the minimal-rent
envelope transfers and utilities (computed via exact closed forms, not
quadrature), induced budget balance, and the efficiency comparison to
q*(v,c)=1{v>c}. The page is a compact dashboard: the sized-down main chart
(with a q-slider capped much narrower than it, labeled dynamically as
"Allocation probability on v ∈ [lo, hi), c ∈ [lo, hi), L" (or "R") with the
selected triangle's own cell ranges and side, using a real Unicode "∈"
character rather than MathJax so the label can update on every paint stroke
without typesetting lag, also shown as an in-graph marker — there is no
separate text readout) and its horizontal "Presets:"
row (Efficient benchmark, Always trade, Never trade, Posted price — which
reveals its own adjustable price slider — and the Chatterjee-Samuelson
double auction) on the left, and an explicit three-column by two-row grid of
all six diagnostic panels to the right on wide screens. The overall
interaction fills the same shared content width as the auction demos and
reflows responsively. Each diagnostic has short colored (green/red) verdict
text directly beneath it and no explanatory prose or formulas, except the
net-revenue panel, whose plot remains an ordinary pointwise heatmap but
whose text is a single expected-revenue line rather than the three
separate verdicts it showed before. The two IR (utility)
panels are the exception to the pass/fail coloring: ex-post IR is automatic
under the module's zero-boundary envelope construction for any q in [0,1]
(a fact about the construction, not a consequence of IC), so their minimum
utility is always exactly 0 and never fails; they show expected utility
(information rent) instead, as neutral text, since that is what actually
varies with q. Its user-supplied introduction and the 1983
Myerson-Satterthwaite citation are present; Notes remains reserved for
user-authored text.
