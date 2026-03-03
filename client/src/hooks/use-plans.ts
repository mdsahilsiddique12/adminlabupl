import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

type PlanInput = z.infer<typeof api.plans.create.input>;
type PlanUpdate = z.infer<typeof api.plans.update.input>;

export function usePlans() {
  return useQuery({
    queryKey: [api.plans.list.path],
    queryFn: async () => {
      const res = await fetch(api.plans.list.path);
      if (!res.ok) throw new Error("Failed to fetch plans");
      return api.plans.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: PlanInput) => {
      // Coerce price and duration if coming from string inputs
      const coercedData = {
        ...data,
        price: Number(data.price),
        durationDays: Number(data.durationDays)
      };
      const validated = api.plans.create.input.parse(coercedData);
      const res = await fetch(api.plans.create.path, {
        method: api.plans.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return api.plans.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plans.list.path] });
      toast({ title: "Plan created", description: "New subscription plan available." });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & PlanUpdate) => {
      const url = buildUrl(api.plans.update.path, { id });
      const res = await fetch(url, {
        method: api.plans.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update plan");
      return api.plans.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plans.list.path] });
      toast({ title: "Plan updated", description: "Changes saved successfully." });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.plans.delete.path, { id });
      const res = await fetch(url, { method: api.plans.delete.method });
      if (!res.ok) throw new Error("Failed to delete plan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plans.list.path] });
      toast({ title: "Plan deleted" });
    },
  });
}
