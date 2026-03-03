import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

type LicenseInput = z.infer<typeof api.licenses.create.input>;
type LicenseUpdate = z.infer<typeof api.licenses.update.input>;

export function useLicenses() {
  return useQuery({
    queryKey: [api.licenses.list.path],
    queryFn: async () => {
      const res = await fetch(api.licenses.list.path);
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return api.licenses.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateLicense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: LicenseInput) => {
      const validated = api.licenses.create.input.parse(data);
      const res = await fetch(api.licenses.create.path, {
        method: api.licenses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create license");
      return api.licenses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.licenses.list.path] });
      toast({ title: "License created", description: "The new license has been generated." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
}

export function useUpdateLicense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & LicenseUpdate) => {
      const validated = api.licenses.update.input.parse(data);
      const url = buildUrl(api.licenses.update.path, { id });
      const res = await fetch(url, {
        method: api.licenses.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to update license");
      return api.licenses.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.licenses.list.path] });
      toast({ title: "License updated", description: "Changes have been saved." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
}

export function useDeleteLicense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.licenses.delete.path, { id });
      const res = await fetch(url, { method: api.licenses.delete.method });
      if (!res.ok) throw new Error("Failed to delete license");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.licenses.list.path] });
      toast({ title: "License deleted", description: "The license has been removed." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
}
