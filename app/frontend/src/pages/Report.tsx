import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { lots, lotSubEntities } from "@/data/lots";
import { ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";

interface SavedInventoryEntry {
  itemId: string;
  validated: boolean;
  customQuantity: string;
  itemName: string;
  expectedQuantity: number;
  sectionTitle: string;
}

interface SavedInventory {
  lotId: string;
  subId: string;
  variantId: string | null;
  sacType: string | null;
  entries: SavedInventoryEntry[];
  savedAt: string;
}

const INVENTORY_DATA_KEY = "inventory-data";

export function saveInventoryData(data: SavedInventory) {
  const all = getAllInventoryData();
  const key = `${data.lotId}::${data.subId}::${data.variantId || ""}::${data.sacType || ""}`;
  all[key] = data;
  localStorage.setItem(INVENTORY_DATA_KEY, JSON.stringify(all));
}

export function getAllInventoryData(): Record<string, SavedInventory> {
  try {
    const raw = localStorage.getItem(INVENTORY_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

interface DiscrepancyItem {
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number;
  location: string;
}

function getVariantDisplayName(lotId: string, subId: string, variantId: string | null): string {
  const subs = lotSubEntities[lotId] || [];
  const sub = subs.find((s) => s.id === subId);
  if (!sub) return subId;
  if (variantId) {
    const variantObj = sub.variants?.find((v) => v.id === variantId);
    return variantObj?.name || variantId;
  }
  return sub.name;
}

export default function ReportPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const lot = lots.find((l) => l.id === lotId);
  const allData = getAllInventoryData();

  // Collect all discrepancies for this lot
  const discrepancies: DiscrepancyItem[] = [];

  Object.values(allData).forEach((data) => {
    if (data.lotId !== lotId) return;

    // Build location label
    const subLabel = getVariantDisplayName(data.lotId, data.subId, data.variantId);
    const sacLabel =
      data.sacType === "soin"
        ? "Sac de soin"
        : data.sacType === "o2"
          ? "Sac d'O2"
          : null;

    data.entries.forEach((entry) => {
      if (!entry.validated && entry.customQuantity.trim()) {
        const actual = parseInt(entry.customQuantity, 10);
        if (!isNaN(actual) && actual !== entry.expectedQuantity) {
          const locationParts: string[] = [];
          if (subLabel) locationParts.push(subLabel);
          if (sacLabel) locationParts.push(sacLabel);
          locationParts.push(entry.sectionTitle);

          discrepancies.push({
            itemName: entry.itemName,
            expectedQuantity: entry.expectedQuantity,
            actualQuantity: actual,
            location: locationParts.join(" / "),
          });
        }
      }
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(lotId ? `/lot/${lotId}` : "/")}
              className="cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Rapport d'ecart
                </h1>
                <p className="text-xs text-muted-foreground">
                  {lot?.name || ""}{lot?.location ? ` — ${lot.location}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {discrepancies.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-medium text-foreground">
              Aucun ecart detecte
            </p>
            <p className="text-sm text-muted-foreground">
              Tous les consommables sont conformes aux quantites attendues.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="cursor-pointer"
            >
              Retour a l'accueil
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">
                {discrepancies.length} ecart{discrepancies.length > 1 ? "s" : ""} detecte{discrepancies.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-2">
              {discrepancies.map((item, idx) => (
                <Card key={idx} className="border-amber-200 bg-amber-50/30">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {item.itemName}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.location}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm">
                          <span className="text-amber-600 font-semibold">{item.actualQuantity}</span>
                          <span className="text-muted-foreground"> / {item.expectedQuantity} attendu{item.expectedQuantity > 1 ? "s" : ""}</span>
                        </p>
                        <p className="text-xs text-amber-600 font-medium">
                          Manquant{item.expectedQuantity - item.actualQuantity > 1 ? "s" : ""} : {item.expectedQuantity - item.actualQuantity}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="cursor-pointer"
              >
                Retour a l'accueil
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}