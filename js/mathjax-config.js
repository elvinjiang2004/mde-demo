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
