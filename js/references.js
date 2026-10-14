(function (global) {
  "use strict";

  function joinNames(names) {
    if (names.length < 2) { return names[0]; }
    if (names.length === 2) { return names.join(" and "); }
    return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
  }

  function personName(person) { return person.given + " " + person.family; }

  function sentence(text) { return /[.!?]$/.test(text) ? text : text + "."; }

  function text(parent, value) {
    parent.appendChild(parent.ownerDocument.createTextNode(value));
  }

  function title(parent, value, url, italic) {
    var node = parent.ownerDocument.createElement(italic ? "cite" : "span");
    node.textContent = italic ? value : "“" + sentence(value) + "”";
    if (url) {
      var link = parent.ownerDocument.createElement("a");
      link.href = url;
      link.appendChild(node);
      parent.appendChild(link);
    } else {
      parent.appendChild(node);
    }
  }

  function entry(id) {
    var bibliography = global.MechanismBibliography;
    if (!Object.prototype.hasOwnProperty.call(bibliography, id)) {
      throw new Error("Unknown bibliography ID: " + id);
    }
    return bibliography[id];
  }

  function citationText(source, style) {
    var authors = joinNames(source.authors.map(function (person) { return person.family; }));
    if (style === "parenthetical") { return authors + ", " + source.year; }
    if (style && style !== "narrative") {
      throw new Error("Unknown citation style: " + style);
    }
    return authors + " (" + source.year + ")";
  }

  function referenceContent(node, source) {
    var content = node.ownerDocument.createDocumentFragment();
    var authors = source.authors.map(function (person, index) {
      return index === 0 ? person.family + ", " + person.given : personName(person);
    });
    text(content, sentence(joinNames(authors)) + " ");
    if (source.type === "article") {
      title(content, source.title, null, false);
      text(content, " ");
      title(content, source.journal, null, true);
      text(content, " " + source.volume + (source.issue ? ", no. " + source.issue : "") +
        " (" + source.year + "): " + source.pages + ". ");
      var link = node.ownerDocument.createElement("a");
      link.href = source.url;
      link.textContent = source.url;
      content.appendChild(link);
      text(content, ".");
    } else if (source.type === "book") {
      title(content, source.title, source.url, true);
      text(content, ". ");
      if (source.edition) { text(content, source.edition + " "); }
      if (source.contributors) {
        text(content, "With a chapter by " + joinNames(source.contributors.map(personName)) + ". ");
      }
      text(content, source.publisher + ", " + source.year + ".");
    } else if (source.type === "lecture") {
      title(content, source.title, source.url, false);
      text(content, " " + source.section + " of ");
      title(content, source.container, null, true);
      text(content, ". " + source.publisher + ", ");
      title(content, source.course, null, true);
      text(content, ", " + source.date + ".");
    } else {
      throw new Error("Unknown bibliography type: " + source.type);
    }
    if (node.dataset.locator) { text(content, " " + sentence(node.dataset.locator)); }
    return content;
  }

  // Resolve all IDs before replacing content, so an invalid ID cannot go unnoticed.
  function render(root) {
    var nodes = Array.from((root || document).querySelectorAll("[data-reference], [data-citation]"));
    var contents = nodes.map(function (node) {
      var source = entry(node.dataset.reference || node.dataset.citation);
      return node.hasAttribute("data-reference") ? referenceContent(node, source) :
        node.ownerDocument.createTextNode(citationText(source, node.dataset.citationStyle));
    });
    nodes.forEach(function (node, index) { node.replaceChildren(contents[index]); });
  }

  global.MechanismReferences = Object.freeze({ render: render });
  render(document);
})(window);
