(function () {
  "use strict";
  var T = MechanismTest;
  var localFile = window.location.protocol === "file:";
  var host = document.querySelector("learning-sidebar");

  async function settles(promise) {
    var finished = false;
    promise.then(function () { finished = true; });
    await T.waitFor(function () { return finished; }, 15000,
      "The math queue must settle with normal browser permissions.");
  }

  function assertRendered(node) {
    T.assert(!node.textContent.includes("\\"), "Rendered output must contain no raw LaTeX.");
    T.assert(!node.querySelector("mjx-merror, merror"), "Mathematics must have no rendering errors.");
    var math = Array.from(node.querySelectorAll('mjx-container[jax="SVG"]'));
    T.assert(math.length > 0, "Mathematics must produce SVG output.");
    math.forEach(function (item) {
      var box = item.querySelector("svg").getBBox();
      T.assert(box.width > 0 && box.height > 0, "Mathematical glyphs must have visible geometry.");
      if (localFile) {
        T.assert(item.querySelector("mjx-assistive-mml math"), "Local-file output must retain accessible MathML.");
      }
    });
  }

  T.run([
    { name: "Initial rendering settles without a blocked speech worker", run: async function () {
      await settles(MechanismMath.typesetInitial("#static-math"));
      assertRendered(document.getElementById("static-math"));
    } },
    { name: "Local-file accessibility uses MathML; HTTP retains speech and braille", run: function () {
      var options = MathJax.startup.document.options;
      T.assert(options.enableSpeech === !localFile && options.enableBraille === !localFile,
        "Only file origins should bypass the unsupported speech worker.");
      if (localFile) {
        T.assert(options.enableAssistiveMml, "The local-file fallback must enable assistive MathML.");
      }
    } },
    { name: "Dynamic mathematical updates settle and replace their prior output", run: async function () {
      var target = document.getElementById("dynamic-math");
      await settles(MechanismMath.setText(target, "\\(Q_B(v)=v\\)"));
      assertRendered(target);
      await settles(MechanismMath.setText(target, "\\(P_B(v)=\\frac{v^2}{2}\\)"));
      assertRendered(target);
      T.assert(target.querySelector('[data-mml-node="mfrac"]') && target.querySelectorAll("mjx-container").length === 1,
        "The changed formula must replace its predecessor with a rendered fraction.");
    } },
    { name: "Failed math updates reject locally, retry unchanged source, and leave the queue usable", run: async function () {
      var original = MathJax.typesetPromise, calls = 0;
      var target = document.getElementById("dynamic-math");
      var source = "\\(P_B(v)=v^3\\)";
      MathJax.typesetPromise = function (targets) {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error("Transient test failure")) : original.call(MathJax, targets);
      };
      try {
        var request = MechanismMath.setText(target, source);
        T.assert(MechanismMath.setText(target, source) === request, "Identical pending updates must share their request.");
        var error = await request.then(function () { return null; }, function (failure) { return failure; });
        T.assert(error && error.message === "Transient test failure", "The caller must receive its rendering error.");
        await settles(window.mechanismMathReady);
        T.assert(target.textContent === source, "Failed rendering must leave its source visible.");
        await settles(MechanismMath.setText(target, source));
        T.assert(calls === 2, "Unchanged source must retry after failure.");
        assertRendered(target);
        await settles(MechanismMath.setText(target, source));
        T.assert(calls === 2, "Successful unchanged source must reuse its rendered output.");
      } finally {
        MathJax.typesetPromise = original;
      }
    } },
    { name: "A failed initial math request does not block a later request", run: async function () {
      var original = MathJax.typesetPromise;
      MathJax.typesetPromise = function () { return Promise.reject(new Error("Initial test failure")); };
      try {
        var error = await MechanismMath.typesetInitial("#static-math").then(function () { return null; }, function (failure) { return failure; });
        T.assert(error && error.message === "Initial test failure", "Initial rendering errors must reach their caller.");
      } finally {
        MathJax.typesetPromise = original;
      }
      await settles(MechanismMath.setText(document.getElementById("dynamic-math"), "\\(Q_B(v)=v^2\\)"));
      assertRendered(document.getElementById("dynamic-math"));
    } },
    { name: "Superseded dynamic math is skipped and rendered error elements remain retryable", run: async function () {
      var target = document.getElementById("dynamic-math");
      var original = MathJax.typesetPromise, calls = 0;
      MathJax.typesetPromise = function (targets) {
        calls += 1;
        return original.call(MathJax, targets);
      };
      try {
        var obsolete = MechanismMath.setText(target, "\\(Q_B(v)=v^4\\)");
        var latest = MechanismMath.setText(target, "\\(Q_B(v)=v^5\\)");
        await Promise.all([obsolete, latest]);
        T.assert(calls === 1 && target.dataset.mathSource === "\\(Q_B(v)=v^5\\)", "Only the latest queued source should be typeset.");
        MathJax.typesetPromise = function () {
          target.appendChild(document.createElement("mjx-merror"));
          return Promise.resolve();
        };
        var source = "\\(Q_B(v)=v^6\\)";
        var error = await MechanismMath.setText(target, source).then(function () { return null; }, function (failure) { return failure; });
        T.assert(error && /rendering error/.test(error.message), "MathJax error output must reject even if its promise resolves.");
        MathJax.typesetPromise = original;
        await settles(MechanismMath.setText(target, source));
        assertRendered(target);
      } finally {
        MathJax.typesetPromise = original;
      }
    } },
    { name: "The sandbox sidebar displays both notation tabs after the lesson queue", run: async function () {
      host.querySelector(".learning-sidebar-toggle").click();
      var tabs = host.querySelectorAll('[role="tab"]');
      for (var index of [0, 1]) {
        tabs[index].click();
        var panel = host.querySelector('[role="tabpanel"]:not([hidden])');
        await T.waitFor(function () { return !panel.hasAttribute("aria-busy"); }, 15000);
        assertRendered(panel);
        T.assert(panel.querySelectorAll("dt").length >= 10, "Both notation groups must display their entries.");
        T.assert(getComputedStyle(panel.querySelector("dl")).visibility === "visible", "Notation must not remain hidden behind the loading guard.");
      }
    } },
    { name: "Closing and switching tabs cannot leave the reference blank", run: async function () {
      var tabs = host.querySelectorAll('[role="tab"]');
      tabs[2].click();
      host.querySelector(".learning-sidebar-close").click();
      host.querySelector(".learning-sidebar-toggle").click();
      tabs[0].click();
      var panel = host.querySelector('[role="tabpanel"]:not([hidden])');
      await T.waitFor(function () { return !panel.hasAttribute("aria-busy"); }, 15000);
      assertRendered(panel);
      host.querySelector(".learning-sidebar-close").click();
    } }
  ], { title: "Local MathJax rendering tests" });
})();
