#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = 90;
const CRITICAL_PAGES = [
  'agent-selection',
  'strategy-creation',
  'bot-integration',
  'key-management',
  'trading-dashboard',
  'wallet-comparison'
];

const CRITICAL_COMPONENTS = [
  'WalletConnect',
  'AgentCard',
  'StrategyForm',
  'BotStatus',
  'WalletDisplay',
  'TradingHistory',
  'PerformanceMetrics',
  'TransferDialog'
];

function validateCoverage() {
  try {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

    const results = {
      pages: {},
      components: {},
      hooks: {},
      overall: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      },
      passed: true
    };

    let totalStatements = 0;
    let totalBranches = 0;
    let totalFunctions = 0;
    let totalLines = 0;
    let coveredStatements = 0;
    let coveredBranches = 0;
    let coveredFunctions = 0;
    let coveredLines = 0;

    Object.entries(coverage).forEach(([file, data]) => {
      if (file.includes('src/app/')) {
        totalStatements += data.s.total;
        totalBranches += data.b.total;
        totalFunctions += data.f.total;
        totalLines += data.l.total;
        coveredStatements += data.s.covered;
        coveredBranches += data.b.covered;
        coveredFunctions += data.f.covered;
        coveredLines += data.l.covered;

        CRITICAL_PAGES.forEach(page => {
          if (file.includes(`${page}/page`)) {
            results.pages[page] = {
              statements: (data.s.covered / data.s.total) * 100,
              branches: (data.b.covered / data.b.total) * 100,
              functions: (data.f.covered / data.f.total) * 100,
              lines: (data.l.covered / data.l.total) * 100
            };
          }
        });

        CRITICAL_COMPONENTS.forEach(component => {
          if (file.includes(`components/${component}`)) {
            results.components[component] = {
              statements: (data.s.covered / data.s.total) * 100,
              branches: (data.b.covered / data.b.total) * 100,
              functions: (data.f.covered / data.f.total) * 100,
              lines: (data.l.covered / data.l.total) * 100
            };
          }
        });

        if (file.includes('hooks/')) {
          const hookName = path.basename(file, path.extname(file));
          results.hooks[hookName] = {
            statements: (data.s.covered / data.s.total) * 100,
            branches: (data.b.covered / data.b.total) * 100,
            functions: (data.f.covered / data.f.total) * 100,
            lines: (data.l.covered / data.l.total) * 100
          };
        }
      }
    });

    results.overall.statements = (coveredStatements / totalStatements) * 100;
    results.overall.branches = (coveredBranches / totalBranches) * 100;
    results.overall.functions = (coveredFunctions / totalFunctions) * 100;
    results.overall.lines = (coveredLines / totalLines) * 100;

    results.passed = Object.values(results.overall).every(value => value >= COVERAGE_THRESHOLD) &&
      Object.values(results.pages).every(metrics => 
        Object.values(metrics).every(value => value >= COVERAGE_THRESHOLD)
      ) &&
      Object.values(results.components).every(metrics => 
        Object.values(metrics).every(value => value >= COVERAGE_THRESHOLD)
      );

    console.log('\nCoverage Validation Results:');
    console.log('\nOverall Coverage:');
    Object.entries(results.overall).forEach(([metric, value]) => {
      console.log(`${metric}: ${value.toFixed(2)}% ${value >= COVERAGE_THRESHOLD ? '✓' : '✗'}`);
    });

    console.log('\nCritical Pages Coverage:');
    Object.entries(results.pages).forEach(([page, metrics]) => {
      console.log(`\n${page}:`);
      Object.entries(metrics).forEach(([metric, value]) => {
        console.log(`  ${metric}: ${value.toFixed(2)}% ${value >= COVERAGE_THRESHOLD ? '✓' : '✗'}`);
      });
    });

    console.log('\nCritical Components Coverage:');
    Object.entries(results.components).forEach(([component, metrics]) => {
      console.log(`\n${component}:`);
      Object.entries(metrics).forEach(([metric, value]) => {
        console.log(`  ${metric}: ${value.toFixed(2)}% ${value >= COVERAGE_THRESHOLD ? '✓' : '✗'}`);
      });
    });

    console.log('\nHooks Coverage:');
    Object.entries(results.hooks).forEach(([hook, metrics]) => {
      console.log(`\n${hook}:`);
      Object.entries(metrics).forEach(([metric, value]) => {
        console.log(`  ${metric}: ${value.toFixed(2)}% ${value >= COVERAGE_THRESHOLD ? '✓' : '✗'}`);
      });
    });

    console.log(`\nValidation ${results.passed ? 'PASSED ✓' : 'FAILED ✗'}`);

    if (!results.passed) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error validating coverage:', error);
    process.exit(1);
  }
}

validateCoverage();
