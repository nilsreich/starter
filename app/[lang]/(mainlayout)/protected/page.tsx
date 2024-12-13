import { logout } from "@/actions/Logout";
import { auth } from "@/auth";
import { Uploader } from "@/components/Uploader";

export default async function Dashboard() {
  const session = await auth();

  if (!session) {
    return <div>Not authenticated</div>;
  }

  return (
    <main>
      asd
      <form action={logout}>
        <button type="submit">Logout</button>
      </form>
      <Uploader />
    </main>
  );
}
