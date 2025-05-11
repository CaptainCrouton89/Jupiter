import SupabaseConnectionTest from "@/components/SupabaseConnectionTest";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function TestIntegrationPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Integration Test Page</h1>
        <Button asChild variant="outline">
          <Link href="/">Return Home</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Supabase Connection</CardTitle>
              <CardDescription>
                Test the connection to Supabase and database functionality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupabaseConnectionTest />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Authentication Test</CardTitle>
              <CardDescription>
                Test authentication functionality and protected routes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Test protected routes by visiting the private page:</p>
              <Button asChild>
                <Link href="/private">Visit Private Page</Link>
              </Button>
              <p className="text-sm text-gray-500">
                If not logged in, you should be redirected to the login page.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Styles and UI Components Test</CardTitle>
              <CardDescription>
                Verify Tailwind CSS and shadcn/ui components are working
                correctly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <h3 className="font-semibold mb-2">Tailwind Utilities</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      Blue Tag
                    </span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      Green Tag
                    </span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                      Red Tag
                    </span>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                      Yellow Tag
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <h3 className="font-semibold mb-2">UI Components</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="default" size="sm">
                      Default
                    </Button>
                    <Button variant="secondary" size="sm">
                      Secondary
                    </Button>
                    <Button variant="destructive" size="sm">
                      Destructive
                    </Button>
                    <Button variant="outline" size="sm">
                      Outline
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
