"use strict";

// Shared explicit-typesetting lifecycle for every module page. MathJax's
// automatic startup typesetting is disabled in mathjax-config.js, so modules
// register their own HTML containers while this runtime owns readiness,
// serialization, and stale dynamic-update suppression.
(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var typesetQueue = Promise.resolve();
  var loadPromise = null;
  var requestVersions = new WeakMap();

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
      // Raw TeX remains visible and later requests stay usable after failure.
    });
    window.mechanismMathReady = typesetQueue;
    return typesetQueue;
  }

  function typesetInitial(selector) {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll(selector)
    );
    var initialTypeset = typesetQueue.catch(function () {
      // Keep initial typesetting independent of an earlier dynamic failure.
    }).then(function () {
      return waitForMathJax();
    }).then(function (mathJax) {
      if (!mathJax || targets.length === 0) {
        return null;
      }
      return mathJax.typesetPromise(targets);
    });
    return publish(initialTypeset);
  }

  function setText(element, texSource) {
    if (!element || element.namespaceURI === SVG_NS ||
        element.dataset.mathSource === texSource) {
      return window.mechanismMathReady;
    }

    var version = (requestVersions.get(element) || 0) + 1;
    requestVersions.set(element, version);
    element.dataset.mathSource = texSource;

    var update = typesetQueue.catch(function () {
      // Leave the next update usable if an earlier request failed.
    }).then(function () {
      if (requestVersions.get(element) !== version) {
        return null;
      }
      return waitForMathJax().then(function (mathJax) {
        if (requestVersions.get(element) !== version) {
          return null;
        }
        if (mathJax && typeof mathJax.typesetClear === "function") {
          mathJax.typesetClear([element]);
        }
        element.textContent = texSource;
        if (!mathJax) {
          return null;
        }
        return mathJax.typesetPromise([element]);
      });
    });
    return publish(update);
  }

  window.MechanismMath = Object.freeze({
    typesetInitial: typesetInitial,
    setText: setText
  });
  window.mechanismMathReady = typesetQueue;
})();
