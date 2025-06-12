import { createAuthClient } from "better-auth/react";
import { passkeyClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_URL,
	plugins: [passkeyClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
