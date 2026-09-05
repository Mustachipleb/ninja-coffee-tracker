/**
 * Minimum password length, enforced both server-side (in `auth.server.ts`
 * consumers like `routes/account.tsx` and `routes/users.tsx`) and as a client
 * `minLength` hint on the password inputs. Lives outside any `*.server.ts`
 * module so it can be safely imported from client-rendered route components
 * without pulling server-only dependencies (e.g. `argon2`) into the client
 * bundle.
 */
export const MIN_PASSWORD_LENGTH = 8;
