"use server";
import { signOut } from "@/auth";
import { headers } from "next/headers";

export const logout = async () => {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const locale = pathname.split("/")[1] || "en";
  await signOut({ redirectTo: `/${locale}` });
};
