import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./components/theme-provider";
import { Layout } from "./components/layout";
import { useAuth } from "./hooks/use-auth";
import { useEffect } from "react";

// Pages
import NotFound from "@/pages/not-found";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Licenses from "./pages/licenses";
import Plans from "./pages/plans";
import Users from "./pages/users";
import Devices from "./pages/devices";
import Logs from "./pages/logs";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return null; // Handled by layout spinner
  if (!user) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes wrapped in Layout */}
      <Route path="/">
        <Layout><ProtectedRoute component={Dashboard} /></Layout>
      </Route>
      <Route path="/licenses">
        <Layout><ProtectedRoute component={Licenses} /></Layout>
      </Route>
      <Route path="/plans">
        <Layout><ProtectedRoute component={Plans} /></Layout>
      </Route>
      <Route path="/users">
        <Layout><ProtectedRoute component={Users} /></Layout>
      </Route>
      <Route path="/devices">
        <Layout><ProtectedRoute component={Devices} /></Layout>
      </Route>
      <Route path="/logs">
        <Layout><ProtectedRoute component={Logs} /></Layout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
