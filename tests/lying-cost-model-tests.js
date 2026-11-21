(function () {
  "use strict";
  var assert = MechanismTest.assert, close = MechanismTest.assertClose;
  function rule(gamma, epsilon, preset) { return LyingCostModel.create({ gamma: gamma, epsilon: epsilon }, preset); }
  MechanismTest.run([
    { name: "Parameters reject nonfinite, out-of-range and nonnumeric values", run: function () {
      [-1, 1.01, NaN, Infinity, "0.5", null].forEach(function (bad) {
        ["gamma", "epsilon"].forEach(function (name) {
          var parameters = { gamma: 0.5, epsilon: 0.5 }, threw = false;
          parameters[name] = bad;
          try { LyingCostModel.create(parameters); } catch (error) { threw = true; }
          assert(threw, name + " accepted " + bad);
        });
      });
    } },
    { name: "Shared uniform case reproduces the paper's 0.206299474 threshold", run: function () {
      var r = rule(0, 1);
      close(r.totals.welfare, 1 / 6);
      close(r.totals.buyerUtility, 1 / 6);
      close(r.totals.sellerUtility, 1 / 6);
      close(r.totals.revenue, -1 / 6);
      close(r.totals.threshold, 0.2062994740159002, 1e-14);
      assert(!r.totals.implementable);
      assert(rule(0.21, 1).totals.implementable);
    } },
    { name: "Exact budget signs above, below, and at threshold including tiny overlaps", run: function () {
      [1, 0.6, 0.01, 1e-6].forEach(function (e) {
        var threshold = e * LyingCostModel.thresholdFactor;
        assert(!rule(threshold * 0.999, e).totals.implementable);
        assert(rule(threshold, e).totals.implementable);
        assert(rule(threshold * 1.001, e).totals.implementable);
        close(rule(threshold, e).totals.revenue, 0, 1e-15);
        assert(!rule(0, e).totals.exAnteBB, "Tiny deficit incorrectly rounded to a pass");
      });
    } },
    { name: "Zero overlap retains the isolated equality point and zero expectations", run: function () {
      [0, 0.5, 1].forEach(function (g) {
        var r = rule(g, 0);
        assert(r.q(1, 1) === 1 && r.q(0.999, 1) === 0 && r.q(1, 1.001) === 0);
        close(r.pB(1, 1), 1); close(r.pS(1, 1), 1);
        ["welfare", "tradeProbability", "revenue", "buyerUtility", "sellerUtility", "threshold", "largestDeficit"].forEach(function (field) { close(r.totals[field], 0); });
        assert(r.totals.implementable && r.totals.exPostBB);
      });
    } },
    { name: "Literal allocation boundary and all parameter corners stay finite", run: function () {
      [0, 0.3, 1].forEach(function (e) {
        [0, 0.4, 1].forEach(function (g) {
          var r = rule(g, e), c = 1 - e / 2;
          assert(r.q(c, c) === 1);
          assert(r.q(c - 1e-8, c) === 0);
          ["q", "pB", "pS", "buyerIC", "sellerIC", "revenue", "buyerPayoff", "sellerPayoff", "efficiency"].forEach(function (field) {
            var seller = field === "sellerIC";
            assert(Number.isFinite(r.field(field, seller ? 1 - e : 0, field === "buyerIC" ? 1 : 2 - e)));
          });
        });
      });
    } },
    { name: "Global buyer and seller deviations include lying disutility and never beat truth", run: function () {
      [0, 0.08, 0.25, 0.7, 1].forEach(function (g) {
        [0, 0.2, 0.7, 1].forEach(function (e) {
          var r = rule(g, e), a = 1 - e;
          for (var i = 0; i <= 50; i += 1) {
            var v = i / 50, c = a + v;
            for (var j = 0; j <= 50; j += 1) {
              var report = j / 50, sellerReport = a + report;
              assert(r.buyerDeviation(v, report) <= r.buyerRent(v) + 1e-12, "Buyer profitable lie");
              assert(r.sellerDeviation(c, sellerReport) <= r.sellerRent(c) + 1e-12, "Seller profitable lie");
              close(r.buyerDeviation(v, report), v * r.buyerAllocation(report) - r.buyerPayment(report) - g * Math.abs(v - report));
              close(r.sellerDeviation(c, sellerReport), r.sellerPayment(sellerReport) - c * r.sellerAllocation(sellerReport) - g * Math.abs(c - sellerReport));
            }
          }
        });
      });
    } },
    { name: "Independent midpoint integration validates welfare, rents and actual transfer totals", run: function () {
      [[0, 1], [0.25, 1], [0.1, 0.6], [0.8, 0.4]].forEach(function (parameters) {
        var r = rule(parameters[0], parameters[1]), n = 350;
        var sums = { welfare: 0, buyerPayment: 0, sellerPayment: 0, buyerUtility: 0, sellerUtility: 0 };
        for (var i = 0; i < n; i += 1) {
          var v = (i + 0.5) / n;
          for (var j = 0; j < n; j += 1) {
            var c = r.sellerSupport[0] + (j + 0.5) / n;
            var q = r.q(v, c), pB = r.pB(v, c), pS = r.pS(v, c);
            sums.welfare += (v - c) * q;
            sums.buyerPayment += pB; sums.sellerPayment += pS;
            sums.buyerUtility += v * q - pB; sums.sellerUtility += pS - c * q;
          }
        }
        Object.keys(sums).forEach(function (field) {
          // Discontinuous transfer surfaces have O(1/n) midpoint error on diagonal cells.
          close(sums[field] / (n * n), r.totals[field], field.indexOf("Payment") >= 0 ? 0.002 : 1e-5, field);
        });
        close(r.totals.buyerPayment - r.totals.sellerPayment, r.totals.revenue);
        close(r.totals.revenue + r.totals.buyerUtility + r.totals.sellerUtility, r.totals.welfare);
      });
    } },
    { name: "No-trade transfers, ex-post IR and the worst deficit agree with the chosen lift", run: function () {
      var r = rule(0.25, 1);
      assert(r.pB(0.8, 0.9) < 0, "Expected no-trade buyer rebate");
      assert(r.pS(0.1, 0.2) > 0, "Expected no-trade seller payment");
      assert(r.totals.exAnteBB && !r.totals.exPostBB);
      close(-r.field("revenue", 1, 1), r.totals.largestDeficit);
      for (var i = 0; i <= 50; i += 1) {
        for (var j = 0; j <= 50; j += 1) {
          var v = i / 50, c = j / 50;
          assert(v * r.q(v, c) - r.pB(v, c) >= -1e-12);
          assert(r.pS(v, c) - c * r.q(v, c) >= -1e-12);
          assert(r.field("revenue", v, c) >= -r.totals.largestDeficit - 1e-12);
        }
      }
      assert(rule(0.4, 0.4).totals.exPostBB);
      assert(!rule(0.399, 0.4).totals.exPostBB);
    } },
    { name: "Split-the-difference charges the midpoint only on trade and splits truthful surplus", run: function () {
      [0, 0.4, 1].forEach(function (e) {
        [0, 0.5, 1].forEach(function (g) {
          var r = rule(g, e, "split-the-difference"), a = 1-e;
          for (var i=0; i<=25; i++) {
            for (var j=0; j<=25; j++) {
              var v=i/25, c=a+j/25, expected=v>=c ? (v+c)/2 : 0;
              close(r.pB(v,c), expected); close(r.pS(v,c), expected);
              close(r.field("buyerPayoff",v,c), v*r.q(v,c)-expected);
              close(r.field("sellerPayoff",v,c), expected-c*r.q(v,c));
              close(r.field("revenue",v,c), 0);
              assert(r.field("buyerPayoff",v,c)>=0 && r.field("sellerPayoff",v,c)>=0);
            }
          }
          close(r.pB(a,a),a); close(r.pS(1,1),1);
          close(r.totals.buyerUtility+r.totals.sellerUtility,r.totals.welfare);
          close(r.totals.buyerPayment-r.totals.sellerPayment,0);
          assert(r.totals.exPostBB && r.totals.exAnteBB);
        });
      });
    } },
    { name: "Split interim payments and deviations equal independent integration of actual transfers", run: function () {
      [[0,1],[0.15,0.7],[0.5,0.4],[1,0]].forEach(function (parameters) {
        var g=parameters[0], e=parameters[1], r=rule(g,e,"split-the-difference"), a=1-e, n=1200;
        [0,0.12,0.51,0.87,1].forEach(function (report) {
          var sellerReport=a+report, buyerPayment=0, sellerPayment=0, buyerLie=0, sellerLie=0;
          var v=0.83, c=a+0.17;
          for (var j=0;j<n;j++) {
            var t=(j+0.5)/n;
            var pb=r.pB(report,a+t), ps=r.pS(t,sellerReport);
            buyerPayment+=pb/n; sellerPayment+=ps/n;
            buyerLie+=(v*r.q(report,a+t)-pb-g*Math.abs(v-report))/n;
            sellerLie+=(ps-c*r.q(t,sellerReport)-g*Math.abs(c-sellerReport))/n;
          }
          close(buyerPayment,r.buyerPayment(report),0.001);
          close(sellerPayment,r.sellerPayment(sellerReport),0.001);
          close(buyerLie,r.buyerDeviation(v,report),0.001);
          close(sellerLie,r.sellerDeviation(c,sellerReport),0.001);
        });
        var payment=0, buyer=0, seller=0, n2=300;
        for (var i=0;i<n2;i++) {
          for (var j=0;j<n2;j++) {
            var v=(i+0.5)/n2,c=a+(j+0.5)/n2,p=r.pB(v,c),q=r.q(v,c);
            payment+=p/(n2*n2); buyer+=(v*q-p)/(n2*n2); seller+=(p-c*q)/(n2*n2);
          }
        }
        close(payment,r.totals.buyerPayment,0.002);
        close(buyer,r.totals.buyerUtility,1e-5); close(seller,r.totals.sellerUtility,1e-5);
      });
    } },
    { name: "Analytic split best responses dominate every sampled report, including inactive types", run: function () {
      [[0,1],[0.1,1],[0.5,1],[0.1,0.4],[0.2,0.4],[0.6,0.3],[0,0],[0,0.25]].forEach(function (parameters) {
        var r=rule(parameters[0],parameters[1],"split-the-difference"),a=r.sellerSupport[0];
        for (var i=0;i<=40;i++) {
          var v=i/40,c=a+v,br=r.buyerBestReport(v),sr=r.sellerBestReport(c);
          assert(br>=0 && br<=1 && sr>=a && sr<=a+1);
          var buyerBest=r.buyerDeviation(v,br),sellerBest=r.sellerDeviation(c,sr);
          for (var j=0;j<=90;j++) {
            assert(buyerBest+1e-12>=r.buyerDeviation(v,j/90),"Buyer best response beaten");
            assert(sellerBest+1e-12>=r.sellerDeviation(c,a+j/90),"Seller best response beaten");
          }
          if(v<=a) { close(br,v); }
          if(c>=1) { close(sr,c); }
        }
        close(r.buyerDeviation(1,r.buyerBestReport(1))-r.buyerRent(1),r.totals.buyerMaximumInterimGain);
        close(r.sellerDeviation(a,r.sellerBestReport(a))-r.sellerRent(a),r.totals.sellerMaximumInterimGain);
      });
      var zero=rule(0,1,"split-the-difference");
      close(zero.buyerBestReport(0.9),0.6); close(zero.sellerBestReport(0.1),0.4);
      var kinked=rule(0.1,0.6,"split-the-difference");
      close(kinked.buyerBestReportTrace[1][0],0.6);
      close(kinked.buyerBestReportTrace[1][1],0.6);
      close(kinked.sellerBestReportTrace[1][0],0.8);
      close(kinked.sellerBestReportTrace[1][1],0.8);
    } },
    { name: "BIC and DSIC thresholds are distinct and include equality and zero overlap", run: function () {
      [1,0.4,0.01,1e-8].forEach(function (e) {
        assert(!rule(e/2*(1-1e-7),e,"split-the-difference").totals.buyerBIC);
        assert(rule(e/2,e,"split-the-difference").totals.buyerBIC);
        assert(rule(e/2*(1+1e-7),e,"split-the-difference").totals.sellerBIC);
        assert(!rule(0.5-1e-8,e,"split-the-difference").totals.buyerDSIC);
        assert(rule(0.5,e,"split-the-difference").totals.buyerDSIC);
        assert(rule(0.5+1e-8,e,"split-the-difference").totals.sellerDSIC);
        assert(!rule(1-1e-8,e).totals.buyerDSIC);
        assert(rule(1,e).totals.buyerDSIC && rule(1,e).totals.sellerDSIC);
      });
      Object.keys(LyingCostModel.presets).forEach(function(id) {
        [0,0.5,1].forEach(function(g) {
          var r=rule(g,0,id);
          assert(r.totals.buyerBIC && r.totals.sellerBIC && r.totals.buyerDSIC && r.totals.sellerDSIC);
          close(r.totals.buyerMaximumExPostGain,0); close(r.totals.sellerMaximumExPostGain,0);
        });
      });
      var partial=rule(0.25,0.4,"split-the-difference");
      assert(partial.totals.buyerBIC && !partial.totals.buyerDSIC);
      var fixed=rule(0.25,1,"split-the-difference");
      assert(fixed.totals.implementable && !fixed.totals.implementsEfficientAllocation,
        "Allocation implementability must not certify a particular non-BIC preset");
    } },
    { name: "Exact ex-post deviation bounds hold globally and have attaining deviations", run: function () {
      Object.keys(LyingCostModel.presets).forEach(function(id) {
        [0,0.2,0.499,0.5,0.9,1].forEach(function(g) {
          [0,0.1,0.37,1].forEach(function(e) {
            var r=rule(g,e,id), a=1-e;
            // Downward buyer and upward seller reports at the edge of trade attain the maxima.
            var br=r.totals.buyerDSIC ? 1 : a, sr=r.totals.sellerDSIC ? a : 1;
            var bg=r.buyerExPostDeviation(1,br,a)-r.field("buyerPayoff",1,a);
            var sg=r.sellerExPostDeviation(a,sr,1)-r.field("sellerPayoff",1,a);
            close(bg,r.totals.buyerMaximumExPostGain,1e-12);
            close(sg,r.totals.sellerMaximumExPostGain,1e-12);
            for(var i=0;i<=12;i++) {
              var v=i/12,c=a+v;
              for(var j=0;j<=12;j++) {
                var report=j/12,s=a+report;
                for(var k=0;k<=12;k++) {
                  var other=k/12;
                  var buyerLie=v*r.q(report,a+other)-r.pB(report,a+other)-g*Math.abs(v-report);
                  var sellerLie=r.pS(other,s)-c*r.q(other,s)-g*Math.abs(c-s);
                  close(buyerLie,r.buyerExPostDeviation(v,report,a+other));
                  close(sellerLie,r.sellerExPostDeviation(c,s,other));
                  assert(buyerLie-r.field("buyerPayoff",v,a+other)<=r.totals.buyerMaximumExPostGain+1e-12);
                  assert(sellerLie-r.field("sellerPayoff",other,c)<=r.totals.sellerMaximumExPostGain+1e-12);
                }
              }
            }
          });
        });
      });
    } },
    { name: "All independent parameters validate and explicit costs override symmetric compatibility input", run: function () {
      ["gammaB","gammaS","epsilon","k"].forEach(function(name) {
        [-1,1.01,NaN,Infinity,"0.5",null].forEach(function(bad) {
          var p={gammaB:0.2,gammaS:0.7,epsilon:0.8,k:0.3}; p[name]=bad;
          var threw=false; try { LyingCostModel.create(p); } catch(error) { threw=true; }
          assert(threw,name+" accepted invalid input");
        });
      });
      var r=LyingCostModel.create({gamma:0.5,gammaB:0.1,gammaS:0.8,epsilon:1,k:0});
      close(r.gammaB,0.1);close(r.gammaS,0.8);close(r.k,0);
    } },
    { name: "Asymmetric minimum rents satisfy global IC and integrate to the transfer and welfare totals", run: function () {
      [[0,0.8,1],[0.15,0.5,0.7],[0.8,0.1,0.4],[1,0,1],[0,1,0]].forEach(function(p) {
        var r=LyingCostModel.create({gammaB:p[0],gammaS:p[1],epsilon:p[2],k:0.1}),a=r.sellerSupport[0],n=500;
        var sums={buyerUtility:0,sellerUtility:0,buyerPayment:0,sellerPayment:0};
        for(var i=0;i<n;i++) {
          var v=(i+0.5)/n,c=a+v;
          sums.buyerUtility+=r.buyerRent(v)/n; sums.sellerUtility+=r.sellerRent(c)/n;
          for(var j=0;j<n;j++) {
            var other=(j+0.5)/n;
            sums.buyerPayment+=r.pB(v,a+other)/(n*n);
            sums.sellerPayment+=r.pS(other,c)/(n*n);
          }
        }
        Object.keys(sums).forEach(function(name){close(sums[name],r.totals[name],name.includes("Payment")?0.002:2e-6);});
        close(r.totals.buyerUtility+r.totals.sellerUtility+r.totals.revenue,r.totals.welfare);
        for(var i=0;i<=30;i++) {
          var v=i/30,c=a+v;
          for(var j=0;j<=40;j++) {
            var report=j/40,s=a+report;
            var buyer=v*r.buyerAllocation(report)-r.buyerPayment(report)-p[0]*Math.abs(v-report);
            var seller=r.sellerPayment(s)-c*r.sellerAllocation(s)-p[1]*Math.abs(c-s);
            close(r.buyerDeviation(v,report),buyer); close(r.sellerDeviation(c,s),seller);
            assert(buyer<=r.buyerRent(v)+1e-12 && seller<=r.sellerRent(c)+1e-12);
            assert(r.field("revenue",v,s)>=-r.totals.largestDeficit-1e-12);
          }
        }
        close(Math.max(-r.field("revenue",1,1),-r.field("revenue",a,a)),r.totals.largestDeficit);
      });
    } },
    { name: "Asymmetric budget boundary includes one-sided costs and rejects tiny deficits", run: function () {
      [1,0.6,1e-6,1e-30].forEach(function(e) {
        [false,true].forEach(function(swap) {
          function at(g) { return LyingCostModel.create({gammaB:swap?0:g,gammaS:swap?g:0,epsilon:e}); }
          assert(at(e).totals.implementable && at(e).totals.exAnteBB);
          close(at(e).totals.revenue,0);
          assert(!at(e*0.999).totals.implementable);
          assert(at(e*0.999).totals.revenue<0,"Keep a small strictly negative revenue");
          assert(!at(e).totals.exPostBB);
          var almost=at(e*(1-1e-7));
          assert(!almost.totals.implementable && almost.totals.revenue<0,
            "A tiny one-sided deficit must not round away beside the other agent's rent");
        });
        var gs=0.1*e, gb=e*(1-Math.cbrt(1-Math.pow(0.9,3)));
        assert(!LyingCostModel.create({gammaB:gb*0.999,gammaS:gs,epsilon:e}).totals.implementable);
        assert(LyingCostModel.create({gammaB:gb*1.001,gammaS:gs,epsilon:e}).totals.implementable);
      });
    } },
    { name: "k-double auction prices, truthful welfare shares, interim deviations and totals match independent integration", run: function () {
      [0,0.2,0.5,0.85,1].forEach(function(k) {
        [0,0.4,1].forEach(function(e) {
          var gB=0.12,gS=0.61,r=LyingCostModel.create({gammaB:gB,gammaS:gS,epsilon:e,k:k},"split-the-difference");
          var a=1-e,n=900;
          [0.12,0.6,1].forEach(function(report) {
            var s=a+report,pb=0,ps=0,bd=0,sd=0,v=0.83,c=a+0.17;
            for(var i=0;i<n;i++) {
              var other=(i+0.5)/n;
              var bp=r.pB(report,a+other),sp=r.pS(other,s);
              close(bp,(k*report+(1-k)*(a+other))*r.q(report,a+other));
              close(sp,(k*other+(1-k)*s)*r.q(other,s));
              pb+=bp/n;ps+=sp/n;
              bd+=(v*r.q(report,a+other)-bp-gB*Math.abs(v-report))/n;
              sd+=(sp-c*r.q(other,s)-gS*Math.abs(c-s))/n;
            }
            close(pb,r.buyerPayment(report),0.002);close(ps,r.sellerPayment(s),0.002);
            close(bd,r.buyerDeviation(v,report),0.002);close(sd,r.sellerDeviation(c,s),0.002);
          });
          var sums={buyerPayment:0,sellerPayment:0,buyerUtility:0,sellerUtility:0}; n=220;
          for(var i=0;i<n;i++) {
            for(var j=0;j<n;j++) {
              var v=(i+0.5)/n,c=a+(j+0.5)/n,q=r.q(v,c),pb=r.pB(v,c),ps=r.pS(v,c);
              close(pb,ps);close(r.field("buyerPayoff",v,c),(1-k)*Math.max(v-c,0));
              close(r.field("sellerPayoff",v,c),k*Math.max(v-c,0));
              sums.buyerPayment+=pb/(n*n);sums.sellerPayment+=ps/(n*n);
              sums.buyerUtility+=(v*q-pb)/(n*n);sums.sellerUtility+=(ps-c*q)/(n*n);
            }
          }
          Object.keys(sums).forEach(function(name){close(sums[name],r.totals[name],name.includes("Payment")?0.003:1e-5);});
          close(r.totals.revenue,0);close(r.totals.buyerUtility+r.totals.sellerUtility,r.totals.welfare);
        });
      });
    } },
    { name: "Asymmetric auction best responses beat every sampled report and attain the analytic gains", run: function () {
      [0,0.15,0.5,0.9,1].forEach(function(k) {
        [[0,0,1],[0.04,0.35,0.6],[0.7,0.1,1],[1,0,0],[0,1,0.2]].forEach(function(p) {
          var r=LyingCostModel.create({gammaB:p[0],gammaS:p[1],epsilon:p[2],k:k},"split-the-difference"),a=1-p[2];
          for(var i=0;i<=30;i++) {
            var v=i/30,c=a+v,br=r.buyerBestReport(v),sr=r.sellerBestReport(c);
            assert(br>=0 && br<=1 && sr>=a && sr<=a+1);
            for(var j=0;j<=80;j++) {
              assert(r.buyerDeviation(v,br)+1e-12>=r.buyerDeviation(v,j/80));
              assert(r.sellerDeviation(c,sr)+1e-12>=r.sellerDeviation(c,a+j/80));
            }
          }
          close(r.buyerDeviation(1,r.buyerBestReport(1))-r.buyerRent(1),r.totals.buyerMaximumInterimGain);
          close(r.sellerDeviation(a,r.sellerBestReport(a))-r.sellerRent(a),r.totals.sellerMaximumInterimGain);
          [r.buyerBestReportTrace,r.sellerBestReportTrace].forEach(function(trace) {
            assert(trace.every(function(point){return point.every(Number.isFinite);}));
          });
        });
      });
    } },
    { name: "Agent-specific BIC and DSIC thresholds include equality for all k endpoints and tiny overlap", run: function () {
      [0,0.125,0.5,0.875,1].forEach(function(k) {
        [0,0.4,1,1e-8].forEach(function(e) {
          function at(gB,gS) {return LyingCostModel.create({gammaB:gB,gammaS:gS,epsilon:e,k:k},"split-the-difference");}
          var r=at(k*e,(1-k)*e);
          assert(r.totals.buyerBIC && r.totals.sellerBIC);
          assert(at(k,1-k).totals.buyerDSIC && at(k,1-k).totals.sellerDSIC);
          if(k*e>0) {assert(!at(k*e*(1-1e-7),1).totals.buyerBIC);}
          if((1-k)*e>0) {assert(!at(1,(1-k)*e*(1-1e-7)).totals.sellerBIC);}
          if(e>0 && k>0) {assert(!at(k*(1-1e-7),1).totals.buyerDSIC);}
          if(e>0 && k<1) {assert(!at(1,(1-k)*(1-1e-7)).totals.sellerDSIC);}
        });
      });
    } },
    { name: "Asymmetric ex-post deviation bounds hold globally for both mechanisms and are attained", run: function () {
      Object.keys(LyingCostModel.presets).forEach(function(id) {
        [0,0.2,0.8,1].forEach(function(k) {
          [[0,0.7,1],[0.6,0.1,0.4],[1,0,1],[0,1,0]].forEach(function(p) {
            var r=LyingCostModel.create({gammaB:p[0],gammaS:p[1],epsilon:p[2],k:k},id),a=1-p[2];
            close(r.buyerExPostDeviation(1,r.totals.buyerDSIC?1:a,a)-r.field("buyerPayoff",1,a),r.totals.buyerMaximumExPostGain);
            close(r.sellerExPostDeviation(a,r.totals.sellerDSIC?a:1,1)-r.field("sellerPayoff",1,a),r.totals.sellerMaximumExPostGain);
            for(var i=0;i<=10;i++) {
              for(var j=0;j<=10;j++) {
                for(var h=0;h<=10;h++) {
                  var v=i/10,c=a+i/10,br=j/10,sr=a+j/10,other=h/10;
                  var bu=v*r.q(br,a+other)-r.pB(br,a+other)-p[0]*Math.abs(v-br);
                  var su=r.pS(other,sr)-c*r.q(other,sr)-p[1]*Math.abs(c-sr);
                  close(bu,r.buyerExPostDeviation(v,br,a+other));
                  close(su,r.sellerExPostDeviation(c,sr,other));
                  assert(bu-r.field("buyerPayoff",v,a+other)<=r.totals.buyerMaximumExPostGain+1e-12);
                  assert(su-r.field("sellerPayoff",other,c)<=r.totals.sellerMaximumExPostGain+1e-12);
                }
              }
            }
          });
        });
      });
    } },
    { name: "BIC is not mislabeled DSIC for the selected transfer representation", run: function () {
      var r = rule(0.25, 1), v = 0.2, report = 0.1, c = 0;
      var truth = v * r.q(v, c) - r.pB(v, c);
      var lie = v * r.q(report, c) - r.pB(report, c) - 0.25 * Math.abs(v - report);
      assert(lie > truth && r.totals.buyerBIC);
    } }
  ], { title: "Lying-cost model tests" });
})();
