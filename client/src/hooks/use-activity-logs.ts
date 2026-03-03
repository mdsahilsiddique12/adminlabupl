import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useActivityLogs() {
  return useQuery({
    queryKey: [api.activityLogs.list.path],
    queryFn: async () => {
      const res = await fetch(api.activityLogs.list.path);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return api.activityLogs.list.responses[200].parse(await res.json());
    },
  });
}
