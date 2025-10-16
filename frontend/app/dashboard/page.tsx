"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/components/Loading";

export default function DashboardPage() {
  const { data: me, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<any>("/auth/me"),
  });

  if (isLoading) return <Loading />;
  if (error) return <div className="text-red-600">Error: {(error as Error).message}</div>;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Welcome{me?.email ? `, ${me.email}` : ""}</h1>
      <Card>
        <CardHeader><CardTitle>Profile Snapshot</CardTitle></CardHeader>
        <CardContent>
          <p>Your profile snapshot will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
