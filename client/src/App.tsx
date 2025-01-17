import { Switch, Route } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Home } from "@/pages/Home";
import { Collection } from "@/pages/Collection";
import { Navbar } from "@/components/Navbar";
import { ArConnectProvider } from "@/components/ArConnectProvider";

function App() {
  return (
    <ArConnectProvider>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/collection" component={Collection} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </ArConnectProvider>
  );
}

// fallback 404 not found page
function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;