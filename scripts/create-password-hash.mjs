import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const password = await prompt.question('New iPeople Plus password: ');
await prompt.close();

if (password.length < 14) {
  console.error('Use at least 14 characters. Nothing was generated.');
  process.exit(1);
}

const iterations = 210_000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(`pbkdf2-sha256$${iterations}$${salt.toString('base64url')}$${digest.toString('base64url')}`);
