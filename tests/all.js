(function () {
  "use strict";

  var SUITES = [
    { file: "distribution-tests.html", name: "Shared distributions", kind: "model" },
    { file: "model-tests.html", name: "First-price model", kind: "model" },
    { file: "second-price-model-tests.html", name: "Second-price model", kind: "model" },
    { file: "bilateral-trade-model-tests.html", name: "Myerson-Satterthwaite model", kind: "model" },
    { file: "bargaining-sandbox-model-tests.html", name: "Bargaining sandbox model", kind: "model" },
    { file: "envelope-theorem-model-tests.html", name: "Envelope theorem model", kind: "model" },
    { file: "payments-from-allocation-rule-model-tests.html", name: "Payments model", kind: "model" },
    { file: "components-tests.html", name: "Shared components", kind: "interface" },
    { file: "menu-tests.html", name: "Module menu", kind: "interface" },
    { file: "ui-tests.html", name: "First-price interface", kind: "interface" },
    { file: "second-price-ui-tests.html", name: "Second-price interface", kind: "interface" },
    { file: "bilateral-trade-ui-tests.html", name: "Myerson-Satterthwaite interface", kind: "interface" },
    { file: "bargaining-sandbox-ui-tests.html", name: "Bargaining sandbox interface", kind: "interface" },
    { file: "envelope-theorem-ui-tests.html", name: "Envelope theorem interface", kind: "interface" },
    { file: "payments-from-allocation-rule-ui-tests.html", name: "Payments interface", kind: "interface" }
  ];

  var CONCURRENCY = 3;
  var TIMEOUT_MS = 90000;
  var POLL_MS = 120;

  var rows = document.getElementById("rows");
  var frames = document.getElementById("frames");
  var summary = document.getElementById("summary");

  function addRow(suite) {
    var row = document.createElement("tr");

    var nameCell = document.createElement("td");
    var link = document.createElement("a");
    link.href = suite.file;
    link.textContent = suite.name;
    nameCell.appendChild(link);

    var kindCell = document.createElement("td");
    kindCell.textContent = suite.kind;

    var statusCell = document.createElement("td");
    statusCell.className = "status pending";
    statusCell.textContent = "waiting";

    row.appendChild(nameCell);
    row.appendChild(kindCell);
    row.appendChild(statusCell);
    rows.appendChild(row);
    return statusCell;
  }

  function readSuite(frame) {
    var doc = frame.contentDocument;
    if (!doc || !doc.body) {
      return { state: "pending" };
    }
    var status = doc.body.dataset.status ||
      doc.body.getAttribute("data-status");
    if (status === "passed" || status === "failed") {
      return {
        state: status,
        passed: doc.querySelectorAll("#results li.pass").length,
        failed: doc.querySelectorAll("#results li.fail").length
      };
    }
    return { state: "pending" };
  }

  function isReachable(frame) {
    try {
      return Boolean(frame.contentDocument && frame.contentDocument.body);
    } catch (error) {
      return false;
    }
  }

  function runSuite(suite, statusCell) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.title = suite.name;
      frames.appendChild(frame);

      var started = Date.now();
      var settled = false;
      var timer = null;
      statusCell.textContent = "running";

      function finish(reading) {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          window.clearInterval(timer);
        }
        var result = {
          suite: suite,
          state: reading.state,
          passed: reading.passed || 0,
          failed: reading.failed || 0
        };
        if (reading.state === "passed") {
          statusCell.className = "status pass";
          statusCell.textContent = result.passed + " passed";
        } else if (reading.state === "failed") {
          statusCell.className = "status fail";
          statusCell.textContent = result.failed + " failed, " +
            result.passed + " passed";
        } else if (reading.state === "blocked") {
          statusCell.className = "status pending";
          statusCell.textContent = "blocked (same-origin)";
        } else {
          statusCell.className = "status fail";
          statusCell.textContent = "timed out";
        }
        frames.removeChild(frame);
        resolve(result);
      }

      frame.addEventListener("load", function () {
        if (isReachable(frame)) {
          return;
        }
        finish({ state: "blocked" });
      });

      timer = window.setInterval(function () {
        var reading;
        try {
          reading = readSuite(frame);
        } catch (error) {
          finish({ state: "blocked" });
          return;
        }
        if (reading.state !== "pending") {
          finish(reading);
          return;
        }
        if (Date.now() - started > TIMEOUT_MS) {
          finish({ state: "timeout" });
        }
      }, POLL_MS);

      frame.src = suite.file;
    });
  }

  function runAll() {
    var cells = SUITES.map(addRow);
    var next = 0;
    var results = [];

    function startOne() {
      if (next >= SUITES.length) {
        return Promise.resolve();
      }
      var index = next;
      next += 1;
      return runSuite(SUITES[index], cells[index]).then(function (result) {
        results.push(result);
        return startOne();
      });
    }

    var workers = [];
    var worker;
    for (worker = 0; worker < CONCURRENCY; worker += 1) {
      workers.push(startOne());
    }
    return Promise.all(workers).then(function () {
      return results;
    });
  }

  function announceFileProtocol() {
    SUITES.forEach(function (suite) {
      var statusCell = addRow(suite);
      statusCell.className = "status pending";
      statusCell.textContent = "not run";
    });
    summary.textContent = "Not run. This page needs to be served over HTTP.";
    summary.className = "blocked";
    document.getElementById("note").innerHTML =
      "Chrome and Firefox refuse to let one <code>file://</code> page read " +
      "another one's document, and every suite here is loaded in an iframe, " +
      "so none of them can report. This is a browser security rule, not a " +
      "test failure. Serve the repository root and reload from there:" +
      "<pre>py -m http.server 8000</pre>" +
      "then open <code>http://localhost:8000/tests/all.html</code>. " +
      "The seven model suites and <code>components-tests.html</code> also run " +
      "correctly opened directly as files, since they load no iframe.";
    document.body.dataset.status = "blocked";
    document.title = "Needs a server — All suites";
  }

  if (window.location.protocol === "file:") {
    announceFileProtocol();
    return;
  }

  runAll().then(function (results) {
    var totalPassed = 0;
    var totalFailed = 0;
    var unfinished = [];

    results.forEach(function (result) {
      totalPassed += result.passed;
      totalFailed += result.failed;
      if (result.state === "blocked" || result.state === "timeout") {
        unfinished.push(result.suite.name + " (" + result.state + ")");
      }
    });

    var clean = totalFailed === 0 && unfinished.length === 0;
    var text = totalPassed + " checks passed";
    if (totalFailed > 0) {
      text += ", " + totalFailed + " failed";
    }
    text += " across " + (results.length - unfinished.length) + " of " +
      SUITES.length + " suites.";
    if (unfinished.length > 0) {
      text += " Not reported: " + unfinished.join("; ") + ".";
    }

    summary.textContent = text;
    summary.className = clean ? "pass" : "fail";
    document.body.dataset.status = clean ? "passed" : "failed";
    document.title = (clean ? "PASS" : "FAIL") + " — All suites";
  });
})();
