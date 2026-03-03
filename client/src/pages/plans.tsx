import { useState } from "react";
import { motion } from "framer-motion";
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from "@/hooks/use-plans";
import { Plus, Package, Edit, Trash2, DollarSign, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Plans() {
  const { data: plans = [], isLoading } = usePlans();
  const createMutation = useCreatePlan();
  const updateMutation = useUpdatePlan();
  const deleteMutation = useDeletePlan();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialForm = { name: "", price: "", durationDays: "30", features: "" };
  const [formData, setFormData] = useState(initialForm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      price: Number(formData.price) * 100, // to cents
      durationDays: Number(formData.durationDays),
      features: formData.features.split('\n').filter(f => f.trim() !== '')
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload }, {
        onSuccess: () => { setEditingId(null); setFormData(initialForm); }
      });
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => { setIsAddOpen(false); setFormData(initialForm); }
      });
    }
  };

  const openEdit = (plan: any) => {
    setFormData({
      name: plan.name,
      price: (plan.price / 100).toString(),
      durationDays: plan.durationDays.toString(),
      features: (plan.features || []).join('\n')
    });
    setEditingId(plan.id);
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Configure offerings and pricing tiers.</p>
        </div>
        <Dialog open={isAddOpen || !!editingId} onOpenChange={(open) => {
          if(!open) { setIsAddOpen(false); setEditingId(null); setFormData(initialForm); }
          else setIsAddOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Name</label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="number" min="0" step="0.01" className="pl-9" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (Days)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="number" min="1" className="pl-9" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: e.target.value})} required />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Features (One per line)</label>
                <Textarea 
                  rows={4} 
                  placeholder="Unlimited API calls&#10;24/7 Support"
                  value={formData.features}
                  onChange={e => setFormData({...formData, features: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? 'Save Changes' : 'Create Plan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading plans...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={plan.id}>
              <Card className="flex flex-col h-full border-border/40 hover:border-primary/50 hover:shadow-lg transition-all">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(plan)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                        onClick={() => { if(confirm("Delete plan?")) deleteMutation.mutate(plan.id) }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${(plan.price / 100).toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/ {plan.durationDays} days</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {(plan.features as string[] || []).map((feat: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
