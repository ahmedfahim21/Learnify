"use client";

import { createAuthClient } from "better-auth/react";

/** Browser-side auth: `signIn.social`, `signOut`, `useSession`. */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
