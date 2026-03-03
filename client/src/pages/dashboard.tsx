import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicenses } from "@/hooks/use-licenses";
import { usePlans } from "@/hooks/use-plans";
import { useUsers } from "@/hooks/use-users";
import { Activity, KeyRound, Layers, Users, AlertTriangle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

export default function Dashboard() {
  const { data: licenses = [] } = useLicenses();
  const { data: plans = [] } = usePlans();
  const { data: users = [] } = useUsers();

  const activeLicenses = licenses.filter(l => l.status === "active").length;
  const expiredLicenses = licenses.filter(l => l.status === "expired").length;
  
  // Calculate mock revenue based on active licenses * plan price (assuming 1 month duration for simplicity)
  const estimatedRevenue = licenses
    .filter(l => l.status === "active")
    .reduce((acc, curr) => {
      const plan = plans.find(p => p.id === curr.planId);
      return acc + (plan?.price || 0);
    }, 0) / 100; // cents to dollars

  // Mock chart data - in reality this would come from backend aggregation
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    return {
      date: format(date, "MMM dd"),
      activations: Math.floor(Math.random() * 20) + 5,
      revenue: Math.floor(Math.random() * 500) + 100
    };
  });

  const kpis = [
    { title: "Active Licenses", value: activeLicenses.toLocaleString(), icon: KeyRound, trend: "+12% vs last month", color: "text-primary" },
    { title: "Monthly Revenue", value: `$${estimatedRevenue.toLocaleString()}`, icon: Activity, trend: "+8.2% vs last month", color: "text-green-500" },
    { title: "Total Users", value: users.length.toLocaleString(), icon: Users, trend: "+4 new this week", color: "text-blue-500" },
    { title: "Expired Licenses", value: expiredLicenses.toLocaleString(), icon: AlertTriangle, trend: "Requires attention", color: "text-destructive" },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground">Monitor your license ecosystem and revenue metrics.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {kpis.map((kpi, i) => (
          <motion.div key={i} variants={item}>
            <Card className="card-gradient border-border/40 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <div className={`p-2 rounded-lg bg-background/50 ${kpi.color}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={item} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass-panel border-border/40">
          <CardHeader>
            <CardTitle>Activation Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActivations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="activations" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorActivations)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/40 flex flex-col">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">API Latency</span>
                <span className="font-medium text-green-500">24ms</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[10%]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">License Utilization</span>
                <span className="font-medium">{Math.min(100, Math.round((activeLicenses / 1000) * 100))}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[45%]" />
              </div>
            </div>
            
            <div className="mt-auto p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">New Version Available</h4>
                  <p className="text-xs text-muted-foreground mt-1">Version 2.4 is ready to deploy with advanced reporting features.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
