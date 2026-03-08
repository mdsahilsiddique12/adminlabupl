import { useState } from "react";
import { format } from "date-fns";
import { Globe, Hash, MonitorSmartphone } from "lucide-react";
import { useDevices, useUpdateDevice } from "@/hooks/use-devices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium break-all">{value || "N/A"}</div>
    </div>
  );
}

export default function Devices() {
  const { data: devices = [], isLoading } = useDevices();
  const updateDevice = useUpdateDevice();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const selected = devices.find((d) => d.id === selectedDeviceId) ?? null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Authorized Devices</h1>
        <p className="text-muted-foreground">Track hardware fingerprints accessing licenses.</p>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedDeviceId(null)}>
        <DialogContent className="sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>Device Details</DialogTitle>
          </DialogHeader>

          {selected ? (
            <Tabs defaultValue="identity" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="hardware">Hardware</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="identity" className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="Owner Name" value={selected.ownerName} />
                <Field label="Owner Email" value={selected.ownerEmail} />
                <Field label="Lab Region" value={selected.labRegion} />
                <Field label="System Name" value={selected.systemName} />
                <Field label="Fingerprint" value={selected.fingerprint} />
                <Field label="Device ID" value={selected.id} />
              </TabsContent>

              <TabsContent value="hardware" className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="Disk ID" value={selected.diskId} />
                <Field label="Motherboard ID" value={selected.motherboardId} />
                <Field label="CPU ID" value={selected.cpuId} />
                <Field label="MAC Address" value={selected.macAddress} />
              </TabsContent>

              <TabsContent value="network" className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="IP Address" value={selected.ipAddress} />
                <Field label="OS Version" value={selected.osVersion} />
                <Field label="User Agent" value={selected.userAgent} />
              </TabsContent>

              <TabsContent value="activity" className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field
                  label="First Seen"
                  value={selected.firstSeen ? format(new Date(selected.firstSeen), "MMM dd, yyyy HH:mm") : "N/A"}
                />
                <Field
                  label="Last Seen"
                  value={selected.lastSeen ? format(new Date(selected.lastSeen), "MMM dd, yyyy HH:mm") : "N/A"}
                />
                <Field label="Approval Status" value={selected.isActive ? "Approved" : "Pending"} />
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">No active devices found.</div>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className="bg-card p-5 rounded-xl border border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-shadow"
            >
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
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {device.ipAddress || "Unknown IP"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" /> ID: {device.id.split("-")[0]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right text-sm">
                <div className="text-muted-foreground mb-1">Last Seen</div>
                <div className="font-medium text-foreground">
                  {device.lastSeen ? format(new Date(device.lastSeen), "MMM dd, yyyy HH:mm") : "Never"}
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Badge variant={device.isActive ? "default" : "secondary"}>
                    {device.isActive ? "Approved" : "Pending"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateDevice.mutate({ id: device.id, isActive: !device.isActive })}
                    disabled={updateDevice.isPending}
                  >
                    {device.isActive ? "Block" : "Approve"}
                  </Button>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedDeviceId(device.id)}>
                      Details
                    </Button>
                  </DialogTrigger>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
