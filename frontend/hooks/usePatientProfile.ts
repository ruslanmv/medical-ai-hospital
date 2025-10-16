'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePatientProfile() {
  return useQuery({
    queryKey: ['patient-profile'],
    queryFn: async () => {
      const res = await api.get('/me/patient');
      if (!res.ok) return null;
      return res.json();
    },
  });
}
