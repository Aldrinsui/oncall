#!/usr/bin/env node
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}================================================================${colors.reset}
${colors.magenta}${colors.bold}      ⚡ OnGround.ai — Pre-Merge Verification Pipeline ⚡      ${colors.reset}
${colors.cyan}${colors.bold}================================================================${colors.reset}
${colors.gray}Target Branch:${colors.reset} fix/comprehensive-bug-fixes  ➜  ${colors.bold}main${colors.reset}
${colors.gray}Execution Mode:${colors.reset} Strict Zero-Defect Pre-Flight Gate
`);
}

function runStep(name, command, args) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    console.log(`${colors.yellow}▶ Running:${colors.reset} ${colors.bold}${name}${colors.reset} (${command} ${args.join(' ')})`);

    const proc = spawn(command, args, { stdio: 'inherit', shell: true });

    proc.on('close', (code) => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        console.log(`${colors.green}✔ ${name} PASSED${colors.reset} ${colors.dim}(${elapsed}s)${colors.reset}\n`);
        resolve({ name, passed: true, elapsed });
      } else {
        console.error(`${colors.red}✖ ${name} FAILED with exit code ${code}${colors.reset} ${colors.dim}(${elapsed}s)${colors.reset}\n`);
        resolve({ name, passed: false, elapsed });
      }
    });

    proc.on('error', (err) => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.error(`${colors.red}✖ ${name} ERROR: ${err.message}${colors.reset}\n`);
      resolve({ name, passed: false, elapsed });
    });
  });
}

async function main() {
  printBanner();
  const overallStart = performance.now();

  const steps = [
    { name: 'TypeScript Typecheck', cmd: 'npx', args: ['tsc', '--noEmit'] },
    { name: 'Vitest Automated Test Suite', cmd: 'npx', args: ['vitest', 'run'] },
    { name: 'Vite Production Build', cmd: 'npm', args: ['run', 'build'] },
  ];

  const results = [];

  for (const step of steps) {
    const res = await runStep(step.name, step.cmd, step.args);
    results.push(res);
    if (!res.passed) {
      console.error(`${colors.red}${colors.bold}⛔ PRE-MERGE VERIFICATION ABORTED${colors.reset}`);
      console.error(`${colors.red}Branch cannot be merged into main until all checks pass cleanly.${colors.reset}\n`);
      process.exit(1);
    }
  }

  const totalElapsed = ((performance.now() - overallStart) / 1000).toFixed(2);

  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bold}🎉 ALL CHECKS PASSED — READY FOR MERGE TO MAIN 🎉${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  results.forEach((r) => {
    console.log(`  ${colors.green}✔${colors.reset} ${r.name.padEnd(35)} [${r.elapsed}s]`);
  });
  console.log(`\n${colors.bold}Total Pipeline Duration:${colors.reset} ${totalElapsed}s\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal CLI pipeline error:', err);
  process.exit(1);
});
