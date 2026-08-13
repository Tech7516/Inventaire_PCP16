import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { lots, lotSubEntities } from "@/data/lots";
import { ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList, Download, Loader2, Pencil, Save } from "lucide-react";
import {
  getDiscrepancyReportsForLot,
  getDiscrepancyReportByKey,
  saveDiscrepancyReportToDb,
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

// Map report_key to a display label
function getReportLabel(reportKey: string): string {
  const map: Record<string, string> = {
    "vps-auteuil-central": "VPS Auteuil",
    "vps-neuilly-central": "VPS Neuilly",
    "lot-a-central": "Lot A",
    "lot-c-alpha-central": "Lot C Alpha",
    "lot-c-bravo-central": "Lot C Bravo",
    "lot-cai-central": "Lot CAI",
  };
  if (map[reportKey]) return map[reportKey];
  // Lot B variants
  if (reportKey.startsWith("lot-b::")) {
    const variant = reportKey.replace("lot-b::", "");
    const capitalized = variant.charAt(0).toUpperCase() + variant.slice(1);
    return `Lot B ${capitalized}`;
  }
  // Lot V variants
  if (reportKey.startsWith("lot-v::")) {
    const variant = reportKey.replace("lot-v::", "");
    if (variant === "vl-poussin") return "VL Poussin";
    if (variant === "vtp-passy") return "VTP Passy";
    return variant;
  }
  return reportKey;
}

export default function ReportPage() {
  const { lotId, reportKey } = useParams<{ lotId?: string; reportKey?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromLog = searchParams.get("from") === "log";
  const isEditMode = searchParams.get("mode") === "edit";

  const lot = lotId ? lots.find((l) => l.id === lotId) : null;

  const [loading, setLoading] = useState(true);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [lotInventoryData, setLotInventoryData] = useState<SavedInventory[]>([]);
  const [reportDate, setReportDate] = useState<string>("");
  const [dpsName, setDpsName] = useState<string>("");
  const [variantName, setVariantName] = useState<string>("");
  const [displayLabel, setDisplayLabel] = useState<string>("");
  const [currentReportKey, setCurrentReportKey] = useState<string>("");
  const [currentLotId, setCurrentLotId] = useState<string>("");
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  const [currentLotName, setCurrentLotName] = useState<string>("");
  const [currentVariantName, setCurrentVariantName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);

      let reports: DiscrepancyReportData[] = [];

      if (reportKey) {
        // Load by report_key
        const report = await getDiscrepancyReportByKey(decodeURIComponent(reportKey));
        if (report) reports = [report];
        setDisplayLabel(getReportLabel(decodeURIComponent(reportKey)));
      } else if (lotId) {
        // Load by lotId (legacy route)
        reports = await getDiscrepancyReportsForLot(lotId);
        setDisplayLabel(lot?.name || "");
      }

      // Collect all discrepancies and full inventory from all reports
      const allDiscrepancies: DiscrepancyItem[] = [];
      const allInventory: SavedInventory[] = [];
      let latestDate = "";
      let latestDpsName = "";
      let latestVariantName = "";

      for (const report of reports) {
        if (report.discrepancies_json) {
          try {
            const items: DiscrepancyItem[] = JSON.parse(report.discrepancies_json);
            allDiscrepancies.push(...items);
          } catch { /* ignore parse errors */ }
        }

        if (report.full_inventory_json) {
          try {
            const inventories: SavedInventory[] = JSON.parse(report.full_inventory_json);
            allInventory.push(...inventories);
          } catch { /* ignore parse errors */ }
        }

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

      // Capture report metadata for edit mode
      if (reports.length > 0) {
        const r = reports[0];
        setCurrentReportKey(r.report_key);
        setCurrentLotId(r.lot_id);
        setCurrentVariantId(r.variant_id);
        setCurrentLotName(r.lot_name);
        setCurrentVariantName(r.variant_name);
      }

      setLoading(false);
    };
    loadReports();
  }, [lotId, reportKey]);

  // Edit mode: update a discrepancy's actual quantity
  const handleEditQuantity = (idx: number, newQty: number) => {
    setDiscrepancies((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], actualQuantity: newQty };
      return updated;
    });
  };

  // Save edited report back to DB
  const handleSave = async () => {
    if (!currentReportKey || !currentLotId) return;
    setSaving(true);
    try {
      // Recalculate discrepancies from edited data
      const hasDiscrepancies = discrepancies.length > 0;
      await saveDiscrepancyReportToDb({
        lotId: currentLotId,
        variantId: currentVariantId,
        lotName: currentLotName,
        variantName: currentVariantName,
        dpsName: dpsName,
        discrepancies: discrepancies,
        fullInventory: lotInventoryData,
        hasDiscrepancies: hasDiscrepancies,
        reportKeyOverride: currentReportKey,
      });
      // Navigate back to log after save
      navigate("/log");
    } catch (e) {
      console.error("Failed to save report:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (fromLog) {
      navigate("/log");
    } else if (lotId) {
      navigate(`/lot/${lotId}`);
    } else {
      navigate("/");
    }
  };

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
    lines.push(`  RAPPORT D'ÉCART — ${displayLabel}${variantName ? ` — ${variantName}` : ""}`);
    lines.push(`  Date : ${dateStr} à ${timeStr}`);
    if (dpsName) lines.push(`  DPS : ${dpsName}`);
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("");

    if (discrepancies.length === 0) {
      lines.push("✅ Lot complet.");
      lines.push("Aucun écart détecté — tous les consommables sont conformes aux quantités attendues.");
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
    const safeName = displayLabel.replace(/\s+/g, "-").toLowerCase();
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
                onClick={handleBack}
                className="cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {isEditMode ? "Édition du rapport" : "Rapport d'écart"}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {displayLabel}
                    {variantName && ` · ${variantName}`}
                    {dpsName && ` · DPS : ${dpsName}`}
                    {reportDate && ` · ${formatDateTime(reportDate)}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode && (
                <Button
                  variant="default"
                  onClick={handleSave}
                  disabled={saving}
                  className="cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? "Sauvegarde…" : "Sauvegarder"}
                </Button>
              )}
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
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {discrepancies.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-medium text-foreground">
              Lot complet
            </p>
            <p className="text-sm text-muted-foreground">
              Aucun écart détecté — tous les consommables sont conformes aux quantités attendues.
            </p>
            <Button
              variant="outline"
              onClick={handleBack}
              className="cursor-pointer"
            >
              Retour
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
                          {isEditMode ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                min={0}
                                value={item.actualQuantity}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  if (!isNaN(v) && v >= 0) handleEditQuantity(idx, v);
                                }}
                                className="w-16 h-8 text-sm text-right rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                              <span className="text-sm text-muted-foreground">
                                / {item.expectedQuantity}
                              </span>
                            </div>
                          ) : (
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
                          )}
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
                onClick={handleBack}
                className="cursor-pointer"
              >
                Retour
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}