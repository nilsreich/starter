import { Dictionaries } from "@/lib/getDictionaries";
import Link from "next/link";

export default async function Home({
  params,
}: {
  params: { lang: Dictionaries };
}) {
  const { lang } = await params;
  return (
    <div className=" font-[family-name:var(--font-geist-sans)] mx-auto max-w-xl p-4">
      <Link href="/[lang]/login" as={`/${lang}/login`}>
        login
      </Link>
      <div>asd</div>
    </div>
  );
}
