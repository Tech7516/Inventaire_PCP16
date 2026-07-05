import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { lots, lotSubEntities } from "@/data/lots";
import { ArrowLeft, ScrollText, Clock, Trash2 } from "lucide-react";

export interface LogEntry {
  lotId: string;
  lotName: string;
  subEntityName: string;
  variantName: string | null;
  sacType: string | null;
  dpsName: string;
  completedAt: string;
  completedKey: string;
}

const LOG_KEY = "inventory-log";

export function getLogEntries(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function addLogEntry(entry: LogEntry) {
  const entries = getLogEntries();
  // Avoid duplicate entries for the same completedKey
  const existingIndex = entries.findIndex((e) => e.completedKey === entry.completedKey);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

export function clearLogEntries() {
  localStorage.removeItem(LOG_KEY);
}

function formatDateTime(iso: string): string {
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

function getLotDisplayName(lotId: string): string {
  const lot = lots.find((l) => l.id === lotId);
  return lot?.name || lotId;
}

function getSubEntityDisplayName(lotId: string, subId: string): string {
  const subs = lotSubEntities[lotId] || [];
  const sub = subs.find((s) => s.id === subId);
  return sub?.name || subId;
}

export default function LogPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    setEntries(getLogEntries());
  }, []);

  const handleClear = () => {
    clearLogEntries();
    setEntries([]);
  };

  // Group entries by lot
  const groupedByLot: Record<string, LogEntry[]> = {};
  entries.forEach((entry) => {
    if (!groupedByLot[entry.lotId]) {
      groupedByLot[entry.lotId] = [];
    }
    groupedByLot[entry.lotId].push(entry);
  });

  // Sort entries within each group by date (newest first)
  Object.keys(groupedByLot).forEach((key) => {
    groupedByLot[key].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  });

  // Sort lots by their most recent entry
  const sortedLotIds = Object.keys(groupedByLot).sort((a, b) => {
    const aLatest = groupedByLot[a][0]?.completedAt || "";
    const bLatest = groupedByLot[b][0]?.completedAt || "";
    return new Date(bLatest).getTime() - new Date(aLatest).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    Journal des inventaires
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Historique des vérifications effectuées
                  </p>
                </div>
              </div>
            </div>
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Effacer le journal
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {entries.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <ScrollText className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-lg text-muted-foreground">
              Aucun inventaire enregistré
            </p>
            <p className="text-sm text-muted-foreground">
              Les vérifications complétées apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedLotIds.map((lotId) => {
              const lotEntries = groupedByLot[lotId];
              const lotName = lotEntries[0]?.lotName || getLotDisplayName(lotId);

              return (
                <div key={lotId}>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    {lotName}
                  </h2>
                  <div className="space-y-2">
                    {lotEntries.map((entry, idx) => {
                      const subLabel = entry.subEntityName;
                      const variantLabel = entry.variantName;
                      const sacLabel =
                        entry.sacType === "soin"
                          ? "Sac de soin"
                          : entry.sacType === "o2"
                            ? "Sac d'O2"
                            : null;

                      const detailParts = [subLabel];
                      if (variantLabel) detailParts.push(variantLabel);
                      if (sacLabel) detailParts.push(sacLabel);
                      const detailLine = detailParts.join(" — ");

                      return (
                        <Card key={idx} className="transition-all">
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">
                                  {detailLine}
                                </p>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span>
                                    DPS : {entry.dpsName || "—"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatDateTime(entry.completedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}