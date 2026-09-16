# Before publishing iPeople Plus

1. Choose an administrator login and a password of at least 14 characters.
2. Run `node scripts/create-password-hash.mjs` and copy only its output to the hosting secret named `AUTH_PASSWORD_HASH`.
3. Add `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, and a unique 32+-character `SESSION_SECRET` as hosting secrets. Do not place real values in `.env.example`, source files, or Git.
4. Configure the Google OAuth client with the final HTTPS origin and add only the read-only Sheets scope.

The application creates a signed, `HttpOnly`, `Secure`, `SameSite=Strict` session cookie. API routes reject requests without that session. The password itself is never stored or returned by the application.
