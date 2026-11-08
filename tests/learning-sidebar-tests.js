(function () {
  "use strict";
  var T = MechanismTest, frame = document.getElementById("sidebar-frame");
  function hasUnrenderedMath(root) {
    var filter = root.ownerDocument.defaultView.NodeFilter;
    var walker = root.ownerDocument.createTreeWalker(root, filter.SHOW_ALL, {
      acceptNode: function (node) {
        if (node.namespaceURI === "http://www.w3.org/2000/svg") { return filter.FILTER_REJECT; }
        return node.nodeType === 3 && /\\\(|\\\[/.test(node.textContent) ? filter.FILTER_ACCEPT : filter.FILTER_SKIP;
      }
    });
    return !!walker.nextNode();
  }

  function selectedPanel(host) {
    return host.querySelector('[role="tabpanel"]:not([hidden])');
  }

  async function assertMathReady(host) {
    var panel = selectedPanel(host);
    await T.waitFor(function () {
      return !panel.hasAttribute("aria-busy") && !hasUnrenderedMath(panel);
    }, 15000, "The visible tab's mathematics must finish rendering.");
    T.assert(!panel.querySelector("mjx-merror, merror"), "Visible notation must have no math errors.");
    Array.from(panel.querySelectorAll("dt > span")).forEach(function (symbol) {
      T.assert(symbol.querySelector('mjx-container[jax="SVG"]'), "Every notation symbol must render through MathJax.");
    });
    Array.from(panel.querySelectorAll('mjx-container[jax="SVG"] > svg')).forEach(function (svg) {
      var box = svg.getBBox(), bounds = svg.getBoundingClientRect();
      T.assert(box.width > 0 && box.height > 0 && bounds.width > 0 && bounds.height > 0,
        "Every rendered formula must contain visible, nonempty glyph geometry.");
      Array.from(svg.querySelectorAll("use")).forEach(function (glyph) {
        var reference = glyph.getAttribute("href") || glyph.getAttribute("xlink:href");
        T.assert(reference && host.ownerDocument.getElementById(reference.slice(1)), "Every SVG glyph must resolve to a local font definition.");
      });
    });
  }

  var pages = [
    ["general-topics/envelope-theorem", true],
    ["general-topics/revelation-principle", true],
    ["auction-equilibria/first-price", true],
    ["auction-equilibria/second-price", true],
    ["auction-design/regular-optimal-auctions", true],
    ["auction-design/general-optimal-auctions", true],
    ["bilateral-trade/bargaining-mechanism-sandbox", true],
    ["bilateral-trade/myerson-satterthwaite-theorem", true],
    ["auction-equilibria/environment", false],
    ["auction-design/environment", false],
    ["bilateral-trade/environment", false]
  ];

  var checks = pages.map(function (page) {
    return { name: page[0] + ": separate tabs, rendered math, keyboard controls and reflow", run: async function () {
      frame.style.width = "1280px";
      var loaded = new Promise(function (resolve) { frame.onload = resolve; });
      frame.src = "../" + page[0] + "/index.html";
      await loaded;
      var doc = frame.contentDocument, win = frame.contentWindow;
      await T.waitFor(function () {
        return !!doc.querySelector("main mjx-container") && !hasUnrenderedMath(doc.querySelector("main"));
      }, 15000);
      await T.nextAnimationFrames(win, 2);
      var host = doc.querySelector("learning-sidebar");
      var toggle = host.querySelector(".learning-sidebar-toggle");
      var drawer = host.querySelector(".learning-sidebar-panel");
      var close = host.querySelector(".learning-sidebar-close");
      var tabs = Array.from(host.querySelectorAll('[role="tab"]'));
      var panels = Array.from(host.querySelectorAll('[role="tabpanel"]'));
      T.assert(drawer.hidden && toggle.getAttribute("aria-expanded") === "false", "The drawer must start closed.");
      T.assert(!drawer.querySelector("dt") && !hasUnrenderedMath(host), "Closed references must not add raw math to the lesson.");
      T.assert(tabs.map(function (tab) { return tab.textContent; }).join("|") === "Page notation|Environment notation|Author Insights",
        "All three groups need separate tabs with the requested labels.");
      T.assert(host.querySelector('[role="tablist"]') && panels.length === 3, "The drawer needs an accessible tablist and three panels.");
      tabs.forEach(function (tab, index) {
        T.assert(doc.getElementById(tab.getAttribute("aria-controls")) === panels[index], "Each tab must identify its own panel.");
        T.assert(panels[index].getAttribute("aria-labelledby") === tab.id, "Each panel must be named by its tab.");
      });
      T.assert(tabs[0].disabled === !page[1], "Environment-only pages must disable their empty page tab.");
      var notation = win.MechanismNotation.pages[host.getAttribute("page") || host.getAttribute("environment")];
      T.assert(notation && Array.isArray(notation.pageNotation) && Array.isArray(notation.environmentNotation),
        "Each page's catalog entry must contain both notation groups.");
      if (!page[0].includes("general-topics")) {
        T.assert(notation.environmentNotation === win.MechanismNotation.pages[page[0].split("/")[0]].environmentNotation,
          "Related pages must reuse their shared environment definitions.");
      }
      T.assertScriptOrder(doc, ["../../js/mathjax-runtime.js", "../../js/notation-catalog.js", "../../js/learning-sidebar.js"]);

      var chart = doc.querySelector("main svg:not(mjx-container svg)");
      var before = chart && chart.getBoundingClientRect();
      toggle.click();
      T.assert(!drawer.hidden && doc.activeElement === close, "Opening must focus Close.");
      T.assert(panels.filter(function (panel) { return !panel.hidden; }).length === 1, "Exactly one tab panel may be visible.");
      await assertMathReady(host);
      T.assert(selectedPanel(host) === panels[notation.pageNotation.length ? 0 : 1],
        "The initial tab must show page notation when available, otherwise environment notation.");
      var initialNotation = page[1] ? notation.pageNotation : notation.environmentNotation;
      T.assert(selectedPanel(host).querySelectorAll("dt").length === initialNotation.reduce(function (sum, group) {
        return sum + group.length;
      }, 0), "The initial tab must include every entry from its catalog group.");
      if (page[1]) {
        var pageGroups = Array.from(panels[0].querySelectorAll(".notation-group"));
        T.assert(Array.isArray(notation.pageNotationSections) &&
          notation.pageNotationSections.length === notation.pageNotation.length,
          "Every page notation group must identify its first-appearance section.");
        T.assert(pageGroups.length === notation.pageNotation.length,
          "Section headings must retain every original notation group.");
        pageGroups.forEach(function (group, index) {
          var heading = doc.getElementById(group.getAttribute("aria-labelledby"));
          T.assert(heading && heading.tagName === "H3" &&
            heading.textContent === notation.pageNotationSections[index] &&
            (heading.compareDocumentPosition(group) & win.Node.DOCUMENT_POSITION_FOLLOWING),
            "Each group must follow its small, accessible section heading.");
          T.assert(group.querySelectorAll(".notation-entry").length === notation.pageNotation[index].length,
            "A section heading must not split or combine notation groups.");
          T.assertClose(parseFloat(win.getComputedStyle(heading).fontSize),
            parseFloat(win.getComputedStyle(panels[0]).fontSize), 0.01,
            "Notation section headings must use the drawer's text size.");
        });
        T.assert(panels[0].querySelectorAll(".notation-section-heading").length ===
          notation.pageNotationSections.filter(function (label, index, labels) {
            return index === 0 || label !== labels[index - 1];
          }).length, "A section heading must be shared by its consecutive groups.");
        T.assert(notation.pageNotationSections.indexOf("Additional notation") === -1,
          "Unused page notation must be removed rather than kept in an Additional notation section.");
        if (page[0].includes("envelope-theorem")) {
          var symbols = notation.pageNotation.reduce(function (all, group) {
            return all.concat(group.map(function (entry) { return entry[0]; }));
          }, []);
          T.assert(symbols.indexOf("V_i") === -1 && symbols.indexOf("v_i") >= 0 && symbols.indexOf("v_i'") >= 0,
            "Removing the unused random value must retain the realized value and report used in Myerson's Lemma.");
        }
      }
      if (chart) {
        var after = chart.getBoundingClientRect();
        ["x", "y", "width", "height"].forEach(function (key) {
          T.assertClose(after[key], before[key], 1, "Opening the reference must preserve chart " + key + ".");
        });
      }

      var pageScroll = win.scrollY;
      tabs[1].click();
      await assertMathReady(host);
      T.assert(!panels[1].hidden && panels[0].hidden && panels[2].hidden, "Environment notation must replace the other groups.");
      T.assert(panels[1].querySelectorAll(".notation-group").length === notation.environmentNotation.length,
        "The environment tab must retain every group from its catalog entry.");
      T.assert(!panels[1].querySelector(".notation-section-heading"),
        "Page section headings must stay out of Environment notation.");
      T.assert(panels[1].querySelectorAll("dt").length === notation.environmentNotation.reduce(function (sum, group) {
        return sum + group.length;
      }, 0), "Environment notation must include every entry from the page's environment group.");
      var groups = Array.from(panels[1].querySelectorAll(".notation-group"));
      T.assert(groups.length > 1, "Environment notation must retain related groups.");
      groups.forEach(function (group) {
        T.assert(win.getComputedStyle(group).borderBottomStyle === "solid", "A divider must follow each group.");
        var rows = Array.from(group.children);
        rows.forEach(function (row, index) {
          T.assert(row.querySelectorAll("dt").length === 1 && row.querySelectorAll("dd").length === 1,
            "Each notation row must have its own symbol and definition.");
          T.assert(row.querySelectorAll("dt > span").length === 1, "Each row must typeset one notation item.");
          T.assert(win.getComputedStyle(row).borderBottomStyle === "none", "Related rows must share one group divider.");
          if (index) {
            T.assert(row.getBoundingClientRect().top >= rows[index - 1].getBoundingClientRect().bottom - 1,
              "Each notation item must occupy a separate row.");
          }
        });
      });
      if (page[0].includes("auction-design")) {
        var bySymbol = function (pattern) {
          var index = notation.environmentNotation.findIndex(function (entries) {
            return entries.some(function (entry) { return pattern.test(entry[0]); });
          });
          T.assert(index >= 0, "The requested notation symbol must exist in the environment.");
          return groups[index];
        };
        T.assert(bySymbol(/^T_i/) === bySymbol(/^T\s*=/) && bySymbol(/^T_i/) === bySymbol(/^v\s*=/),
          "Individual value space, joint value space and value profile must share a group.");
        T.assert(bySymbol(/^q[=:]/) === bySymbol(/^p[=:]/),
          "Allocation and payment rules must share a group.");
        T.assert(bySymbol(/^Q_i\(/) === bySymbol(/^P_i\(/) && bySymbol(/^Q_i\(/) === bySymbol(/^U_i\(/),
          "Interim allocation, payment and payoff notation must share a group.");
      }
      if (/auction-design|bilateral-trade/.test(page[0])) {
        T.assert(panels[1].querySelector('[data-mml-node="mfrac"]'), "Virtual-value formulas must render actual fractions.");
      }
      tabs[2].click();
      await assertMathReady(host);
      T.assert(!panels[2].hidden && panels[0].hidden && panels[1].hidden, "Insights must have its own panel.");
      var authored = host.querySelector("template[data-insights]");
      var authoredCount = authored ? authored.content.childElementCount : 0;
      T.assert(panels[2].childElementCount === authoredCount,
        "Insights must contain the author's template content, including an empty template when appropriate.");

      tabs[1].focus();
      T.dispatch(tabs[1], "keydown", win, { key: "ArrowRight" });
      T.assert(doc.activeElement === tabs[2] && tabs[2].getAttribute("aria-selected") === "true", "Right Arrow must focus and select the next tab.");
      T.dispatch(tabs[2], "keydown", win, { key: "Home" });
      var first = page[1] ? 0 : 1;
      T.assert(doc.activeElement === tabs[first] && tabs[first].getAttribute("aria-selected") === "true", "Home must select the first available tab.");
      T.dispatch(tabs[first], "keydown", win, { key: "ArrowLeft" });
      T.assert(doc.activeElement === tabs[2], "Left Arrow must wrap and skip disabled tabs.");
      T.dispatch(tabs[2], "keydown", win, { key: "End" });
      T.assert(tabs[2].getAttribute("aria-selected") === "true", "End must select the final tab.");
      T.assert(tabs.filter(function (tab) { return tab.tabIndex === 0; }).length === 1, "Only the selected tab belongs in the Tab-key sequence.");

      // Cached tabs must retain their output across switching and reopening.
      tabs[1].click();
      tabs[2].click();
      close.click();
      toggle.click();
      tabs[first].click();
      tabs[1].click();
      await assertMathReady(host);
      var count = panels[1].querySelectorAll("mjx-container").length;
      close.click();
      T.assert(drawer.hidden && doc.activeElement === toggle, "Close must restore focus to the edge tab.");
      toggle.click();
      await assertMathReady(host);
      T.assert(panels[1].querySelectorAll("mjx-container").length === count, "Reopening must not duplicate mathematical output.");
      T.assertClose(win.scrollY, pageScroll, 1, "Tab changes must preserve the lesson's scroll position.");

      var content = host.querySelector(".learning-sidebar-content");
      T.assert(win.getComputedStyle(content).overflowY === "auto", "The selected group needs independent scrolling.");
      content.scrollTop = 100;
      var scroll = content.scrollTop;
      tabs[2].click();
      T.assert(content.scrollTop === 0, "A new tab must start at its own scroll position.");
      tabs[1].click();
      await assertMathReady(host);
      T.assertClose(content.scrollTop, scroll, 1, "Returning to a tab must preserve its scroll position.");

      for (var width of [320, 375, 768, 1280]) {
        frame.style.width = width + "px";
        await T.nextAnimationFrames(win, 2);
        await T.waitFor(function () { return win.getComputedStyle(drawer).transform === "none"; }, 5000);
        var bounds = drawer.getBoundingClientRect();
        T.assert(bounds.left >= -1 && bounds.right <= doc.documentElement.clientWidth + 1, "The drawer must fit at " + width + "px.");
        T.assert(content.scrollWidth <= content.clientWidth + 1, "The selected notation must not overflow at " + width + "px.");
        if (page[1]) {
          tabs[0].click();
          await assertMathReady(host);
          panels[0].querySelectorAll(".notation-section-heading").forEach(function (heading) {
            var label = heading.querySelector(".notation-section-label");
            var headingBox = heading.getBoundingClientRect(), labelBox = label.getBoundingClientRect();
            var contentBox = content.getBoundingClientRect();
            T.assert(headingBox.left >= contentBox.left - 1 && headingBox.right <= contentBox.right + 1,
              "The labeled separator must fit the drawer at " + width + "px.");
            T.assertClose(labelBox.left + labelBox.width / 2, headingBox.left + headingBox.width / 2, 0.75,
              "The section label must be centered in its separator at " + width + "px.");
            var before = win.getComputedStyle(heading, "::before");
            var after = win.getComputedStyle(heading, "::after");
            T.assert(parseFloat(before.width) > 0 && parseFloat(after.width) > 0 &&
              parseFloat(before.height) === 1 && parseFloat(after.height) === 1,
              "Separator bars must remain visible on both sides of the label at " + width + "px.");
            T.assertClose(parseFloat(before.width), parseFloat(after.width), 0.75,
              "The separator bars must balance around the section label.");
            var previous = heading.previousElementSibling;
            if (previous && previous.classList.contains("notation-group")) {
              T.assert(parseFloat(win.getComputedStyle(previous).borderBottomWidth) === 0,
                "The labeled separator must replace the preceding group border.");
            }
          });
          tabs[1].click();
          await assertMathReady(host);
        }
        tabs.forEach(function (tab) {
          var box = tab.getBoundingClientRect();
          T.assert(box.height >= 44 && box.left >= bounds.left && box.right <= bounds.right, "Tabs must remain reachable and touch-sized at " + width + "px.");
        });
      }
      tabs[1].focus();
      T.dispatch(tabs[1], "keydown", win, { key: "Escape" });
      T.assert(drawer.hidden && doc.activeElement === toggle, "Escape must close and restore focus.");
    } };
  });

  checks.push({ name: "Insights render authored inline and display math only when selected", run: async function () {
    var doc = frame.contentDocument;
    var host = doc.createElement("learning-sidebar");
    host.setAttribute("environment", "bilateral-trade");
    var template = doc.createElement("template");
    template.setAttribute("data-insights", "");
    template.innerHTML = '\\(v\\)<p><strong>Test insight</strong>: \\(q(v,c)\\).</p><div>\\[\\frac{1}{2}\\]</div>';
    host.appendChild(template);
    doc.body.appendChild(host);
    host.querySelector(".learning-sidebar-toggle").click();
    await assertMathReady(host);
    T.assert(!host.querySelector(".learning-sidebar-insights strong"), "Unselected Insights must not be rendered while hidden.");
    host.querySelectorAll('[role="tab"]')[2].click();
    T.assert(doc.defaultView.getComputedStyle(selectedPanel(host)).visibility === "hidden",
      "Pending Insights must hide bare TeX text as well as element children.");
    await assertMathReady(host);
    T.assert(host.querySelector(".learning-sidebar-insights strong").textContent === "Test insight", "Authored markup must be retained.");
    T.assert(host.querySelector(".learning-sidebar-insights mjx-container[display='true']"), "Display mathematics must render inside Insights.");
    T.assert(host.querySelector('.learning-sidebar-insights [data-mml-node="mfrac"]'), "Insight fractions must render as mathematics.");
    var ids = Array.from(doc.querySelectorAll("learning-sidebar [id]")).map(function (node) { return node.id; });
    T.assert(new Set(ids).size === ids.length, "Multiple sidebar instances must retain unique IDs.");
    host.remove();
  } });
  function fixture(markup) {
    var doc = frame.contentDocument;
    var host = doc.createElement("learning-sidebar");
    host.setAttribute("page", "first-price");
    var template = doc.createElement("template");
    template.setAttribute("data-insights", "");
    template.innerHTML = markup || "";
    host.appendChild(template);
    doc.body.appendChild(host);
    return host;
  }

  checks.push({ name: "Shared appendix navigation waits for math, handles cancellation, and reopens", run: async function () {
    var win = frame.contentWindow, runtime = win.MechanismMath;
    var host = fixture('<h3 id="shared-navigation-target" tabindex="-1">Target \\(q\\)</h3>');
    var release, started = false;
    var gate = new Promise(function (resolve) { release = resolve; });
    win.MechanismMath = { typesetInitial: function (selector) {
      started = true;
      return gate.then(function () { return runtime.typesetInitial(selector); });
    } };
    try {
      var navigation = host.reveal("shared-navigation-target");
      await T.waitFor(function () { return started; }, 5000);
      T.assert(host.ownerDocument.activeElement.id !== "shared-navigation-target", "Navigation must not focus unfinished mathematics.");
      host.querySelector(".learning-sidebar-close").click();
      release();
      T.assert(await navigation === null, "Closing the drawer must cancel pending navigation.");
      win.MechanismMath = runtime;
      var scroll = win.scrollY;
      var target = await host.reveal("shared-navigation-target");
      T.assert(target === host.ownerDocument.activeElement && target.querySelector("mjx-container"), "Reopening must focus the fully rendered target.");
      T.assertClose(win.scrollY, scroll, 1, "Appendix navigation must preserve the lesson's scroll position.");
      var error = await host.reveal("missing-navigation-target").then(function () { return null; }, function (failure) { return failure; });
      T.assert(error && /Unknown appendix target/.test(error.message), "Missing targets must reject with a useful error.");
    } finally {
      release();
      win.MechanismMath = runtime;
      host.remove();
    }
  } });

  checks.push({ name: "In-flight tab rendering is shared across switches and close/reopen", run: async function () {
    var win = frame.contentWindow, runtime = win.MechanismMath;
    var host = fixture(), release, calls = 0;
    var gate = new Promise(function (resolve) { release = resolve; });
    win.MechanismMath = { typesetInitial: function (selector) {
      calls += 1;
      return gate.then(function () { return runtime.typesetInitial(selector); });
    } };
    try {
      var toggle = host.querySelector(".learning-sidebar-toggle");
      var close = host.querySelector(".learning-sidebar-close");
      var tabs = host.querySelectorAll('[role="tab"]');
      toggle.click();
      await T.waitFor(function () { return calls === 1; }, 5000);
      var panel = selectedPanel(host);
      T.assert(!host.querySelector(".learning-sidebar-status").hidden &&
        win.getComputedStyle(panel).visibility === "hidden", "Loading must be announced while unfinished math stays hidden.");
      tabs[2].click();
      await assertMathReady(host);
      tabs[0].click();
      tabs[0].click();
      close.click();
      toggle.click();
      await T.nextAnimationFrames(win, 2);
      T.assert(calls === 1, "Returning to a pending tab must reuse its original typesetting request.");
      release();
      await assertMathReady(host);
      T.assert(host.querySelector(".learning-sidebar-status").hidden, "The loading message must clear when rendering finishes.");
      T.assert(calls === 1, "Completing a shared request must not trigger another typeset.");
    } finally {
      release();
      win.MechanismMath = runtime;
      host.remove();
    }
  } });

  checks.push({ name: "Unavailable, rejected and incomplete math rendering offer a working Retry", run: async function () {
    var win = frame.contentWindow, runtime = win.MechanismMath;
    var unhandled = 0;
    function onUnhandled() { unhandled += 1; }
    win.addEventListener("unhandledrejection", onUnhandled);
    try {
      for (var failure of ["unavailable", "rejected", "incomplete"]) {
        var host = fixture();
        win.MechanismMath = failure === "unavailable" ? null : {
          typesetInitial: function () {
            return failure === "rejected" ? Promise.reject(new Error("Test rendering failure")) : Promise.resolve();
          }
        };
        try {
          host.querySelector(".learning-sidebar-toggle").click();
          var retry = host.querySelector(".learning-sidebar-retry");
          await T.waitFor(function () { return !retry.hidden; }, 5000, "A rendering failure must offer Retry: " + failure);
          var panel = selectedPanel(host);
          T.assert(!panel.hasAttribute("aria-busy") && win.getComputedStyle(panel).visibility === "hidden" &&
            host.querySelector(".learning-sidebar-content").hidden,
            "A failed tab must stop loading, hide raw TeX and remove the unavailable content's scroll area.");
          T.assert(!host.querySelector(".learning-sidebar-status").hidden, "A failed tab must explain why its content is unavailable.");
          win.MechanismMath = runtime;
          retry.click();
          await assertMathReady(host);
          T.assert(host.querySelector(".learning-sidebar-status").hidden && !panel.hasAttribute("data-render-error"),
            "Retry must restore complete notation and clear the failure state.");
          T.assert(host.ownerDocument.activeElement === host.querySelector('[aria-selected="true"]'),
            "Retry must leave keyboard focus on the selected tab.");
        } finally {
          host.remove();
        }
      }
      await T.nextAnimationFrames(win, 2);
      T.assert(unhandled === 0, "Renderer rejections must be handled locally.");
    } finally {
      win.MechanismMath = runtime;
      win.removeEventListener("unhandledrejection", onUnhandled);
    }
  } });

  checks.push({ name: "Failures from a previous tab cannot replace the active tab's content", run: async function () {
    var win = frame.contentWindow, runtime = win.MechanismMath;
    var host = fixture("<p>Authored insight.</p>"), reject, started = false;
    win.MechanismMath = { typesetInitial: function () {
      started = true;
      return new Promise(function (resolve, fail) { reject = fail; });
    } };
    try {
      host.querySelector(".learning-sidebar-toggle").click();
      await T.waitFor(function () { return started; }, 5000);
      host.querySelectorAll('[role="tab"]')[2].click();
      await assertMathReady(host);
      reject(new Error("Obsolete rendering failure"));
      await T.nextAnimationFrames(win, 2);
      T.assert(host.querySelector(".learning-sidebar-status").hidden &&
        selectedPanel(host).textContent === "Authored insight.", "An obsolete failure must leave the active Insights tab intact.");
      win.MechanismMath = runtime;
      host.querySelectorAll('[role="tab"]')[0].click();
      await assertMathReady(host);
    } finally {
      if (reject) { reject(new Error("Fixture cleanup")); }
      win.MechanismMath = runtime;
      host.remove();
    }
  } });

  checks.push({ name: "Empty and plain-text Insights do not depend on math loading", run: async function () {
    var win = frame.contentWindow, runtime = win.MechanismMath, ready = win.mechanismMathReady;
    win.MechanismMath = null;
    win.mechanismMathReady = new Promise(function () {});
    try {
      for (var markup of ["", '<p>Authored text <code>\\(literal TeX\\)</code>.</p>']) {
        var host = fixture(markup);
        try {
          host.querySelector(".learning-sidebar-toggle").click();
          host.querySelectorAll('[role="tab"]')[2].click();
          var panel = selectedPanel(host);
          await T.waitFor(function () { return !panel.hasAttribute("aria-busy"); }, 5000);
          T.assert(host.querySelector(".learning-sidebar-status").hidden && win.getComputedStyle(panel).visibility === "visible",
            "Insights without mathematical content must remain usable while the lesson's math is pending.");
          T.assert(panel.innerHTML === markup, "Empty templates and literal code must remain unchanged.");
        } finally {
          host.remove();
        }
      }
    } finally {
      win.MechanismMath = runtime;
      win.mechanismMathReady = ready;
    }
  } });

  T.run(checks, { title: "Page Appendix sidebar tests" });
})();

