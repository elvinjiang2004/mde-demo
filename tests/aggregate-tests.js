(function () {
  "use strict";
  var T = MechanismTest;

  async function catalogAggregate(catalog, verify, setup) {
    var frame = document.createElement("iframe");
    frame.title = "Isolated test aggregate";
    // Run the real aggregate with a private catalog so it cannot recurse.
    frame.srcdoc = '<!doctype html><head><script>window.MechanismTestCatalog=' +
      JSON.stringify(catalog) + ';' + (setup || "") + '</script><script defer src="all.js"></script></head>' +
      '<body data-status="running"><p id="summary"></p><p id="note"></p>' +
      '<table><tbody id="rows"></tbody></table><div id="frames"></div></body>';
    document.getElementById("sandbox").appendChild(frame);
    try {
      await T.waitFor(function () {
        var doc = frame.contentDocument;
        return doc && doc.body && /^(passed|failed)$/.test(doc.body.dataset.status);
      }, 10000, "The isolated aggregate must report a verdict.");
      verify(frame.contentDocument, frame.contentWindow);
    } finally {
      frame.remove();
    }
  }

  async function aggregate(status, results, summary, verify) {
    var verdict = URL.createObjectURL(new Blob([
      '<!doctype html><body data-status="' + status + '"><p id="summary">' +
      summary + '</p><ol id="results">' + results + '</ol></body>'
    ], { type: "text/html" }));
    try { await catalogAggregate([{ file: verdict, name: "Fixture suite", kind: "model" }], verify); }
    finally { URL.revokeObjectURL(verdict); }
  }

  T.run([
    { name: "Exclusive suites drain running work and ordinary concurrency resumes afterward", run: async function () {
      function fixture(name, exclusive, phase) {
        var probe = parent.schedulerProbe;
        if (probe.exclusive || (exclusive && probe.active)) { probe.errors.push("Overlapping " + name); }
        probe.active += 1;
        if (exclusive) { probe.exclusive = true; }
        else { probe.maxParallel[phase] = Math.max(probe.maxParallel[phase], probe.active); }
        probe.events.push("start:" + name);
        function finish() {
          probe.active -= 1;
          if (exclusive) { probe.exclusive = false; }
          probe.events.push("finish:" + name);
          document.body.dataset.status = "passed";
        }
        if (exclusive) { setTimeout(finish, 150); }
        else {
          probe.waiting[phase].push(finish);
          if (probe.waiting[phase].length === 3) { probe.waiting[phase].forEach(function (done) { done(); }); }
        }
      }
      var entries = [["before-a", false, "before"], ["before-b", false, "before"], ["before-c", false, "before"],
        ["barrier", true, "barrier"], ["after-a", false, "after"], ["after-b", false, "after"], ["after-c", false, "after"]];
      var urls = entries.map(function (entry) {
        return URL.createObjectURL(new Blob(['<!doctype html><body data-status="running"><ol id="results"><li class="pass">Fixture</li></ol><script>(' +
          fixture.toString() + ').apply(null,' + JSON.stringify(entry) + ');</script></body>'], { type: "text/html" }));
      });
      var catalog = entries.map(function (entry, index) { return { file: urls[index], name: entry[0], kind: "interface", exclusive: entry[1] }; });
      try {
        await catalogAggregate(catalog, function (doc, win) {
          var probe = win.schedulerProbe, events = probe.events;
          T.assert(doc.body.dataset.status === "passed" && probe.active === 0 && probe.errors.length === 0,
            "Exclusive work must have no overlapping sibling suite.");
          T.assert(probe.maxParallel.before === 3 && probe.maxParallel.after === 3,
            "Three ordinary suites must run concurrently on both sides of the barrier.");
          ["a", "b", "c"].forEach(function (suffix) {
            T.assert(events.indexOf("finish:before-" + suffix) < events.indexOf("start:barrier"), "Earlier suites finish before exclusive work starts.");
            T.assert(events.indexOf("finish:barrier") < events.indexOf("start:after-" + suffix), "Later suites wait for exclusive work to finish.");
          });
        }, 'window.schedulerProbe={active:0,exclusive:false,errors:[],events:[],maxParallel:{before:0,after:0},waiting:{before:[],after:[]}};');
      } finally { urls.forEach(function (url) { URL.revokeObjectURL(url); }); }
    } },
    { name: "Readiness polling rejects a predicate error after its first poll", run: async function () {
      var calls = 0, reason = new Error("Delayed readiness failure"), received;
      try {
        await T.waitFor(function () { if (++calls === 1) { return false; } throw reason; }, 1000);
      } catch (error) { received = error; }
      T.assert(calls === 2 && received === reason, "The original predicate error must reject the wait immediately.");
    } },
    { name: "Frame loading waits for requested application and mathematics readiness", run: async function () {
      var url = URL.createObjectURL(new Blob(['<!doctype html><body><main>\\(x\\)</main><script>' +
        'setTimeout(function(){document.body.dataset.ready="true";document.querySelector("main").innerHTML="<mjx-container>x</mjx-container>";},50);' +
        '</script></body>'], { type: "text/html" }));
      var frame = document.createElement("iframe");
      document.getElementById("sandbox").appendChild(frame);
      try {
        var page = await T.loadFrame(frame, url, {
          timeout: 5000, math: "main", ready: function (doc) { return doc.body.dataset.ready === "true"; }
        });
        T.assert(page.document === frame.contentDocument && page.window === frame.contentWindow);
        T.assert(page.document.querySelector("mjx-container") && page.document.body.dataset.ready === "true",
          "The helper must wait beyond navigation for both readiness conditions.");
      } finally { frame.remove(); URL.revokeObjectURL(url); }
    } },
    { name: "Frame readiness has a bounded timeout and reports mathematics errors", run: async function () {
      var frame = document.createElement("iframe"), received;
      document.getElementById("sandbox").appendChild(frame);
      var url = URL.createObjectURL(new Blob(['<!doctype html><body><main><mjx-merror>Bad TeX</mjx-merror></main></body>'], { type: "text/html" }));
      try {
        try { await T.loadFrame(frame, url, { timeout: 100, ready: function () { return false; }, message: "Fixture readiness timeout" }); }
        catch (error) { received = error; }
        T.assert(received && received.message === "Fixture readiness timeout", "An unready frame must reject within its own timeout.");
        received = null;
        try { await T.loadFrame(frame, url, { timeout: 5000, math: "main" }); }
        catch (error) { received = error; }
        T.assert(received && received.message.includes("mathematics failed to render"), "A math error must reject with its cause.");
      } finally { frame.remove(); URL.revokeObjectURL(url); }
    } },
    { name: "Capture lifecycle events retain their pointer identity", run: function () {
      var target = document.createElement("div");
      ["gotpointercapture", "lostpointercapture"].forEach(function (type) {
        var received;
        target.addEventListener(type, function (event) { received = event; }, { once: true });
        T.dispatch(target, type, window, { pointerId: 17, isPrimary: true });
        T.assert(received instanceof PointerEvent && received.pointerId === 17 && received.isPrimary,
          "Capture events must preserve the owning pointer's ID and primary status.");
      });
    } },
    { name: "A failed suite without check rows fails the aggregate and preserves its reason", run: function () {
      return aggregate("failed", "", "Fixture initialization failed.", function (doc) {
        T.assert(doc.body.dataset.status === "failed", "A suite-level failure must fail the whole run.");
        T.assert(doc.querySelector("#summary").textContent.includes("1 failed"), "The failure must be counted.");
        T.assert(doc.querySelector("#failure-details").textContent.includes("Fixture initialization failed."),
          "The suite's failure reason must reach the report.");
      });
    } },
    { name: "A failed suite without a summary still reports a diagnostic", run: function () {
      return aggregate("failed", "", "", function (doc) {
        T.assert(doc.body.dataset.status === "failed");
        T.assert(doc.querySelector("#failure-details").textContent.includes("without individual check results"));
      });
    } },
    { name: "Failed check rows override an inconsistent passing suite status", run: function () {
      return aggregate("passed", '<li class="pass">Good check</li><li class="fail">Bad check</li>', "", function (doc) {
        T.assert(doc.body.dataset.status === "failed");
        T.assert(doc.querySelector("#rows .status").classList.contains("fail"), "The suite row must also show failure.");
        T.assert(doc.querySelector("#summary").textContent.includes("1 checks passed, 1 failed"));
      });
    } },
    { name: "Successful suite counts remain intact", run: function () {
      return aggregate("passed", '<li class="pass">Good check</li>', "", function (doc) {
        T.assert(doc.body.dataset.status === "passed");
        T.assert(doc.querySelector("#summary").textContent === "1 checks passed across 1 of 1 suites.");
      });
    } },
    { name: "A blocked suite remains an unfinished aggregate", run: function () {
      // Blocked aggregates deliberately report failed to command-line runners.
      return aggregate("blocked", "", "", function (doc) {
        T.assert(doc.body.dataset.status === "failed");
        T.assert(doc.querySelector("#summary").textContent.includes("Fixture suite (blocked)"));
      });
    } }
  ], { title: "Test aggregate regression checks" });
})();
