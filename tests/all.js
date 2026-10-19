(function () {
  "use strict";

  var SUITES = [];

  function selectSuites() {
    var catalog = window.MechanismTestCatalog;
    if (!Array.isArray(catalog) || !catalog.length) { throw new Error("Test catalog is missing."); }
    var query = new URLSearchParams(window.location.search);
    var modules = query.getAll("module"), files = query.getAll("suite");
    var layout = query.get("layout") === "1";
    modules.forEach(function (id) {
      if (!catalog.some(function (suite) { return suite.module === id; })) {
        throw new Error("Unknown module: " + id);
      }
    });
    files.forEach(function (file) {
      if (!catalog.some(function (suite) { return suite.file === file; })) {
        throw new Error("Unknown suite: " + file);
      }
    });
    var filtered = modules.length || files.length || layout;
    var selected = catalog.filter(function (suite) {
      return filtered ? (modules.indexOf(suite.module) >= 0 || files.indexOf(suite.file) >= 0 ||
        (layout && suite.group === "layout")) : suite.status !== "draft";
    });
    if (!selected.length) { throw new Error("No suites selected."); }
    return selected;
  }

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
    if (status === "passed" || status === "failed" || status === "blocked") {
      return {
        state: status,
        passed: doc.querySelectorAll("#results li.pass").length,
        failed: doc.querySelectorAll("#results li.fail").length,
        failureDetails: Array.from(doc.querySelectorAll("#results li.fail"))
          .map(function (item) { return item.textContent; })
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
          failed: reading.failed || 0,
          failureDetails: reading.failureDetails || []
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
      "The model suites and <code>components-tests.html</code> also run " +
      "correctly opened directly as files, since they load no iframe.";
    document.body.dataset.status = "blocked";
    document.title = "Needs a server — All suites";
  }

  function reportRunnerDom() {
    if (new URLSearchParams(window.location.search).get("report") !== "1") {
      return;
    }
    window.fetch(window.location.origin + "/__mde-test-result", {
      method: "POST",
      headers: { "Content-Type": "text/html;charset=utf-8" },
      body: document.documentElement.outerHTML
    }).catch(function () {
      /* The visible aggregate status remains the source of truth for people. */
    });
  }
  try {
    SUITES = selectSuites();
  } catch (error) {
    summary.textContent = error.message;
    summary.className = "fail";
    var item = document.createElement("li"); item.className = "fail"; item.textContent = error.message;
    document.body.appendChild(item);
    document.body.dataset.status = "failed";
    reportRunnerDom();
    return;
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
    var details = results.reduce(function (lines, result) {
      return lines.concat(result.failureDetails.map(function (detail) {
        return result.suite.name + ": " + detail;
      }));
    }, []);
    if (details.length > 0) {
      var detailList = document.createElement("ul");
      detailList.id = "failure-details";
      details.forEach(function (detail) {
        var item = document.createElement("li");
        item.className = "fail";
        item.textContent = detail;
        detailList.appendChild(item);
      });
      document.body.appendChild(detailList);
    }
    document.body.dataset.status = clean ? "passed" : "failed";
    document.title = (clean ? "PASS" : "FAIL") + " — All suites";
    reportRunnerDom();
  });
})();
