(function (global) {
  "use strict";

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, tolerance, message) {
    var allowed = tolerance === undefined ? 1e-9 : tolerance;
    if (!Number.isFinite(actual) || !Number.isFinite(expected) ||
        Math.abs(actual - expected) > allowed) {
      throw new Error((message || "Values differ.") +
        " Expected " + expected + ", received " + actual + ".");
    }
  }

  function waitFor(predicate, timeout, message) {
    var started = Date.now();
    return new Promise(function (resolve, reject) {
      function check() {
        if (predicate()) {
          resolve();
        } else if (Date.now() - started >= timeout) {
          reject(new Error(message || "Timed out waiting for test readiness."));
        } else {
          global.setTimeout(check, 25);
        }
      }
      check();
    });
  }

  function nextAnimationFrames(frameWindow, count) {
    return new Promise(function (resolve) {
      function next(remaining) {
        if (remaining <= 0) {
          resolve();
          return;
        }
        frameWindow.requestAnimationFrame(function () { next(remaining - 1); });
      }
      next(count);
    });
  }

  function dispatch(element, type, frameWindow, init) {
    var options = Object.assign({ bubbles: true, cancelable: true }, init || {});
    var Constructor = type.indexOf("key") === 0 ? frameWindow.KeyboardEvent :
      (type.indexOf("pointer") === 0 ? frameWindow.PointerEvent : frameWindow.Event);
    element.dispatchEvent(new Constructor(type, options));
  }

  function addResult(name, error, results) {
    var item = document.createElement("li");
    item.className = error ? "fail" : "pass";
    item.textContent = (error ? "FAIL — " : "PASS — ") + name +
      (error ? ": " + error.message : "");
    (results || document.getElementById("results")).appendChild(item);
  }

  async function run(tests, options) {
    var settings = options || {};
    var failures = 0;
    var index;
    for (index = 0; index < tests.length; index += 1) {
      try {
        await tests[index].run();
        addResult(tests[index].name, null, settings.results);
      } catch (error) {
        failures += 1;
        addResult(tests[index].name, error, settings.results);
      }
    }
    return finish(failures, tests.length, settings);
  }

  function reportIfRequested() {
    if (new URLSearchParams(window.location.search).get("report") !== "1") {
      return;
    }
    window.fetch(window.location.origin + "/__mde-test-result", {
      method: "POST",
      headers: { "Content-Type": "text/html;charset=utf-8" },
      body: document.documentElement.outerHTML
    }).catch(function () {
      /* The page already exposes the test verdict to a human reader. */
    });
  }
  function finish(failures, count, options) {
    var settings = options || {};
    var passed = count - failures;
    var clean = failures === 0;
    var summary = settings.summary || document.getElementById("summary");
    summary.className = clean ? "pass" : "fail";
    summary.textContent = passed + " of " + count + " " +
      (settings.label || "tests") + " passed.";
    document.body.dataset.status = clean ? "passed" : "failed";
    document.title = (clean ? "PASS" : "FAIL") + " — " +
      (settings.title || document.title);
    reportIfRequested();
    if (typeof settings.cleanup === "function") {
      settings.cleanup();
    }
    return clean;
  }

  function assertScriptOrder(documentNode, requiredSources) {
    var sources = Array.from(documentNode.querySelectorAll("head > script[defer]"))
      .map(function (script) { return script.getAttribute("src"); });
    assert(sources.every(function (source) {
      return source && !/^https?:/i.test(source);
    }), "Every script should remain local for offline file use.");
    var previous = -1;
    requiredSources.forEach(function (source) {
      var index = sources.indexOf(source);
      assert(index >= 0, "Missing required script " + source + ".");
      assert(index > previous, "Required scripts must preserve dependency order.");
      previous = index;
    });
  }

  global.MechanismTest = Object.freeze({
    assert: assert,
    assertClose: assertClose,
    waitFor: waitFor,
    nextAnimationFrames: nextAnimationFrames,
    dispatch: dispatch,
    addResult: addResult,
    run: run,
    finish: finish,
    assertScriptOrder: assertScriptOrder
  });
})(window);
