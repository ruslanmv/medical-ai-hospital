"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAuth() {
  const qc = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<any>("/auth/me"),
    retry: false,
  });

  const logout = async () => {
    try {
      await api.post("/auth/logout", {});
    } finally {
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (typeof window !== "undefined") window.location.href = "/";
    }
  };

  return { user, isLoading, error, logout };
}
