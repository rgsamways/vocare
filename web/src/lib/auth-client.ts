import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  basePath: "/api/auth",
  plugins: [magicLinkClient()],
});

export const apiUrl = import.meta.env.VITE_API_URL as string;
