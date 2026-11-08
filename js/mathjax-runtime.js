"use strict";

(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";
  // MathJax mutates shared state; serialize requests and discard superseded text.
  var typesetQueue = Promise.resolve();
  var loadPromise = null;
  var requests = new WeakMap();

  function readyMathJax() {
    var mathJax = window.MathJax;
    if (!mathJax || typeof mathJax.typesetPromise !== "function") {
      return null;
    }
    if (mathJax.startup && mathJax.startup.promise) {
      return Promise.resolve(mathJax.startup.promise).then(function () {
        return mathJax;
      });
    }
    return Promise.resolve(mathJax);
  }

  function waitForMathJax() {
    var ready = readyMathJax();
    if (ready) {
      return ready;
    }
    if (document.readyState === "complete") {
      return Promise.resolve(null);
    }
    if (!loadPromise) {
      loadPromise = new Promise(function (resolve) {
        window.addEventListener("load", function () {
          resolve(readyMathJax());
        }, { once: true });
      }).then(function (mathJax) {
        return mathJax;
      });
    }
    return loadPromise;
  }

  function publish(queue) {
    typesetQueue = queue.catch(function () {
    });
    window.mechanismMathReady = typesetQueue;
    // Recover the shared queue, while callers can still observe this request's error.
    return queue;
  }

  function assertRendered(mathJax, targets) {
    if (!mathJax) { throw new Error("The mathematics renderer is unavailable."); }
    targets.forEach(function (target) {
      if (target.querySelector('mjx-merror, merror, [data-mml-node="merror"]')) {
        throw new Error("The mathematics contains a rendering error.");
      }
    });
  }

  function typesetInitial(selector) {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll(selector)
    );
    var initialTypeset = typesetQueue.catch(function () {
    }).then(function () {
      return waitForMathJax();
    }).then(function (mathJax) {
      if (targets.length === 0) { return null; }
      assertRendered(mathJax, []);
      return mathJax.typesetPromise(targets).then(function () {
        assertRendered(mathJax, targets);
      });
    });
    return publish(initialTypeset);
  }

  function setText(element, texSource) {
    if (!element || element.namespaceURI === SVG_NS) {
      return window.mechanismMathReady;
    }

    var previous = requests.get(element);
    if (previous && previous.source === texSource && previous.status !== "failed") {
      return previous.promise;
    }
    var request = { source: texSource, status: "pending", promise: null };
    requests.set(element, request);
    element.dataset.mathSource = texSource;

    var update = typesetQueue.catch(function () {
    }).then(function () {
      if (requests.get(element) !== request) {
        return null;
      }
      return waitForMathJax().then(function (mathJax) {
        if (requests.get(element) !== request) {
          return null;
        }
        if (mathJax && typeof mathJax.typesetClear === "function") {
          mathJax.typesetClear([element]);
        }
        element.textContent = texSource;
        assertRendered(mathJax, []);
        return mathJax.typesetPromise([element]).then(function () {
          assertRendered(mathJax, [element]);
        });
      });
    }).then(function () {
      request.status = "ready";
    }, function (error) {
      request.status = "failed";
      throw error;
    });
    request.promise = publish(update);
    return request.promise;
  }

  window.MechanismMath = Object.freeze({
    typesetInitial: typesetInitial,
    setText: setText
  });
  window.mechanismMathReady = typesetQueue;
})();
