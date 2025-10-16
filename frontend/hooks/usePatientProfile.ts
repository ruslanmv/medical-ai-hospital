"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function usePatientProfile() {
  return useQuery({
    queryKey: ["patientProfile"],
    queryFn: () => api.get<any>("/me/patient"),
    retry: false,
  });
}
