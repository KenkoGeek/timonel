#!/usr/bin/env tsx

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import * as ts from 'typescript';

interface CoverageStats {
  functions: { documented: number; total: number };
  classes: { documented: number; total: number };
  interfaces: { documented: number; total: number };
  methods: { documented: number; total: number };
  issues: string[];
}

interface FileCoverage {
  file: string;
  stats: CoverageStats;
  coverage: number;
}

/**
 * Get all TypeScript files recursively.
 * @param dir - Directory to search for TypeScript files.
 * @returns Array of TypeScript file paths.
 */
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    try {
      const items = readdirSync(currentDir);

      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules, .git, dist, coverage, etc.
          if (!['node_modules', '.git', 'dist', 'coverage', '.next', 'build'].includes(item)) {
            traverse(fullPath);
          }
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  traverse(dir);
  return files;
}

/**
 * Check if a node has JSDoc documentation.
 * @param node - TypeScript AST node to check.
 * @returns True if the node has JSDoc comments.
 */
function hasJSDoc(node: ts.Node): boolean {
  const jsDoc = (node as unknown as { jsDoc?: unknown[] }).jsDoc;
  return jsDoc && jsDoc.length > 0;
}

/**
 * Analyze a TypeScript file for documentation coverage.
 * @param filePath - Path to the TypeScript file to analyze.
 * @returns Coverage statistics for the file.
 */
function analyzeFile(filePath: string): CoverageStats {
  const stats: CoverageStats = {
    functions: { documented: 0, total: 0 },
    classes: { documented: 0, total: 0 },
    interfaces: { documented: 0, total: 0 },
    methods: { documented: 0, total: 0 },
    issues: [],
  };

  try {
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
      switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
          handleFunctionDeclaration(node, stats, sourceFile);
          break;
        case ts.SyntaxKind.ClassDeclaration:
          handleClassDeclaration(node, stats, sourceFile);
          break;
        case ts.SyntaxKind.InterfaceDeclaration:
          handleInterfaceDeclaration(node, stats, sourceFile);
          break;
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.PropertyDeclaration:
          handleMethodDeclaration(node, stats, sourceFile);
          break;
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
  }

  return stats;
}

/**
 * Handle function declaration analysis.
 * @param node - AST node.
 * @param stats - Coverage statistics.
 * @param sourceFile - Source file.
 */
function handleFunctionDeclaration(
  node: ts.Node,
  stats: CoverageStats,
  sourceFile: ts.SourceFile,
): void {
  const funcDecl = node as ts.FunctionDeclaration;
  if (funcDecl.name && !funcDecl.name.text.startsWith('_')) {
    stats.functions.total++;
    if (hasJSDoc(node)) {
      stats.functions.documented++;
    } else {
      stats.issues.push(
        `⚠️  Function at line ${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1} missing JSDoc`,
      );
    }
  }
}

/**
 * Handle class declaration analysis.
 * @param node - AST node.
 * @param stats - Coverage statistics.
 * @param sourceFile - Source file.
 */
function handleClassDeclaration(
  node: ts.Node,
  stats: CoverageStats,
  sourceFile: ts.SourceFile,
): void {
  const classDecl = node as ts.ClassDeclaration;
  if (classDecl.name) {
    stats.classes.total++;
    if (hasJSDoc(node)) {
      stats.classes.documented++;
    } else {
      stats.issues.push(
        `⚠️  Class at line ${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1} missing JSDoc`,
      );
    }
  }
}

/**
 * Handle interface declaration analysis.
 * @param node - AST node.
 * @param stats - Coverage statistics.
 * @param sourceFile - Source file.
 */
function handleInterfaceDeclaration(
  node: ts.Node,
  stats: CoverageStats,
  sourceFile: ts.SourceFile,
): void {
  stats.interfaces.total++;
  if (hasJSDoc(node)) {
    stats.interfaces.documented++;
  } else {
    stats.issues.push(
      `⚠️  Interface at line ${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1} missing JSDoc`,
    );
  }
}

/**
 * Handle method declaration analysis.
 * @param node - AST node.
 * @param stats - Coverage statistics.
 * @param sourceFile - Source file.
 */
function handleMethodDeclaration(
  node: ts.Node,
  stats: CoverageStats,
  sourceFile: ts.SourceFile,
): void {
  const methodDecl = node as ts.MethodDeclaration | ts.PropertyDeclaration;
  if (
    methodDecl.name &&
    ts.isIdentifier(methodDecl.name) &&
    !methodDecl.name.text.startsWith('_')
  ) {
    // Skip private methods
    const isPrivate = methodDecl.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.PrivateKeyword,
    );
    if (!isPrivate) {
      stats.methods.total++;
      if (hasJSDoc(node)) {
        stats.methods.documented++;
      } else {
        stats.issues.push(
          `⚠️  Method at line ${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1} missing JSDoc`,
        );
      }
    }
  }
}

/**
 * Calculate coverage percentage.
 * @param stats - Coverage statistics to calculate percentage from.
 * @returns Coverage percentage (0-100).
 */
function calculateCoverage(stats: CoverageStats): number {
  const totalDocumented =
    stats.functions.documented +
    stats.classes.documented +
    stats.interfaces.documented +
    stats.methods.documented;
  const totalItems =
    stats.functions.total + stats.classes.total + stats.interfaces.total + stats.methods.total;

  return totalItems > 0 ? (totalDocumented / totalItems) * 100 : 100;
}

/**
 * Main function to analyze project documentation coverage.
 */
async function analyzeProjectCoverage() {
  console.log('📊 Project-wide Documentation Coverage Report');
  console.log('==============================================\n');

  const files = getTypeScriptFiles('src');
  const results: FileCoverage[] = [];

  let totalStats: CoverageStats = {
    functions: { documented: 0, total: 0 },
    classes: { documented: 0, total: 0 },
    interfaces: { documented: 0, total: 0 },
    methods: { documented: 0, total: 0 },
    issues: [],
  };

  for (const file of files) {
    const stats = analyzeFile(file);
    const coverage = calculateCoverage(stats);

    results.push({ file, stats, coverage });

    // Aggregate totals
    totalStats.functions.documented += stats.functions.documented;
    totalStats.functions.total += stats.functions.total;
    totalStats.classes.documented += stats.classes.documented;
    totalStats.classes.total += stats.classes.total;
    totalStats.interfaces.documented += stats.interfaces.documented;
    totalStats.interfaces.total += stats.interfaces.total;
    totalStats.methods.documented += stats.methods.documented;
    totalStats.methods.total += stats.methods.total;
  }

  // Sort by coverage (lowest first to highlight areas needing attention)
  results.sort((a, b) => a.coverage - b.coverage);

  // Show files with low coverage first
  console.log('🔍 Files Needing Attention (sorted by coverage):');
  console.log('================================================\n');

  const lowCoverageFiles = results.filter((r) => r.coverage < 80);

  for (const result of lowCoverageFiles.slice(0, 10)) {
    // Show top 10 worst
    console.log(`📄 ${result.file}`);
    console.log(
      `   Functions: ${result.stats.functions.documented}/${result.stats.functions.total}`,
    );
    console.log(`   Classes: ${result.stats.classes.documented}/${result.stats.classes.total}`);
    console.log(
      `   Interfaces: ${result.stats.interfaces.documented}/${result.stats.interfaces.total}`,
    );
    console.log(`   Methods: ${result.stats.methods.documented}/${result.stats.methods.total}`);
    console.log(`   Coverage: ${result.coverage.toFixed(1)}%`);

    if (result.stats.issues.length > 0) {
      console.log('   Issues:');
      result.stats.issues.slice(0, 5).forEach((issue) => console.log(`     ${issue}`));
      if (result.stats.issues.length > 5) {
        console.log(`     ... and ${result.stats.issues.length - 5} more`);
      }
    }
    console.log('');
  }

  // Overall statistics
  const overallCoverage = calculateCoverage(totalStats);

  console.log('📈 Overall Project Statistics');
  console.log('============================');
  console.log(`Functions: ${totalStats.functions.documented}/${totalStats.functions.total}`);
  console.log(`Classes: ${totalStats.classes.documented}/${totalStats.classes.total}`);
  console.log(`Interfaces: ${totalStats.interfaces.documented}/${totalStats.interfaces.total}`);
  console.log(`Methods: ${totalStats.methods.documented}/${totalStats.methods.total}`);
  console.log('');
  console.log(`🎯 Total Coverage: ${overallCoverage.toFixed(1)}%`);
  console.log(`📁 Files Analyzed: ${results.length}`);
  console.log(`⚠️  Files Below 80%: ${lowCoverageFiles.length}`);

  if (overallCoverage >= 70) {
    console.log('✅ Overall coverage is good');
  } else if (overallCoverage >= 50) {
    console.log('⚠️  Coverage needs improvement');
  } else {
    console.log('❌ Coverage is critically low');
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('==================');

  if (lowCoverageFiles.length > 0) {
    console.log(
      `1. Focus on the ${Math.min(5, lowCoverageFiles.length)} files with lowest coverage`,
    );
    console.log('2. Add JSDoc comments to public methods and classes');
    console.log('3. Include @example blocks for complex APIs');
  }

  if (totalStats.functions.total - totalStats.functions.documented > 0) {
    console.log(
      `4. Document ${totalStats.functions.total - totalStats.functions.documented} remaining functions`,
    );
  }

  if (totalStats.methods.total - totalStats.methods.documented > 0) {
    console.log(
      `5. Document ${totalStats.methods.total - totalStats.methods.documented} remaining methods`,
    );
  }
}

analyzeProjectCoverage().catch(console.error);
