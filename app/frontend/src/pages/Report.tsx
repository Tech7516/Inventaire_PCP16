import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { lots, lotSubEntities } from "@/data/lots";
import { ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList, Download } from "lucide-react";

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

export default function ReportPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const lot = lots.find((l) => l.id === lotId);
  const allData = getAllInventoryData();

  // Collect all discrepancies for this lot
  const discrepancies: DiscrepancyItem[] = [];
  // Also collect all saved data for this lot for the summary
  const lotInventoryData: SavedInventory[] = [];

  Object.values(allData).forEach((data) => {
    if (data.lotId !== lotId) return;
    lotInventoryData.push(data);

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

  const handleDownload = () => {
    const dpsName = localStorage.getItem("dps-name") || "";
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════");
    lines.push(`  RAPPORT D'ÉCART — ${lot?.name || ""}${lot?.location ? ` — ${lot.location}` : ""}`);
    lines.push(`  Date : ${dateStr} à ${timeStr}`);
    if (dpsName) lines.push(`  DPS : ${dpsName}`);
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("");

    if (discrepancies.length === 0) {
      lines.push("✅ Aucun écart détecté.");
      lines.push("Tous les consommables sont conformes aux quantités attendues.");
    } else {
      lines.push(`⚠️  ${discrepancies.length} écart${discrepancies.length > 1 ? "s" : ""} détecté${discrepancies.length > 1 ? "s" : ""} :`);
      lines.push("");
      lines.push("───────────────────────────────────────────────────────");
      discrepancies.forEach((item, idx) => {
        const missing = item.expectedQuantity - item.actualQuantity;
        lines.push(`${idx + 1}. ${item.itemName}`);
        lines.push(`   Emplacement : ${item.location}`);
        lines.push(`   Quantité attendue : ${item.expectedQuantity}`);
        lines.push(`   Quantité réelle  : ${item.actualQuantity}`);
        lines.push(`   Manquant${missing > 1 ? "s" : ""} : ${missing}`);
        lines.push("───────────────────────────────────────────────────────");
      });
    }

    lines.push("");
    lines.push("───────────────────────────────────────────────────────");
    lines.push("  DÉTAIL COMPLET DE L'INVENTAIRE");
    lines.push("───────────────────────────────────────────────────────");

    lotInventoryData.forEach((data) => {
      const subLabel = getVariantDisplayName(data.lotId, data.subId, data.variantId);
      const sacLabel =
        data.sacType === "soin"
          ? "Sac de soin"
          : data.sacType === "o2"
            ? "Sac d'O2"
            : null;
      const header = [subLabel, sacLabel].filter(Boolean).join(" / ");

      lines.push("");
      lines.push(`  ▸ ${header}  (${formatDateTime(data.savedAt)})`);
      lines.push("");

      // Group by section
      const bySection: Record<string, SavedInventoryEntry[]> = {};
      data.entries.forEach((entry) => {
        if (!bySection[entry.sectionTitle]) bySection[entry.sectionTitle] = [];
        bySection[entry.sectionTitle].push(entry);
      });

      Object.entries(bySection).forEach(([sectionTitle, entries]) => {
        lines.push(`    [${sectionTitle}]`);
        entries.forEach((entry) => {
          if (entry.validated) {
            lines.push(`      ✅ ${entry.itemName} : ${entry.expectedQuantity} (conforme)`);
          } else if (entry.customQuantity.trim()) {
            const actual = parseInt(entry.customQuantity, 10);
            const isDiscrepancy = !isNaN(actual) && actual !== entry.expectedQuantity;
            const icon = isDiscrepancy ? "❌" : "✅";
            const suffix = isDiscrepancy ? ` (écart : ${actual}/${entry.expectedQuantity})` : ` (${actual}, conforme)`;
            lines.push(`      ${icon} ${entry.itemName} :${suffix}`);
          } else {
            lines.push(`      ⬜ ${entry.itemName} : ${entry.expectedQuantity} (non traité)`);
          }
        });
      });
    });

    lines.push("");
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("  Fin du rapport");
    lines.push("═══════════════════════════════════════════════════════");

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (lot?.name || "rapport").replace(/\s+/g, "-").toLowerCase();
    a.download = `rapport-ecart-${safeName}-${dateStr.replace(/\//g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
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
                    Rapport d'écart
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {lot?.name || ""}{lot?.location ? ` — ${lot.location}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="cursor-pointer"
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {discrepancies.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-medium text-foreground">
              Aucun écart détecté
            </p>
            <p className="text-sm text-muted-foreground">
              Tous les consommables sont conformes aux quantités attendues.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="cursor-pointer"
            >
              Retour à l'accueil
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">
                {discrepancies.length} écart{discrepancies.length > 1 ? "s" : ""} détecté{discrepancies.length > 1 ? "s" : ""}
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
                Retour à l'accueil
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}