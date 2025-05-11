import { TailwindTest } from "@/components/TailwindTest";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Jupiter Email Client</h1>
      <p className="text-xl mb-8">
        An AI-empowered mail client built with Next.js and Supabase
      </p>

      <div className="mt-8">
        <TailwindTest />
      </div>
    </main>
  );
}
