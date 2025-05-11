import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-bold">Authentication Error</h1>
        <p className="text-gray-600 dark:text-gray-400">
          There was a problem with your authentication request. This might be
          due to an expired link or an invalid token.
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link href="/login">Return to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
