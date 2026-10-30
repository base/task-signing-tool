import { execFileSync } from 'node:child_process';
import { checkOverrides } from './override-checker';

function npmView(pkg: string, field: string): unknown {
  return JSON.parse(execFileSync('npm', ['view', pkg, field, '--json'], { encoding: 'utf-8' }));
}

process.exitCode = checkOverrides(npmView);
