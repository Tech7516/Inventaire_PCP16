import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lots } from "@/data/lots";
import { getLogEntries } from "@/pages/Log";
import { ClipboardList, MapPin, CalendarClock, ScrollText } from "lucide-react";

function formatDateTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getLastVerificationDate(lotId: string): string | null {
  const entries = getLogEntries().filter((e) => e.lotId === lotId);
  if (entries.length === 0) return null;
  entries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  return formatDateTimeShort(entries[0].completedAt);
}

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
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
            <Button
              variant="outline"
              onClick={() => navigate("/log")}
              className="cursor-pointer"
            >
              <ScrollText className="h-4 w-4 mr-2" />
              Journal
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const hasVariants = lot.variants && lot.variants.length > 0;
            const selectedVariant = selectedLotVariants[lot.id];
            const showLocation = lot.id === "lot-001";

            return (
              <Card
                key={lot.id}
                className="group transition-all duration-200 hover:shadow-md hover:border-primary/30"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {lot.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {showLocation && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{lot.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    <span>
                      {getLastVerificationDate(lot.id)
                        ? `Dernière vérification : ${getLastVerificationDate(lot.id)}`
                        : "Aucune vérification effectuée"}
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
                      onClick={() => {
                        if (lot.directInventory) {
                          navigate(`/inventory/${lot.id}/${lot.id}`);
                        } else {
                          navigate(`/lot/${lot.id}`);
                        }
                      }}
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