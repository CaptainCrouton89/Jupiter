import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/server";
import Link from "next/link";

export default async function PrivatePage() {
  // This will redirect to login if user is not authenticated
  const { user } = await requireAuth();

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Protected Page</h1>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <div className="space-y-2">
          <p>
            <strong>User ID:</strong> {user.id}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Last Sign In:</strong>{" "}
            {new Date(user.last_sign_in_at || "").toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex space-x-4">
        <Button asChild variant="outline">
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  );
}
