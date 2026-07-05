import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lots } from "@/data/lots";
import { ClipboardList, MapPin, CalendarClock } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedLotVariants, setSelectedLotVariants] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("lot-variants");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  const persistLotVariant = (lotId: string, value: string) => {
    setSelectedLotVariants((prev) => {
      const next = { ...prev, [lotId]: value };
      localStorage.setItem("lot-variants", JSON.stringify(next));
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">À faire</Badge>;
      case "in-progress":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">En cours</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Terminé</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Gestion des Inventaires
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sélectionnez un lot pour démarrer l'inventaire
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const hasVariants = lot.variants && lot.variants.length > 0;
            const selectedVariant = selectedLotVariants[lot.id];

            return (
              <Card
                key={lot.id}
                className="group transition-all duration-200 hover:shadow-md hover:border-primary/30"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {lot.name}
                    </CardTitle>
                    {getStatusBadge(lot.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{lot.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    <span>
                      {lot.lastInventory
                        ? `Dernier inventaire : ${lot.lastInventory}`
                        : "Aucun inventaire effectué"}
                    </span>
                  </div>

                  {hasVariants && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">
                        Choix du {lot.name} :
                      </label>
                      <Select
                        value={selectedVariant || ""}
                        onValueChange={(value) => persistLotVariant(lot.id, value)}
                      >
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder={`Choisir un ${lot.name}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {lot.variants!.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id} className="cursor-pointer">
                              {variant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <Button
                      className="w-full cursor-pointer"
                      variant="default"
                      disabled={hasVariants && !selectedVariant}
                      onClick={() => navigate(`/lot/${lot.id}`)}
                    >
                      Démarrer l'inventaire
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}