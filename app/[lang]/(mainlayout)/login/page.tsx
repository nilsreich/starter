import { getDictionary, Dictionaries } from "@/lib/getDictionaries";
import { login } from "@/actions/Login";

export default async function Login({
  params,
}: {
  params: { lang: Dictionaries };
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto max-w-2xl">
      <form action={login}>
        <button type="submit">{dict.products.cart}</button>
      </form>
    </div>
  );
}
