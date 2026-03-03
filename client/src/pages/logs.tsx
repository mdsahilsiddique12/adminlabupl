import { useActivityLogs } from "@/hooks/use-activity-logs";
import { format } from "date-fns";
import { Terminal } from "lucide-react";

export default function Logs() {
  const { data: logs = [], isLoading } = useActivityLogs();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">System-wide activity monitoring.</p>
      </div>

      <div className="bg-[#0A0A0A] dark:bg-black rounded-xl border border-border/50 overflow-hidden font-mono text-sm shadow-inner">
        <div className="p-3 border-b border-white/10 bg-white/5 flex items-center gap-2 text-muted-foreground">
          <Terminal className="w-4 h-4" />
          <span>system_events.log</span>
        </div>
        <div className="p-4 h-[600px] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-muted-foreground">Loading streams...</div>
          ) : logs.length === 0 ? (
            <div className="text-muted-foreground">No events recorded.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row gap-2 sm:gap-4 hover:bg-white/5 p-1 rounded transition-colors">
                <span className="text-green-500/80 shrink-0">
                  [{log.createdAt ? format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss') : ''}]
                </span>
                <span className="text-blue-400 shrink-0 w-32 uppercase truncate">
                  {log.action}
                </span>
                <span className="text-gray-300">
                  {log.details || 'No details provided'}
                  <span className="text-gray-500 ml-2">({log.userId})</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
