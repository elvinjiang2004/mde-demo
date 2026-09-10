(function (global) {
  "use strict";

  var formula = global.BargainingSandboxFormulaModel;
  var customGrid = global.BargainingSandboxCustomGrid;
  var custom = {};
  Object.keys(customGrid).forEach(function (name) {
    custom[name] = customGrid[name];
  });

  custom.truthfulPayoffRange = function (rule, agent) {
    return customGrid.summarize(rule).ranges[
      agent === "buyer" ? "buyerPayoff" : "sellerPayoff"
    ];
  };
  custom.revenueRange = function (rule) {
    return customGrid.summarize(rule).ranges.revenue;
  };
  custom.interimTruthfulPayoffRange = function (rule, agent) {
    return customGrid.summarize(rule).interimPayoffRanges[agent];
  };
  custom.buyerBestReportTrace = function () { return []; };
  custom.sellerBestReportTrace = function () { return []; };
  custom.buyerMaximumDeviationGain = function () { return null; };
  custom.sellerMaximumDeviationGain = function () { return null; };
  custom.buyerDeviationUtilityRange = function (rule) {
    return customGrid.buyerIcDiagnostics(rule).range;
  };
  custom.sellerDeviationUtilityRange = function (rule) {
    return customGrid.sellerIcDiagnostics(rule).range;
  };
  custom.sellerEnvelopeResidual = function (rule) {
    return customGrid.sellerIcDiagnostics(rule).envelopeResidual;
  };
  custom.exAnteIntegrals = function (rule) {
    return customGrid.summarize(rule).exAnte;
  };
  Object.freeze(custom);

  function dispatch(method) {
    return function (rule) {
      var representation = rule && rule.representation === "triangle-grid" ?
        custom : formula;
      return representation[method].apply(representation, arguments);
    };
  }

  var model = {
    VERDICT_TOLERANCE: formula.VERDICT_TOLERANCE,
    ALGEBRA_TOLERANCE: formula.ALGEBRA_TOLERANCE,
    FIELD_DEPENDENCIES: formula.FIELD_DEPENDENCIES,
    createVcgRule: formula.createVcgRule,
    createPostedPriceRule: formula.createPostedPriceRule,
    createAgvRule: formula.createAgvRule,
    createSplitDifferenceRule: formula.createSplitDifferenceRule,
    createChatterjeeSamuelsonRule: formula.createChatterjeeSamuelsonRule,
    createRevenueThresholdRule: formula.createRevenueThresholdRule,
    CUSTOM_RESOLUTION: customGrid.RESOLUTION,
    createCustomAllocationGrid: customGrid.createScalarGrid,
    createEfficientCustomAllocation: customGrid.createEfficientGrid,
    createCustomPaymentGrid: customGrid.createPatchGrid,
    constantCustomPaymentPatch: customGrid.constantPatch,
    customTriangleCentroid: customGrid.triangleCentroid,
    createCustomRule: customGrid.createRule,
    zeroBoundaryPayments: customGrid.zeroBoundaryPayments,
    evaluatePolynomial: formula.evaluatePolynomial,
    regionAt: formula.regionAt,
    checkBuyerEnvelopeResidual: formula.checkBuyerEnvelopeResidual
  };
  [
    "fieldValueAt",
    "fieldEvaluator",
    "ruleValuesAt",
    "fieldRange",
    "truthfulPayoffValuesAt",
    "allocationErrorAt",
    "truthfulPayoffRange",
    "revenueRange",
    "interimTruthfulPayoffRange",
    "buyerInterimRule",
    "sellerInterimRule",
    "buyerInterimAllocation",
    "buyerInterimPayment",
    "buyerInterimDeviationUtility",
    "buyerDeviationEvaluator",
    "buyerBestReport",
    "buyerBestReportTrace",
    "buyerDeviationUtilityRange",
    "buyerMaximumDeviationGain",
    "buyerIcDiagnostics",
    "sellerInterimAllocation",
    "sellerInterimPayment",
    "sellerInterimDeviationUtility",
    "sellerDeviationEvaluator",
    "sellerBestReport",
    "sellerBestReportTrace",
    "sellerDeviationUtilityRange",
    "sellerMaximumDeviationGain",
    "sellerEnvelopeResidual",
    "sellerIcDiagnostics",
    "diagnosticRange",
    "diagnosticEvaluator",
    "diagnosticValueAt",
    "exAnteIntegrals",
    "fieldDependencies",
    "dependencyKey",
    "summarize"
  ].forEach(function (method) {
    model[method] = dispatch(method);
  });

  global.BargainingSandboxModel = Object.freeze(model);
})(window);
