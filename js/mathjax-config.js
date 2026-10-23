"use strict";

window.MathJax = {
  loader: {
    paths: {
      fonts: "[mathjax]/fonts"
    }
  },
  startup: {
    typeset: false
  },
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]]
  },
  svg: {
    fontCache: "global"
  },
  output: {
    fontPath: "[fonts]/%%FONT%%-font"
  },
  options: {
    skipHtmlTags: { "[+]": ["svg"] }
  }
};

// File origins cannot import the speech worker; expose native MathML instead.
if (window.location.protocol === "file:") {
  window.MathJax.loader.load = ["a11y/assistive-mml"];
  window.MathJax.options.enableSpeech = false;
  window.MathJax.options.enableBraille = false;
  window.MathJax.options.menuOptions = {
    settings: { speech: false, braille: false, assistiveMml: true }
  };
  window.MathJax.startup.ready = function () {
    window.MathJax.startup.defaultReady();
    var mathDocument = window.MathJax.startup.document;
    mathDocument.options.enableSpeech = false;
    mathDocument.options.enableBraille = false;
    mathDocument.options.enableAssistiveMml = true;
    // Saved menu preferences must not restart a worker blocked by file origins.
    Object.assign(mathDocument.menu.settings, {
      speech: false, braille: false, assistiveMml: true
    });
  };
}
