"use server";
import { signIn } from "@/auth";
import { headers } from "next/headers";

export const login = async () => {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const locale = pathname.split("/")[1] || "en";
  await signIn("github", { redirectTo: `/${locale}/protected` });
};
