import { useState } from "react";
import { motion } from "framer-motion";
import { useLicenses, useCreateLicense, useDeleteLicense, useUpdateLicense } from "@/hooks/use-licenses";
import { usePlans } from "@/hooks/use-plans";
import { useUsers } from "@/hooks/use-users";
import { useDevices } from "@/hooks/use-devices";
import { format } from "date-fns";
import { Plus, Search, MoreHorizontal, Trash2, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Licenses() {
  const { data: licenses = [], isLoading } = useLicenses();
  const { data: plans = [] } = usePlans();
  const { data: users = [] } = useUsers();
  const { data: devices = [] } = useDevices();
  
  const createMutation = useCreateLicense();
  const deleteMutation = useDeleteLicense();
  const updateMutation = useUpdateLicense();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    planId: "",
    userId: "",
    deviceId: "",
    status: "pending",
    transactionId: "",
    paymentMode: "manual_transfer",
    paymentVerified: false
  });

  const filtered = licenses.filter(l => 
    l.licenseKey.toLowerCase().includes(search.toLowerCase()) ||
    l.status.toLowerCase().includes(search.toLowerCase())
  );
  const selectedPlan = plans.find(p => p.id === formData.planId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.planId || !formData.deviceId) {
      toast({
        title: "Missing fields",
        description: "Plan and Device are required.",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate({
      licenseKey: "",
      ...formData,
      deviceId: formData.deviceId || null,
      userId: formData.userId || null
    }, {
      onSuccess: () => {
        setIsAddOpen(false);
        setFormData({
          planId: "",
          userId: "",
          deviceId: "",
          status: "pending",
          transactionId: "",
          paymentMode: "manual_transfer",
          paymentVerified: false
        });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'expired': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'suspended': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Licenses</h1>
          <p className="text-muted-foreground">Manage keys, assignments, and statuses.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Generate Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] border-border/50 glass-panel">
            <DialogHeader>
              <DialogTitle>Generate New License</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Plan</label>
                <Select value={formData.planId} onValueChange={v => setFormData({...formData, planId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedPlan ? (
                  <p className="text-xs text-muted-foreground">
                    Validity: {selectedPlan.durationDays} day{selectedPlan.durationDays === 1 ? "" : "s"} (from selected plan)
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign User (Optional)</label>
                <Select value={formData.userId} onValueChange={v => setFormData({...formData, userId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bind Device</label>
                <Select value={formData.deviceId} onValueChange={v => setFormData({...formData, deviceId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select device..." /></SelectTrigger>
                  <SelectContent>
                    {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.systemName || d.fingerprint}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction ID</label>
                <Input
                  value={formData.transactionId}
                  onChange={e => setFormData({...formData, transactionId: e.target.value})}
                  placeholder="Bank/UPI transaction reference"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Mode</label>
                <Select value={formData.paymentMode} onValueChange={v => setFormData({...formData, paymentMode: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual_transfer">Manual Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_deposit">Bank Deposit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.paymentVerified}
                  onChange={(e) => setFormData({ ...formData, paymentVerified: e.target.checked })}
                />
                Payment verified
              </label>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || !formData.planId || !formData.deviceId}
              >
                {createMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40 bg-muted/10 flex justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search licenses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/50 focus-visible:ring-1" 
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/40">
              <tr>
                <th className="px-6 py-4 font-medium">License Key</th>
                <th className="px-6 py-4 font-medium">Plan & User</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Dates</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading licenses...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No licenses found.</td></tr>
              ) : (
                filtered.map((license) => {
                  const plan = plans.find(p => p.id === license.planId);
                  const user = users.find(u => u.id === license.userId);
                  
                  return (
                    <motion.tr 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      key={license.id} 
                      className="hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          <span className="font-mono bg-muted px-2 py-1 rounded text-foreground">{license.licenseKey.substring(0,16)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{plan?.name || 'Unassigned'}</div>
                        <div className="text-xs text-muted-foreground">
                          {user?.username || 'No user'} | {license.paymentVerified ? "Paid" : "Payment Pending"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={getStatusColor(license.status)}>
                          {license.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                          <Clock className="w-3 h-3" /> 
                          Created: {license.createdAt ? format(new Date(license.createdAt), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          Validity: {plan?.durationDays ? `${plan.durationDays} day${plan.durationDays === 1 ? "" : "s"}` : "N/A"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last Date of Use: {license.expiresAt ? format(new Date(license.expiresAt), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: license.id, status: license.status === 'active' ? 'suspended' : 'active'})}>
                              Toggle Status
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onClick={() => {
                                if(confirm("Are you sure?")) deleteMutation.mutate(license.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
