(function () {
  "use strict";
  var T = MechanismTest;

  async function aggregate(status, results, summary, verify) {
    var verdict = URL.createObjectURL(new Blob([
      '<!doctype html><body data-status="' + status + '"><p id="summary">' +
      summary + '</p><ol id="results">' + results + '</ol></body>'
    ], { type: "text/html" }));
    var frame = document.createElement("iframe");
    frame.title = "Isolated test aggregate";
    var catalog = [{ file: verdict, name: "Fixture suite", kind: "model" }];
    // Run the real aggregate with a private catalog so it cannot recurse.
    frame.srcdoc = '<!doctype html><head><script>window.MechanismTestCatalog=' +
      JSON.stringify(catalog) + ';</script><script defer src="all.js"></script></head>' +
      '<body data-status="running"><p id="summary"></p><p id="note"></p>' +
      '<table><tbody id="rows"></tbody></table><div id="frames"></div></body>';
    document.getElementById("sandbox").appendChild(frame);
    try {
      await T.waitFor(function () {
        var doc = frame.contentDocument;
        return doc && doc.body && /^(passed|failed)$/.test(doc.body.dataset.status);
      }, 10000, "The isolated aggregate must report a verdict.");
      verify(frame.contentDocument);
    } finally {
      frame.remove();
      URL.revokeObjectURL(verdict);
    }
  }

  T.run([
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
