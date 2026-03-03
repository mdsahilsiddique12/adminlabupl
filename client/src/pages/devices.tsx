import { useDevices } from "@/hooks/use-devices";
import { format } from "date-fns";
import { MonitorSmartphone, Globe, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Devices() {
  const { data: devices = [], isLoading } = useDevices();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Authorized Devices</h1>
        <p className="text-muted-foreground">Track hardware fingerprints accessing licenses.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading devices...</div>
        ) : devices.length === 0 ? (
           <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">No active devices found.</div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="bg-card p-5 rounded-xl border border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <MonitorSmartphone className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-sm font-semibold">{device.fingerprint}</h3>
                    <Badge variant="secondary" className="text-[10px]">HWID</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {device.ipAddress || 'Unknown IP'}</span>
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> ID: {device.id.split('-')[0]}</span>
                  </div>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-muted-foreground mb-1">Last Seen</div>
                <div className="font-medium text-foreground">
                  {device.lastSeen ? format(new Date(device.lastSeen), 'MMM dd, yyyy HH:mm') : 'Never'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
