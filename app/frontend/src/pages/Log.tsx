import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScrollText, Clock, Trash2, FileText, Loader2 } from "lucide-react";
import {
  getLogEntriesFromDb,
  clearLogEntriesFromDb,
  type InventoryLogData,
} from "@/lib/inventory-api";

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

export default function LogPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<InventoryLogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getLogEntriesFromDb();
      setEntries(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleClear = async () => {
    await clearLogEntriesFromDb();
    setEntries([]);
  };

  // Group entries by lot
  const groupedByLot: Record<string, InventoryLogData[]> = {};
  entries.forEach((entry) => {
    if (!groupedByLot[entry.lot_id]) {
      groupedByLot[entry.lot_id] = [];
    }
    groupedByLot[entry.lot_id].push(entry);
  });

  // Sort entries within each group by date (newest first)
  Object.keys(groupedByLot).forEach((key) => {
    groupedByLot[key].sort(
      (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );
  });

  // Sort lots by their most recent entry
  const sortedLotIds = Object.keys(groupedByLot).sort((a, b) => {
    const aLatest = groupedByLot[a][0]?.created_at || "";
    const bLatest = groupedByLot[b][0]?.created_at || "";
    return new Date(bLatest).getTime() - new Date(aLatest).getTime();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
              const lotName = lotEntries[0]?.lot_name || lotId;

              return (
                <div key={lotId}>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    {lotName}
                  </h2>
                  <div className="space-y-2">
                    {lotEntries.map((entry) => {
                      const subLabel = entry.sub_entity_name;
                      const variantLabel = entry.variant_name;
                      const sacLabel =
                        entry.sac_type === "soin"
                          ? "Sac de soin"
                          : entry.sac_type === "o2"
                            ? "Sac d'O2"
                            : null;

                      const detailParts = [subLabel];
                      if (variantLabel) detailParts.push(variantLabel);
                      if (sacLabel) detailParts.push(sacLabel);
                      const detailLine = detailParts.join(" — ");

                      return (
                        <Card key={entry.id} className="transition-all">
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">
                                  {detailLine}
                                </p>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span>
                                    DPS : {entry.dps_name || "—"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatDateTime(entry.created_at || "")}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/report/${entry.lot_id}`)}
                                className="cursor-pointer shrink-0"
                              >
                                <FileText className="h-4 w-4 mr-1.5" />
                                Rapport
                              </Button>
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