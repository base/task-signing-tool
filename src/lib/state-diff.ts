import { spawn } from 'child_process';
import path from 'path';
import { StateChange, StateDiffResult, StateOverride } from './types/index';

export class StateDiffClient {
  private binaryPath: string;

  constructor(binaryPath = path.join(process.cwd(), 'state-diff')) {
    // Default to go-simulator directory relative to tool
    this.binaryPath = binaryPath;
    console.log(`🔧 StateDiffClient initialized with binary path: ${this.binaryPath}`);
  }

  async simulate(
    rpcUrl: string,
    forgeCmdParts: string[],
    workdir: string
  ): Promise<{
    result: StateDiffResult;
    output: string;
  }> {
    const args = ['run', '.', '--rpc', rpcUrl, '--workdir', workdir, '--', ...forgeCmdParts];
    console.log(`🔧 Executing state-diff using spawn`);
    console.log(`📁 Working directory: ${this.binaryPath}`);
    console.log(`🔧 Command: go ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn('go', args, {
        cwd: this.binaryPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(
          new Error(
            'StateDiffLib::simulateWithExtractedData: State-diff simulation timed out after 2 minutes'
          )
        );
      }, 120000);

      child.on('close', code => {
        clearTimeout(timeout);

        if (code !== 0) {
          console.error('❌ State-diff simulation failed with exit code:', code);
          console.error('Stdout:', stdout);
          console.error('Stderr:', stderr);
          reject(
            new Error(
              `'StateDiffLib::simulateWithExtractedData: Command failed with exit code ${code}: ${stderr}`
            )
          );
          return;
        }

        if (stderr) {
          // Don't throw on stderr, as Go might output logs there
          console.warn('⚠️ State-diff stderr:', stderr);
        }

        console.log(`✅ State-diff simulation completed with extracted data`);

        const anchor = '<<<RESULT>>>';
        const strt = stdout.indexOf(anchor);
        const jsonRes = stdout.slice(strt + anchor.length + 1);
        console.log('Raw result:');
        console.log(jsonRes);

        // Parse JSON output
        let result: StateDiffResult;
        try {
          result = JSON.parse(jsonRes);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON output:', parseError);
          console.error('Raw output:', stdout);
          reject(
            new Error(
              `'StateDiffLib::simulateWithExtractedData: Failed to parse state-diff JSON output: ${parseError}`
            )
          );
          return;
        }

        resolve({
          result,
          output: stdout,
        });
      });

      child.on('error', error => {
        clearTimeout(timeout);
        console.error('❌ State-diff process error:', error);
        reject(
          new Error(
            `'StateDiffLib::simulateWithExtractedData: State-diff simulation failed: ${error.message}`
          )
        );
      });
    });
  }

  // Convert Go JSON format to TypeScript types (should already match)
  parseStateChanges(result: StateDiffResult): StateChange[] {
    return result.state_changes.map(change => ({
      name: change.name,
      address: change.address,
      changes: change.changes.map(c => ({
        key: c.key,
        before: c.before,
        after: c.after,
        description: c.description,
      })),
    }));
  }

  parseStateOverrides(result: StateDiffResult): StateOverride[] {
    return result.state_overrides.map(override => ({
      name: override.name,
      address: override.address,
      overrides: override.overrides.map(o => ({
        key: o.key,
        value: o.value,
        description: o.description,
      })),
    }));
  }
}
