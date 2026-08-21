"use strict";

// Shared page scaffolding, defined once instead of copy-pasted into every
// module's index.html. Each element below renders into its own light DOM
// (no shadow root), so the nodes it produces are ordinary document
// children: reachable by document.getElementById/querySelector exactly
// like hand-written markup, styled by the shared styles.css with no extra
// selectors, and expanded before any other deferred script runs, since
// every page loads this file with `defer` ahead of its model.js/app.js and
// custom elements upgrade as soon as they are defined. This keeps the
// project static and build-free: no bundler, no templating language, just
// a browser-native API.
//
// `class ... extends HTMLElement` is the one deliberate exception to this
// project's otherwise ES5 (var, no arrow functions, no template literals)
// style: the Custom Elements API requires a real ES6 class, since
// HTMLElement cannot be subclassed with a plain ES5 constructor function.
(function () {
  function define(tagName, ElementClass) {
    if (!window.customElements.get(tagName)) {
      window.customElements.define(tagName, ElementClass);
    }
  }

  // The wordmark-plus-category row inside every page's own hand-written
  // <header class="site-header">. The outer <header> stays in each
  // index.html (not templated here) so its "banner" landmark role and the
  // .site-header CSS selector keep working with no extra attributes.
  class PageHeader extends HTMLElement {
    connectedCallback() {
      var home = this.getAttribute("home") || "index.html";
      var category = this.getAttribute("category") || "";

      var wrapper = document.createElement("div");
      wrapper.className = "page-width header-content";

      var wordmark = document.createElement("a");
      wordmark.className = "wordmark";
      wordmark.setAttribute("href", home);
      wordmark.textContent = "Mechanism Design Explorer";

      var span = document.createElement("span");
      span.textContent = category;

      wrapper.appendChild(wordmark);
      wrapper.appendChild(span);
      this.replaceChildren(wrapper);
    }
  }

  // The identical content inside every page's own hand-written
  // <footer class="site-footer">, kept native for the same reason.
  class PageFooter extends HTMLElement {
    connectedCallback() {
      var wrapper = document.createElement("div");
      wrapper.className = "page-width";
      wrapper.textContent = "Mechanism Design Explorer";
      this.replaceChildren(wrapper);
    }
  }

  // The Beta-shape model-parameter controls (bidder count, support bounds,
  // alpha/beta shape sliders, live "PDF of Value" preview) that first-price
  // and second-price share byte-for-byte. Used inside each page's own
  // <section class="model-specifications" aria-labelledby="parameters-title">,
  // which stays hand-written so aria-labelledby keeps resolving to the
  // id="parameters-title" heading rendered inside this element (light DOM,
  // so the id is just an ordinary document id, reachable the same way
  // whether the heading was typed by hand or injected here).
  var MODEL_PARAMETER_CONTROLS_HTML = [
    '<h2 id="parameters-title">Model parameters</h2>',
    '<div',
    '  id="beta-shape-controls"',
    '  class="parameter-grid beta-shape-controls"',
    '  aria-label="Beta value-distribution parameters"',
    '>',
    '  <label class="parameter-control" for="bidder-count">',
    '    <span>Number of bidders, \\(n\\)</span>',
    '    <select id="bidder-count">',
    '      <option value="2">2</option>',
    '      <option value="3">3</option>',
    '      <option value="4">4</option>',
    '      <option value="5">5</option>',
    '      <option value="6">6</option>',
    '      <option value="7">7</option>',
    '      <option value="8">8</option>',
    '      <option value="9">9</option>',
    '      <option value="10">10</option>',
    '    </select>',
    '  </label>',
    '',
    '  <label class="parameter-control" for="lower-bound">',
    '    <span>Lower bound, \\(a\\)</span>',
    '    <input id="lower-bound" type="number" min="0" value="0" step="any">',
    '  </label>',
    '',
    '  <label class="parameter-control" for="upper-bound">',
    '    <span>Upper bound, \\(b\\)</span>',
    '    <input id="upper-bound" type="number" min="0" value="100" step="any">',
    '  </label>',
    '  <div class="shape-parameter">',
    '    <div class="shape-label-row">',
    '      <label id="alpha-control-label" for="alpha-slider">Shape, \\(\\alpha\\)</label>',
    '      <input',
    '        id="alpha-number"',
    '        class="shape-number-input"',
    '        type="number"',
    '        min="0.2"',
    '        max="10"',
    '        step="0.1"',
    '        value="1"',
    '        inputmode="decimal"',
    '        aria-labelledby="alpha-control-label"',
    '      >',
    '    </div>',
    '    <input id="alpha-slider" type="range" min="0.2" max="10" step="0.1" value="1">',
    '    <div class="range-endpoints" aria-hidden="true"><span>0.2</span><span>10</span></div>',
    '  </div>',
    '  <div class="shape-parameter">',
    '    <div class="shape-label-row">',
    '      <label id="beta-control-label" for="beta-slider">Shape, \\(\\beta\\)</label>',
    '      <input',
    '        id="beta-number"',
    '        class="shape-number-input"',
    '        type="number"',
    '        min="0.2"',
    '        max="10"',
    '        step="0.1"',
    '        value="1"',
    '        inputmode="decimal"',
    '        aria-labelledby="beta-control-label"',
    '      >',
    '    </div>',
    '    <input id="beta-slider" type="range" min="0.2" max="10" step="0.1" value="1">',
    '    <div class="range-endpoints" aria-hidden="true"><span>0.2</span><span>10</span></div>',
    '  </div>',
    '  <figure class="value-pdf-preview-figure">',
    '    <figcaption>PDF of Value</figcaption>',
    '    <svg',
    '      id="value-pdf-preview"',
    '      viewBox="0 0 320 120"',
    '      role="img"',
    '      aria-labelledby="value-pdf-preview-title value-pdf-preview-description"',
    '    >',
    '      <title id="value-pdf-preview-title">PDF of Value</title>',
    '      <desc id="value-pdf-preview-description">The selected Beta value density.</desc>',
    '    </svg>',
    '  </figure>',
    '</div>',
    '<div id="input-error" class="input-error" role="alert" hidden></div>'
  ].join("\n");

  class ModelParameterControls extends HTMLElement {
    connectedCallback() {
      this.innerHTML = MODEL_PARAMETER_CONTROLS_HTML;
    }
  }

  define("page-header", PageHeader);
  define("page-footer", PageFooter);
  define("model-parameter-controls", ModelParameterControls);
})();
