# Before publishing iPeople Plus

1. Choose an administrator login and a password of at least 14 characters.
2. Generate the password hash with its own randomly generated `AUTH_PASSWORD_PEPPER`; store both values only as hosting secrets.
3. Add `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `AUTH_PASSWORD_PEPPER`, and a unique 32+-character `SESSION_SECRET` as hosting secrets. Do not place real values in `.env.example`, source files, or Git.
4. Configure the Google OAuth client with the final HTTPS origin and add only the read-only Sheets scope.

The application creates a signed, `HttpOnly`, `Secure`, `SameSite=Strict` session cookie. API routes reject requests without that session. The password itself is never stored or returned by the application.
