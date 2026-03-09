import { spawn } from 'child_process';

type Wgrib2RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

const getWgrib2Path = () => process.env.WGRIB2_PATH ?? 'wgrib2';

const buildEnv = (overrides?: NodeJS.ProcessEnv) => {
  const env = { ...process.env, ...overrides };
  if (process.env.WGRIB2_DYLD_LIBRARY_PATH) {
    env.DYLD_LIBRARY_PATH = process.env.WGRIB2_DYLD_LIBRARY_PATH;
  }
  return env;
};

const runWgrib2 = async (args: string[], options?: Wgrib2RunOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    const child = spawn(getWgrib2Path(), args, {
      cwd: options?.cwd,
      env: buildEnv(options?.env)
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      const message = Buffer.concat(stderr).toString('utf8').trim();
      reject(new Error(message || `wgrib2 exited with code ${code}`));
    });
  });

export const runWgrib2Text = async (args: string[], options?: Wgrib2RunOptions) => {
  const buffer = await runWgrib2(args, options);
  return buffer.toString('utf8');
};

export const runWgrib2Buffer = async (args: string[], options?: Wgrib2RunOptions) =>
  runWgrib2(args, options);