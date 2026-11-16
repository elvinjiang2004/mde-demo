"use strict";

(function () {
  // Definitions live beside their lesson or shared Environment page.
  // Load the registry, environment definitions, page definitions, then sidebar.
  var pages = {};

  function registerPage(id, definition) {
    pages[id] = definition;
  }

  function registerEnvironment(id, groups) {
    registerPage(id, { pageNotation: [], environmentNotation: groups });
  }

  window.MechanismNotation = Object.freeze({
    pages: pages,
    registerPage: registerPage,
    registerEnvironment: registerEnvironment
  });
})();
