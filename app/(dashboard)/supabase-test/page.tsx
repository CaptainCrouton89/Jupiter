import SupabaseConnectionTest from "@/components/SupabaseConnectionTest";

export default function SupabaseTestPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Supabase Connection Test</h1>
      </div>

      <div className="flex justify-center w-full pt-8">
        <SupabaseConnectionTest />
      </div>
    </div>
  );
}
