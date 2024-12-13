import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },

  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub || "";
      return session;
    },
  },
  ...authConfig,
});
