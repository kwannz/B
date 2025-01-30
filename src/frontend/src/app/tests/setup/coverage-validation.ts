import { readFileSync } from 'fs';
import { join } from 'path';

interface CoverageData {
  total: {
    statements: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    lines: { pct: number };
  };
}

interface CoverageReport {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  timestamp: number;
  files: {
    [key: string]: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
  };
}

export function validateCoverage(coverageThreshold: number = 90): boolean {
  try {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverageData: CoverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

    const report: CoverageReport = {
      statements: coverageData.total.statements.pct,
      branches: coverageData.total.branches.pct,
      functions: coverageData.total.functions.pct,
      lines: coverageData.total.lines.pct,
      timestamp: Date.now(),
      files: {}
    };

    const isValid = Object.values(report)
      .filter(value => typeof value === 'number')
      .every(value => value >= coverageThreshold);

    if (!isValid) {
      console.error('Coverage validation failed:');
      console.error(`Statements: ${report.statements}% (threshold: ${coverageThreshold}%)`);
      console.error(`Branches: ${report.branches}% (threshold: ${coverageThreshold}%)`);
      console.error(`Functions: ${report.functions}% (threshold: ${coverageThreshold}%)`);
      console.error(`Lines: ${report.lines}% (threshold: ${coverageThreshold}%)`);
      return false;
    }

    console.log('Coverage validation passed:');
    console.log(`Statements: ${report.statements}%`);
    console.log(`Branches: ${report.branches}%`);
    console.log(`Functions: ${report.functions}%`);
    console.log(`Lines: ${report.lines}%`);
    return true;
  } catch (error) {
    console.error('Error validating coverage:', error);
    return false;
  }
}

export function generateCoverageReport(): CoverageReport | null {
  try {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverageData: CoverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

    return {
      statements: coverageData.total.statements.pct,
      branches: coverageData.total.branches.pct,
      functions: coverageData.total.functions.pct,
      lines: coverageData.total.lines.pct,
      timestamp: Date.now(),
      files: {}
    };
  } catch (error) {
    console.error('Error generating coverage report:', error);
    return null;
  }
}

export function validateWorkflowCoverage(workflowPages: string[]): boolean {
  try {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

    const workflowCoverage = workflowPages.map(page => {
      const pagePath = `src/app/${page}/page.tsx`;
      return coverageData[pagePath] || null;
    });

    const isValid = workflowCoverage.every(coverage => {
      if (!coverage) return false;
      return (
        coverage.statements.pct >= 90 &&
        coverage.branches.pct >= 90 &&
        coverage.functions.pct >= 90 &&
        coverage.lines.pct >= 90
      );
    });

    if (!isValid) {
      console.error('Workflow coverage validation failed:');
      workflowPages.forEach((page, index) => {
        const coverage = workflowCoverage[index];
        if (!coverage) {
          console.error(`${page}: No coverage data found`);
        } else {
          console.error(`${page}:`);
          console.error(`  Statements: ${coverage.statements.pct}%`);
          console.error(`  Branches: ${coverage.branches.pct}%`);
          console.error(`  Functions: ${coverage.functions.pct}%`);
          console.error(`  Lines: ${coverage.lines.pct}%`);
        }
      });
      return false;
    }

    console.log('Workflow coverage validation passed:');
    workflowPages.forEach((page, index) => {
      const coverage = workflowCoverage[index];
      console.log(`${page}:`);
      console.log(`  Statements: ${coverage.statements.pct}%`);
      console.log(`  Branches: ${coverage.branches.pct}%`);
      console.log(`  Functions: ${coverage.functions.pct}%`);
      console.log(`  Lines: ${coverage.lines.pct}%`);
    });
    return true;
  } catch (error) {
    console.error('Error validating workflow coverage:', error);
    return false;
  }
}

export function validateComponentCoverage(components: string[]): boolean {
  try {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

    const componentCoverage = components.map(component => {
      const componentPath = `src/app/components/${component}.tsx`;
      return coverageData[componentPath] || null;
    });

    const isValid = componentCoverage.every(coverage => {
      if (!coverage) return false;
      return (
        coverage.statements.pct >= 90 &&
        coverage.branches.pct >= 90 &&
        coverage.functions.pct >= 90 &&
        coverage.lines.pct >= 90
      );
    });

    if (!isValid) {
      console.error('Component coverage validation failed:');
      components.forEach((component, index) => {
        const coverage = componentCoverage[index];
        if (!coverage) {
          console.error(`${component}: No coverage data found`);
        } else {
          console.error(`${component}:`);
          console.error(`  Statements: ${coverage.statements.pct}%`);
          console.error(`  Branches: ${coverage.branches.pct}%`);
          console.error(`  Functions: ${coverage.functions.pct}%`);
          console.error(`  Lines: ${coverage.lines.pct}%`);
        }
      });
      return false;
    }

    console.log('Component coverage validation passed:');
    components.forEach((component, index) => {
      const coverage = componentCoverage[index];
      console.log(`${component}:`);
      console.log(`  Statements: ${coverage.statements.pct}%`);
      console.log(`  Branches: ${coverage.branches.pct}%`);
      console.log(`  Functions: ${coverage.functions.pct}%`);
      console.log(`  Lines: ${coverage.lines.pct}%`);
    });
    return true;
  } catch (error) {
    console.error('Error validating component coverage:', error);
    return false;
  }
}

export function validateHooksCoverage(hooks: string[]): boolean {
  try {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

    const hooksCoverage = hooks.map(hook => {
      const hookPath = `src/app/hooks/${hook}.ts`;
      return coverageData[hookPath] || null;
    });

    const isValid = hooksCoverage.every(coverage => {
      if (!coverage) return false;
      return (
        coverage.statements.pct >= 90 &&
        coverage.branches.pct >= 90 &&
        coverage.functions.pct >= 90 &&
        coverage.lines.pct >= 90
      );
    });

    if (!isValid) {
      console.error('Hooks coverage validation failed:');
      hooks.forEach((hook, index) => {
        const coverage = hooksCoverage[index];
        if (!coverage) {
          console.error(`${hook}: No coverage data found`);
        } else {
          console.error(`${hook}:`);
          console.error(`  Statements: ${coverage.statements.pct}%`);
          console.error(`  Branches: ${coverage.branches.pct}%`);
          console.error(`  Functions: ${coverage.functions.pct}%`);
          console.error(`  Lines: ${coverage.lines.pct}%`);
        }
      });
      return false;
    }

    console.log('Hooks coverage validation passed:');
    hooks.forEach((hook, index) => {
      const coverage = hooksCoverage[index];
      console.log(`${hook}:`);
      console.log(`  Statements: ${coverage.statements.pct}%`);
      console.log(`  Branches: ${coverage.branches.pct}%`);
      console.log(`  Functions: ${coverage.functions.pct}%`);
      console.log(`  Lines: ${coverage.lines.pct}%`);
    });
    return true;
  } catch (error) {
    console.error('Error validating hooks coverage:', error);
    return false;
  }
}

export function validateIntegrationCoverage(): boolean {
  try {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

    const integrationFiles = Object.keys(coverageData).filter(file => 
      file.includes('src/app/tests/integration/'));

    const integrationCoverage = integrationFiles.map(file => ({
      file,
      coverage: coverageData[file]
    }));

    const isValid = integrationCoverage.every(({ coverage }) => 
      coverage.statements.pct >= 90 &&
      coverage.branches.pct >= 90 &&
      coverage.functions.pct >= 90 &&
      coverage.lines.pct >= 90
    );

    if (!isValid) {
      console.error('Integration tests coverage validation failed:');
      integrationCoverage.forEach(({ file, coverage }) => {
        console.error(`${file}:`);
        console.error(`  Statements: ${coverage.statements.pct}%`);
        console.error(`  Branches: ${coverage.branches.pct}%`);
        console.error(`  Functions: ${coverage.functions.pct}%`);
        console.error(`  Lines: ${coverage.lines.pct}%`);
      });
      return false;
    }

    console.log('Integration tests coverage validation passed:');
    integrationCoverage.forEach(({ file, coverage }) => {
      console.log(`${file}:`);
      console.log(`  Statements: ${coverage.statements.pct}%`);
      console.log(`  Branches: ${coverage.branches.pct}%`);
      console.log(`  Functions: ${coverage.functions.pct}%`);
      console.log(`  Lines: ${coverage.lines.pct}%`);
    });
    return true;
  } catch (error) {
    console.error('Error validating integration tests coverage:', error);
    return false;
  }
}
