import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { lots, lotSubEntities } from "@/data/lots";
import { ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList, Download, Loader2 } from "lucide-react";
import {
  getDiscrepancyReportsForLot,
  type DiscrepancyReportData,
  type DiscrepancyItem,
  type SavedInventoryEntry,
  type SavedInventory,
} from "@/lib/inventory-api";

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

  const [loading, setLoading] = useState(true);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [lotInventoryData, setLotInventoryData] = useState<SavedInventory[]>([]);
  const [reportDate, setReportDate] = useState<string>("");
  const [dpsName, setDpsName] = useState<string>("");
  const [variantName, setVariantName] = useState<string>("");

  useEffect(() => {
    const loadReports = async () => {
      if (!lotId) {
        setLoading(false);
        return;
      }
      try {
        const reports = await getDiscrepancyReportsForLot(lotId);

        // Collect all discrepancies and full inventory from all reports for this lot
        const allDiscrepancies: DiscrepancyItem[] = [];
        const allInventory: SavedInventory[] = [];
        let latestDate = "";
        let latestDpsName = "";
        let latestVariantName = "";

        for (const report of reports) {
          // Parse discrepancies
          if (report.discrepancies_json) {
            try {
              const items: DiscrepancyItem[] = JSON.parse(report.discrepancies_json);
              allDiscrepancies.push(...items);
            } catch { /* ignore parse errors */ }
          }

          // Parse full inventory
          if (report.full_inventory_json) {
            try {
              const inventories: SavedInventory[] = JSON.parse(report.full_inventory_json);
              allInventory.push(...inventories);
            } catch { /* ignore parse errors */ }
          }

          // Track latest report date, dps_name, variant_name
          const date = report.updated_at || report.created_at || "";
          if (date > latestDate) {
            latestDate = date;
            latestDpsName = report.dps_name || "";
            latestVariantName = report.variant_name || "";
          }
        }

        setDiscrepancies(allDiscrepancies);
        setLotInventoryData(allInventory);
        setReportDate(latestDate);
        setDpsName(latestDpsName);
        setVariantName(latestVariantName);
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    loadReports();
  }, [lotId]);

  const handleDownload = () => {
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
    lines.push(`  RAPPORT D'ÉCART — ${lot?.name || ""}${lot?.location ? ` — ${lot.location}` : ""}${variantName ? ` — ${variantName}` : ""}`);
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
        const diff = item.actualQuantity - item.expectedQuantity;
        const absDiff = Math.abs(diff);
        const isSurplus = diff > 0;
        lines.push(`${idx + 1}. ${item.itemName}`);
        lines.push(`   Emplacement : ${item.location}`);
        lines.push(`   Quantité attendue : ${item.expectedQuantity}`);
        lines.push(`   Quantité réelle  : ${item.actualQuantity}`);
        lines.push(`   ${isSurplus ? `Excédent : +${absDiff}` : `Manque : ${absDiff}`}`);
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
      const headerParts: string[] = [];
      if (data.lotVariantName) headerParts.push(data.lotVariantName);
      if (subLabel) headerParts.push(subLabel);
      if (sacLabel) headerParts.push(sacLabel);
      const header = headerParts.join(" / ");
      const dpsInfo = data.dpsName ? ` — DPS : ${data.dpsName}` : "";

      lines.push("");
      lines.push(`  ▸ ${header}${dpsInfo}  (${formatDateTime(data.savedAt)})`);
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
            if (isDiscrepancy) {
              const diff = actual - entry.expectedQuantity;
              const absDiff = Math.abs(diff);
              const label = diff > 0 ? `Excédent : +${absDiff}` : `Manque : ${absDiff}`;
              lines.push(`      ❌ ${entry.itemName} : ${actual}/${entry.expectedQuantity} (${label})`);
            } else {
              lines.push(`      ✅ ${entry.itemName} : ${actual} (conforme)`);
            }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    {variantName && ` · ${variantName}`}
                    {dpsName && ` · DPS : ${dpsName}`}
                    {reportDate && ` · ${formatDateTime(reportDate)}`}
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
              {discrepancies.map((item, idx) => {
                const diff = item.actualQuantity - item.expectedQuantity;
                const isSurplus = diff > 0;
                const absDiff = Math.abs(diff);

                return (
                  <Card
                    key={idx}
                    className={
                      isSurplus
                        ? "border-blue-200 bg-blue-50/30"
                        : "border-amber-200 bg-amber-50/30"
                    }
                  >
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
                            <span
                              className={
                                isSurplus
                                  ? "text-blue-600 font-semibold"
                                  : "text-amber-600 font-semibold"
                              }
                            >
                              {item.actualQuantity}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}/ {item.expectedQuantity} attendu{item.expectedQuantity > 1 ? "s" : ""}
                            </span>
                          </p>
                          <p
                            className={
                              isSurplus
                                ? "text-xs text-blue-600 font-medium"
                                : "text-xs text-amber-600 font-medium"
                            }
                          >
                            {isSurplus
                              ? `Excédent : +${absDiff}`
                              : `Manque : ${absDiff}`
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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