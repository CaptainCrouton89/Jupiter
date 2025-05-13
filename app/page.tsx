import { getServerSession } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { user } = await getServerSession();

  if (user) {
    redirect("/settings");
  } else {
    redirect("/landing");
  }
}
