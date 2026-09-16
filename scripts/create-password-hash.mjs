import { createHmac, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const password = await prompt.question('New iPeople Plus password: ');
await prompt.close();

if (password.length < 14) {
  console.error('Use at least 14 characters. Nothing was generated.');
  process.exit(1);
}

const pepper = randomBytes(48).toString('base64url');
const digest = createHmac('sha256', pepper).update(password).digest('base64url');
console.log(`AUTH_PASSWORD_HASH=hmac-sha256$${digest}`);
console.log(`AUTH_PASSWORD_PEPPER=${pepper}`);
