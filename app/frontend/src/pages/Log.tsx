import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScrollText, Clock, Trash2, FileText, Loader2 } from "lucide-react";
import {
  getLogEntriesFromDb,
  clearLogEntriesFromDb,
  getAllDiscrepancyReports,
  type InventoryLogData,
  type DiscrepancyReportData,
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

// Define the custom grouping for the log page
interface LogGroup {
  key: string;
  label: string;
  reportKey: string | null; // null = no centralized report for this group
  matchFn: (entry: InventoryLogData) => boolean;
}

// Helper: detect if an entry is a Lot B entry (regardless of parent lot)
const isLotBEntry = (e: InventoryLogData): boolean =>
  e.lot_id === "lot-b" ||
  e.sub_entity_name === "Lot B" ||
  (e.completed_key?.includes("lot-b") && !!e.sac_type);

// The 4 Lot B variants (always shown in the report section)
const LOT_B_VARIANTS = [
  { name: "Alpha", variantId: "alpha" },
  { name: "Bravo", variantId: "bravo" },
  { name: "Auteuil", variantId: "auteuil" },
  { name: "Neuilly", variantId: "neuilly" },
];

// Find the actual report key for a Lot B variant (supports multiple key formats in DB)
const findLotBReportKey = (variantId: string, availableKeys: Set<string>): string | null => {
  const primary = `lot-b::${variantId}`;
  if (availableKeys.has(primary)) return primary;
  // Fallback: match any key ending with ::variantId (e.g. lot-vps::auteuil, lot-001::auteuil)
  for (const key of availableKeys) {
    if (key.endsWith(`::${variantId}`)) return key;
  }
  return null;
};

// The 2 Lot C variants (always shown in the report section)
const LOT_C_VARIANTS = [
  { name: "Alpha", variantId: "alpha" },
  { name: "Bravo", variantId: "bravo" },
];

// Find the actual report key for a Lot C variant (supports multiple key formats in DB)
const findLotCReportKey = (variantId: string, availableKeys: Set<string>): string | null => {
  const primary = `lot-c::${variantId}`;
  if (availableKeys.has(primary)) return primary;
  // Fallback: match any key ending with ::variantId
  for (const key of availableKeys) {
    if (key.endsWith(`::${variantId}`)) return key;
  }
  return null;
};

const LOG_GROUPS: LogGroup[] = [
  {
    key: "lot-b",
    label: "Lot B",
    reportKey: null, // Lot B has per-variant reports
    matchFn: isLotBEntry,
  },
  {
    key: "vps-auteuil",
    label: "VPS Auteuil",
    reportKey: "vps-auteuil-central",
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-vps" && !e.lot_variant_name?.includes("Neuilly"),
  },
  {
    key: "vps-neuilly",
    label: "VPS Neuilly",
    reportKey: "vps-neuilly-central",
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-vps" && e.lot_variant_name?.includes("Neuilly"),
  },
  {
    key: "lot-a",
    label: "Lot A",
    reportKey: "lot-a-central",
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-001",
  },
  {
    key: "lot-c",
    label: "Lot C",
    reportKey: null, // Lot C has per-variant reports (Alpha/Bravo)
    matchFn: (e) => !isLotBEntry(e) && e.lot_id === "lot-003",
  },
  {
    key: "lot-v",
    label: "Lot V",
    reportKey: null, // Lot V has per-variant reports
    matchFn: (e) => e.lot_id === "lot-v",
  },
  {
    key: "lot-cai",
    label: "Lot CAI",
    reportKey: "lot-cai-central",
    matchFn: (e) => e.lot_id === "lot-cai",
  },
];

export default function LogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromReport = searchParams.get("from") === "report";
  const [entries, setEntries] = useState<InventoryLogData[]>([]);
  const [reports, setReports] = useState<DiscrepancyReportData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [data, allReports] = await Promise.all([
        getLogEntriesFromDb(),
        getAllDiscrepancyReports(),
      ]);
      setEntries(data);
      setReports(allReports);
      setLoading(false);
    };
    load();
  }, []);

  const handleClear = async () => {
    await clearLogEntriesFromDb();
    setEntries([]);
  };

  // Build a set of available report keys for quick lookup
  const availableReportKeys = new Set(reports.map((r) => r.report_key));

  // Check if a Lot B variant has a report
  const getLotBReportKey = (variantName: string | null): string | null => {
    if (!variantName) return null;
    const lower = variantName.toLowerCase();
    if (lower.includes("alpha")) return "lot-b::alpha";
    if (lower.includes("bravo")) return "lot-b::bravo";
    if (lower.includes("auteuil")) return "lot-b::auteuil";
    if (lower.includes("neuilly")) return "lot-b::neuilly";
    return null;
  };

  // Check if a Lot V variant has a report
  const getLotVReportKey = (variantName: string | null): string | null => {
    if (!variantName) return null;
    const lower = variantName.toLowerCase();
    if (lower.includes("poussin")) return "lot-v::vl-poussin";
    if (lower.includes("passy")) return "lot-v::vtp-passy";
    return null;
  };

  // Group entries by LOG_GROUPS
  const groupedEntries: Record<string, InventoryLogData[]> = {};
  LOG_GROUPS.forEach((g) => {
    groupedEntries[g.key] = [];
  });
  // "other" group for unmatched entries
  groupedEntries["other"] = [];

  entries.forEach((entry) => {
    let matched = false;
    for (const group of LOG_GROUPS) {
      if (group.matchFn(entry)) {
        groupedEntries[group.key].push(entry);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groupedEntries["other"].push(entry);
    }
  });

  // Sort entries within each group by date (newest first)
  Object.keys(groupedEntries).forEach((key) => {
    groupedEntries[key].sort(
      (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );
  });

  // Deduplicate Lot B entries: keep only the most recent per variant + sac_type
  const dedupedLotB = (() => {
    const seen = new Map<string, InventoryLogData>();
    for (const entry of groupedEntries["lot-b"] || []) {
      const variantName = entry.variant_name || "";
      const sacType = entry.sac_type || "";
      const dedupKey = `${variantName}::${sacType}`;
      if (!seen.has(dedupKey)) {
        seen.set(dedupKey, entry);
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );
  })();
  groupedEntries["lot-b"] = dedupedLotB;

  // For Lot B group, collect unique variant names
  const getLotBVariantNames = (groupEntries: InventoryLogData[]): string[] => {
    const variants = new Set<string>();
    groupEntries.forEach((e) => {
      if (e.variant_name) variants.add(e.variant_name);
    });
    return Array.from(variants).sort();
  };

  // For Lot V group, collect unique variant names
  const getLotVVariantNames = (groupEntries: InventoryLogData[]): string[] => {
    const variants = new Set<string>();
    groupEntries.forEach((e) => {
      if (e.lot_variant_name) variants.add(e.lot_variant_name);
      else if (e.variant_name) variants.add(e.variant_name);
    });
    return Array.from(variants).sort();
  };

  // Check if a group has a report (meaning the lot was fully verified)
  const isGroupComplete = (group: LogGroup, lotBVariants: string[], lotVVariants: string[]): boolean => {
    if (group.reportKey) {
      return availableReportKeys.has(group.reportKey);
    }
    if (group.key === "lot-b") {
      return LOT_B_VARIANTS.some(v => !!findLotBReportKey(v.variantId, availableReportKeys));
    }
    if (group.key === "lot-c") {
      return LOT_C_VARIANTS.some(v => !!findLotCReportKey(v.variantId, availableReportKeys));
    }
    if (group.key === "lot-v") {
      return lotVVariants.some(vName => {
        const rk = getLotVReportKey(vName);
        return rk ? availableReportKeys.has(rk) : false;
      });
    }
    return false;
  };

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
            {LOG_GROUPS.map((group) => {
              const groupEntries = groupedEntries[group.key] || [];
              const hasEntries = groupEntries.length > 0;

              // Determine if centralized report is available
              const hasCentralReport = group.reportKey
                ? availableReportKeys.has(group.reportKey)
                : false;

              // For Lot B: check per-variant reports
              const lotBVariants = group.key === "lot-b" ? getLotBVariantNames(groupEntries) : [];
              // For Lot V: check per-variant reports
              const lotVVariants = group.key === "lot-v" ? getLotVVariantNames(groupEntries) : [];

              const groupComplete = isGroupComplete(group, lotBVariants, lotVVariants);

              return (
                <div key={group.key}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
{group.label}
                    </h2>
                    {/* Report button */}
                    {group.reportKey ? (
                      hasCentralReport ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/report/key/${encodeURIComponent(group.reportKey!)}?from=log`)}
                          className="cursor-pointer shrink-0"
                        >
                          <FileText className="h-4 w-4 mr-1.5" />
                          Rapport
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="opacity-50 shrink-0"
                        >
                          <FileText className="h-4 w-4 mr-1.5" />
                          Rapport
                        </Button>
                      )
                    ) : group.key === "lot-b" ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {LOT_B_VARIANTS.map((v) => {
                          const reportKey = findLotBReportKey(v.variantId, availableReportKeys);
                          const hasReport = !!reportKey;
                          return (
                            <Button
                              key={v.name}
                              variant="outline"
                              size="sm"
                              disabled={!hasReport}
                              onClick={() => navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log`)}
                              className={`shrink-0 ${hasReport ? "cursor-pointer" : "opacity-50"}`}
                            >
                              <FileText className="h-4 w-4 mr-1.5" />
                              {v.name}
                            </Button>
                          );
                        })}
                      </div>
                    ) : group.key === "lot-c" ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {LOT_C_VARIANTS.map((v) => {
                          const reportKey = findLotCReportKey(v.variantId, availableReportKeys);
                          const hasReport = !!reportKey;
                          return (
                            <Button
                              key={v.name}
                              variant="outline"
                              size="sm"
                              disabled={!hasReport}
                              onClick={() => hasReport && navigate(`/report/key/${encodeURIComponent(reportKey!)}?from=log`)}
                              className={`shrink-0 ${hasReport ? "cursor-pointer" : "opacity-50"}`}
                            >
                              <FileText className="h-4 w-4 mr-1.5" />
                              {v.name}
                            </Button>
                          );
                        })}
                      </div>
                    ) : group.key === "lot-v" ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {lotVVariants.length > 0 ? lotVVariants.map((vName) => {
                          const rk = getLotVReportKey(vName);
                          const hasReport = rk ? availableReportKeys.has(rk) : false;
                          return (
                            <Button
                              key={vName}
                              variant="outline"
                              size="sm"
                              disabled={!hasReport}
                              onClick={() => hasReport && navigate(`/report/key/${encodeURIComponent(rk!)}?from=log`)}
                              className={`shrink-0 ${hasReport ? "cursor-pointer" : "opacity-50"}`}
                            >
                              <FileText className="h-4 w-4 mr-1.5" />
                              {vName}
                            </Button>
                          );
                        }) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="opacity-50 shrink-0"
                          >
                            <FileText className="h-4 w-4 mr-1.5" />
                            Rapport
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>

{hasEntries && (
                    <div className="space-y-2">
                      {groupEntries.map((entry) => {
                        const subLabel = entry.sub_entity_name;
                        const variantLabel = entry.variant_name;
                        const sacLabel =
                          entry.sac_type === "soin"
                            ? "Sac de soin"
                            : entry.sac_type === "o2"
                              ? "Sac d'O2"
                              : null;

                        const detailParts: string[] = [];
                        if (group.key === "lot-b") {
                          // Simplified: "Lot B Alpha — Sac de soin" (no parent lot context)
                          // variant_name may already contain "Lot B Auteuil" — strip the "Lot B " prefix to avoid duplication
                          const cleanVariant = variantLabel?.replace(/^Lot\s*B\s+/i, "") || null;
                          if (cleanVariant) detailParts.push(`Lot B ${cleanVariant}`);
                          else detailParts.push("Lot B");
                          if (sacLabel) detailParts.push(sacLabel);
                        } else if (group.key === "lot-c") {
                          // Simplified: "Lot C Alpha — POM" or "Lot C Bravo — Caisse"
                          // variant_name may contain "Caisse Alpha" or "POM Alpha" — extract just the variant
                          const lotCVariant = entry.lot_variant_name
                            || (variantLabel?.replace(/^(Caisse|POM|Lot\s*C)\s+/i, ""))
                            || variantLabel;
                          const cleanSubEntity = subLabel?.replace(/\s+(Alpha|Bravo)$/i, "") || subLabel;
                          if (lotCVariant && (lotCVariant.includes("Alpha") || lotCVariant.includes("Bravo"))) {
                            const v = lotCVariant.includes("Alpha") ? "Alpha" : "Bravo";
                            detailParts.push(`Lot C ${v}`);
                          } else {
                            detailParts.push("Lot C");
                          }
                          detailParts.push(cleanSubEntity);
                        } else {
                          detailParts.push(subLabel);
                          if (variantLabel) detailParts.push(variantLabel);
                          if (sacLabel) detailParts.push(sacLabel);
                        }
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
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Other entries that don't match any group */}
            {groupedEntries["other"] && groupedEntries["other"].length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Autres
                </h2>
                <div className="space-y-2">
                  {groupedEntries["other"].map((entry) => {
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
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}