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
import { lots as staticLots } from "@/data/lots";
import { ClipboardList, MapPin, CalendarClock, ScrollText, Users, Settings } from "lucide-react";
import { getAllActiveSessions, getLogEntriesFromDb, type InventoryLogData } from "@/lib/inventory-api";
import { getMergedLots } from "@/lib/configStore";
import type { Lot } from "@/data/lots";
import { useCloudPreferences } from "@/lib/useCloudPreferences";

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
  const { getPref, setPref } = useCloudPreferences();
  const [selectedLotVariants, setSelectedLotVariants] = useState<Record<string, string>>({});
  const [activeSessions, setActiveSessions] = useState<Record<string, Array<{ id: number; dps_name: string; variant_id: string | null; intervention_type: string | null }>>>({});
  const [logEntries, setLogEntries] = useState<InventoryLogData[]>([]);
  const [dynamicLots, setDynamicLots] = useState<Lot[]>(staticLots);

  // Load lot variants from cloud preferences
  useEffect(() => {
    const raw = getPref("lot-variants");
    if (raw) {
      try {
        setSelectedLotVariants(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, [getPref]);

  const persistLotVariant = (lotId: string, value: string) => {
    setSelectedLotVariants((prev) => {
      const next = { ...prev, [lotId]: value };
      setPref("lot-variants", JSON.stringify(next));
      return next;
    });
  };


  // Check for active sessions, log entries, and dynamic lots on mount + polling
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allSessions, allLogs, mergedLots] = await Promise.all([
          getAllActiveSessions(),
          getLogEntriesFromDb(),
          getMergedLots(),
        ]);
        const sessions: Record<string, Array<{ id: number; dps_name: string; variant_id: string | null; intervention_type: string | null }>> = {};
        for (const s of allSessions) {
          if (s.status === "active") {
            if (!sessions[s.lot_id]) sessions[s.lot_id] = [];
            sessions[s.lot_id].push({ id: s.id, dps_name: s.dps_name, variant_id: s.variant_id, intervention_type: s.intervention_type });
          }
        }
        setActiveSessions(sessions);
        setLogEntries(allLogs);
        if (mergedLots.length > 0) setDynamicLots(mergedLots);
      } catch { /* ignore */ }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartInventory = (lotId: string, variantId?: string) => {
    const lot = dynamicLots.find((l) => l.id === lotId);
    const query = variantId ? `?variant=${encodeURIComponent(variantId)}` : "";
    if (lot?.directInventory) {
      navigate(`/inventory/${lotId}/${lotId}${query}`);
    } else {
      navigate(`/lot/${lotId}${query}`);
    }
  };

  const handleJoinSession = (lotId: string, sessionId: number, variantId?: string) => {
    const lot = dynamicLots.find((l) => l.id === lotId);
    const variantQuery = variantId ? `&variant=${encodeURIComponent(variantId)}` : "";
    if (lot?.directInventory) {
      navigate(`/inventory/${lotId}/${lotId}?session=${sessionId}${variantQuery}`);
    } else {
      navigate(`/lot/${lotId}?session=${sessionId}${variantQuery}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                  Gestion des Inventaires
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Sélectionnez un lot pour démarrer l'inventaire
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => navigate("/log")}
                className="cursor-pointer h-9 px-3 sm:h-10 sm:px-4"
              >
                <ScrollText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Journal</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="cursor-pointer h-9 px-3 sm:h-10 sm:px-4"
              >
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Administration</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dynamicLots.map((lot) => {
            const hasVariants = lot.variants && lot.variants.length > 0;
            const selectedVariant = selectedLotVariants[lot.id];
            const showLocation = lot.id === "lot-001";
            const lotSessions = activeSessions[lot.id] || [];
            const activeSession = lotSessions[0];
            const lockedVariantIds = new Set(lotSessions.map(s => s.variant_id).filter(Boolean) as string[]);

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
                          {lot.variants!.map((variant) => {
                            const isLocked = lockedVariantIds.has(variant.id);
                            return (
                              <SelectItem
                                key={variant.id}
                                value={variant.id}
                                className={`cursor-pointer ${isLocked ? "opacity-40 pointer-events-none" : ""}`}
                              >
                                {variant.name}{isLocked ? " (en cours)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                    </div>
                  )}

                  <div className="pt-3 border-t space-y-2">
                    {lotSessions.map((session) => {
                      const vName = lot.variants?.find(v => v.id === session.variant_id)?.name;
                      const prefix = vName ? `Rejoindre ${vName} —` : "Rejoindre —";
                      const label = session.intervention_type === "desinfection"
                        ? `${prefix} Désinfection`
                        : `${prefix} DPS : ${session.dps_name}`;
                      return (
                        <Button
                          key={session.id}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 w-full cursor-pointer rounded-md text-[14px] font-medium text-center bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => handleJoinSession(lot.id, session.id, session.variant_id || undefined)}
                        >
                          <Users className="h-4 w-4 shrink-0" />
                          {label}
                        </Button>
                      );
                    })}
                    <Button
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 w-full cursor-pointer rounded-md text-[14px] font-medium text-center bg-[#002D74FF] hover:bg-primary/90 text-white"
                      disabled={hasVariants && (!selectedVariant || lockedVariantIds.has(selectedVariant))}
                      onClick={() => handleStartInventory(lot.id, selectedVariant)}
                    >
                      <ClipboardList className="h-4 w-4 shrink-0" />
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