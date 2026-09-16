import { env } from 'cloudflare:workers';

type RuntimeEnv = {
  AUTH_USERNAME?: string;
  AUTH_PASSWORD_HASH?: string;
  AUTH_PASSWORD_PEPPER?: string;
  SESSION_SECRET?: string;
};

type SessionPayload = { sub: string; exp: number };

const runtime = () => env as unknown as RuntimeEnv;
const text = new TextEncoder();
const SESSION_COOKIE = '__Host-ipeople_session';
const PBKDF2_MIN_ITERATIONS = 210_000;
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

function toBase64Url(value: Uint8Array) {
  let binary = '';
  value.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) difference |= (left[index % (left.length || 1)] ?? 0) ^ (right[index % (right.length || 1)] ?? 0);
  return difference === 0;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', text.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, text.encode(value)));
}

function cookieValue(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

function sessionCookie(value: string, maxAge: number) {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function authConfigurationIsReady() {
  const config = runtime();
  return Boolean(config.AUTH_USERNAME && config.AUTH_PASSWORD_HASH && config.SESSION_SECRET);
}

export async function verifyPassword(username: string, password: string) {
  const config = runtime();
  if (!config.AUTH_USERNAME || !config.AUTH_PASSWORD_HASH || !config.SESSION_SECRET) return false;
  const [scheme, iterationText, saltText, digestText] = config.AUTH_PASSWORD_HASH.split('$');
  if (scheme === 'hmac-sha256') {
    const expected = fromBase64Url(iterationText ?? '');
    if (!config.AUTH_PASSWORD_PEPPER || !expected) return false;
    const actual = await hmac(password, config.AUTH_PASSWORD_PEPPER);
    return equalBytes(text.encode(username), text.encode(config.AUTH_USERNAME)) && equalBytes(actual, expected);
  }
  const iterations = Number(iterationText);
  const salt = fromBase64Url(saltText ?? '');
  const expected = fromBase64Url(digestText ?? '');
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < PBKDF2_MIN_ITERATIONS || !salt || !expected) return false;
  const material = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, expected.length * 8));
  return equalBytes(text.encode(username), text.encode(config.AUTH_USERNAME)) && equalBytes(actual, expected);
}

export async function issueSession(username: string) {
  const secret = runtime().SESSION_SECRET;
  if (!secret) throw new Error('missing-session-secret');
  const payload = toBase64Url(text.encode(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS } satisfies SessionPayload)));
  return `${payload}.${toBase64Url(await hmac(payload, secret))}`;
}

export async function sessionFor(request: Request): Promise<SessionPayload | null> {
  const secret = runtime().SESSION_SECRET;
  const token = cookieValue(request, SESSION_COOKIE);
  if (!secret || !token) return null;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length) return null;
  const supplied = fromBase64Url(signature);
  if (!supplied || !equalBytes(supplied, await hmac(payload, secret))) return null;
  try {
    const decoded = fromBase64Url(payload);
    const data = JSON.parse(new TextDecoder().decode(decoded ?? new Uint8Array())) as Partial<SessionPayload>;
    if (typeof data.sub !== 'string' || typeof data.exp !== 'number' || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return { sub: data.sub, exp: data.exp };
  } catch {
    return null;
  }
}

export async function requireApiAuth(request: Request) {
  return await sessionFor(request) ? null : json({ error: 'Потрібен вхід.' }, 401);
}

export function loginResponse(session: string) {
  return json({ authenticated: true }, 200, { 'Set-Cookie': sessionCookie(session, SESSION_TTL_SECONDS) });
}

export function logoutResponse() {
  return json({ authenticated: false }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}
