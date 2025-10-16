"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Loading from "@/components/Loading";

export default function ProfilePage() {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["patientProfile"],
    queryFn: () => api.get<any>("/me/patient"),
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      <pre className="rounded-2xl border bg-white p-6 overflow-auto text-sm">
        {isLoading ? <Loading /> : JSON.stringify(profile, null, 2)}
      </pre>
    </div>
  );
}
