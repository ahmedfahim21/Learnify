"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/** Browser-side auth against the Neon-hosted auth server, proxied through
 *  /api/auth/*. Same Better Auth client surface as before: `signIn.social`,
 *  `signOut`, `useSession`. */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
