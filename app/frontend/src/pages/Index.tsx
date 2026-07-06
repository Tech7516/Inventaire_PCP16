import { useState, useEffect } from "react";
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
import { ClipboardList, MapPin, CalendarClock, ScrollText, Users } from "lucide-react";
import { getAllActiveSessions, getLogEntriesFromDb, type InventoryLogData } from "@/lib/inventory-api";

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

function getLastVerificationDate(logEntries: InventoryLogData[], lotId: string): string | null {
  const entries = logEntries.filter((e) => e.lot_id === lotId);
  if (entries.length === 0) return null;
  entries.sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime());
  return formatDateTimeShort(entries[0].created_at || "");
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
  const [activeSessions, setActiveSessions] = useState<Record<string, { id: number; dps_name: string }>>({});
  const [logEntries, setLogEntries] = useState<InventoryLogData[]>([]);

  const persistLotVariant = (lotId: string, value: string) => {
    setSelectedLotVariants((prev) => {
      const next = { ...prev, [lotId]: value };
      localStorage.setItem("lot-variants", JSON.stringify(next));
      return next;
    });
  };

  // Check for active sessions and log entries on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allSessions, allLogs] = await Promise.all([
          getAllActiveSessions(),
          getLogEntriesFromDb(),
        ]);
        const sessions: Record<string, { id: number; dps_name: string }> = {};
        for (const s of allSessions) {
          if (s.status === "active") {
            sessions[s.lot_id] = { id: s.id, dps_name: s.dps_name };
          }
        }
        setActiveSessions(sessions);
        setLogEntries(allLogs);
      } catch { /* ignore */ }
    };
    loadData();
  }, []);

  const handleStartInventory = (lotId: string) => {
    const activeSession = activeSessions[lotId];
    if (activeSession) {
      localStorage.setItem("active-session-id", String(activeSession.id));
      localStorage.setItem("active-session-dps", activeSession.dps_name);
    } else {
      localStorage.removeItem("active-session-id");
      localStorage.removeItem("active-session-dps");
    }
    const lot = lots.find((l) => l.id === lotId);
    if (lot?.directInventory) {
      navigate(`/inventory/${lotId}/${lotId}`);
    } else {
      navigate(`/lot/${lotId}`);
    }
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
            const activeSession = activeSessions[lot.id];

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
                      {getLastVerificationDate(logEntries, lot.id)
                        ? `Dernière vérification : ${getLastVerificationDate(logEntries, lot.id)}`
                        : "Aucune vérification effectuée"}
                    </span>
                  </div>

                  {activeSession && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                      <Users className="h-4 w-4 shrink-0" />
                      <span>
                        En cours — DPS : {activeSession.dps_name}
                      </span>
                    </div>
                  )}

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
                      variant={activeSession ? "outline" : "default"}
                      disabled={hasVariants && !selectedVariant}
                      onClick={() => handleStartInventory(lot.id)}
                    >
                      {activeSession
                        ? "Rejoindre l'inventaire"
                        : "Démarrer l'inventaire"}
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