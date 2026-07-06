import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { lots, lotSubEntities, subEntitySections } from "@/data/lots";
import { ArrowLeft, Save, ClipboardList, Check, Users } from "lucide-react";
import { toast } from "sonner";
import {
  saveInventoryItems,
  markSubEntity,
  getInventoryItems,
  addLogEntryToDb,
  saveDiscrepancyReportToDb,
  type InventoryItemData,
} from "@/lib/inventory-api";

interface InventoryEntry {
  itemId: string;
  validated: boolean;
  customQuantity: string;
}

export default function InventoryPage() {
  const { lotId, subId, variantId, sacType } = useParams<{ lotId: string; subId: string; variantId?: string; sacType?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") ? parseInt(searchParams.get("session")!) : null;

  const lot = lots.find((l) => l.id === lotId);
  const isDirectInventory = lot?.directInventory === true;
  const subEntity = lotId && subId && !isDirectInventory
    ? lotSubEntities[lotId]?.find((s) => s.id === subId)
    : null;
  const variant = subEntity?.variants?.find((v) => v.id === variantId);

  // Determine which sections to show based on sacType
  const sectionKey = sacType ? `${subId}-${sacType}` : subId;
  const sections = isDirectInventory
    ? subEntitySections[lotId] || []
    : subId ? subEntitySections[sectionKey] || subEntitySections[subId] || [] : [];

  // DPS name for direct inventory lots (Lot CAI, Lot V)
  const [dpsName, setDpsName] = useState(() => localStorage.getItem("dps-name") || "");

  // Get the selected lot variant name for display (e.g. "VL Poussin")
  const lotVariantName = (() => {
    if (!lot?.variants) return null;
    try {
      const lotVars = localStorage.getItem("lot-variants");
      if (lotVars) {
        const parsed = JSON.parse(lotVars);
        const selectedVId = parsed[lotId || ""];
        if (selectedVId) {
          const v = lot.variants.find((vv) => vv.id === selectedVId);
          if (v) return v.name;
        }
      }
    } catch { /* ignore */ }
    return null;
  })();

  const [entries, setEntries] = useState<Record<string, InventoryEntry>>(
    () => {
      const initial: Record<string, InventoryEntry> = {};
      sections.forEach((section) => {
        section.items.forEach((item) => {
          initial[item.id] = {
            itemId: item.id,
            validated: true,
            customQuantity: "",
          };
        });
      });
      return initial;
    }
  );

  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Load existing items from DB if session exists
  useEffect(() => {
    const loadExisting = async () => {
      if (!sessionId) {
        setLoadingExisting(false);
        return;
      }
      try {
        const existingItems = await getInventoryItems(
          sessionId,
          subId,
          variantId || undefined,
          sacType || undefined
        );
        if (existingItems.length > 0) {
          setEntries((prev) => {
            const updated = { ...prev };
            existingItems.forEach((item: InventoryItemData) => {
              if (updated[item.item_id]) {
                updated[item.item_id] = {
                  itemId: item.item_id,
                  validated: item.validated ?? true,
                  customQuantity: item.custom_quantity || "",
                };
              }
            });
            return updated;
          });
        }
      } catch { /* ignore */ }
      setLoadingExisting(false);
    };
    loadExisting();
  }, [sessionId, subId, variantId, sacType]);

  const sacLabel = sacType === "o2" ? "Sac d'O2" : sacType === "soin" ? "Sac de soin" : "";
  const displayTitle = isDirectInventory
    ? lotVariantName || lot?.name || ""
    : variant
      ? sacLabel ? `${variant.name} — ${sacLabel}` : variant.name
      : subEntity?.name || "";

  if (!lot || (!isDirectInventory && !subEntity)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Sous-ensemble introuvable</p>
          <Button variant="outline" onClick={() => navigate("/")} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const allItems = sections.flatMap((s) => s.items);
  const processedCount = allItems.filter(
    (item) => entries[item.id].validated || entries[item.id].customQuantity.trim()
  ).length;

  const toggleValidation = (itemId: string) => {
    setEntries((prev) => {
      const wasValidated = prev[itemId].validated;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          validated: !wasValidated,
          // When unchecking (non-conforme), default quantity to "0"
          // When checking (conforme), clear the custom quantity
          customQuantity: wasValidated ? "0" : "",
        },
      };
    });
  };

  const updateCustomQuantity = (itemId: string, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        customQuantity: value,
      },
    }));
  };

  const handleSubmit = async () => {
    const unprocessed = allItems.filter(
      (item) => !entries[item.id].validated && !entries[item.id].customQuantity.trim()
    );
    if (unprocessed.length > 0) {
      toast.error(
        `${unprocessed.length} article(s) non traité(s). Validez le stock ou indiquez une quantité différente.`
      );
      return;
    }

    // For direct inventory, DPS name is required
    if (isDirectInventory && !dpsName.trim()) {
      toast.error("Veuillez saisir le nom du DPS.");
      return;
    }

    setSaving(true);

    try {
      // Save only discrepancies (non-conforming items) to DB
      if (sessionId) {
        const discrepancies = allItems.filter(
          (item) => !entries[item.id].validated || entries[item.id].customQuantity.trim()
        );
        const itemsPayload = discrepancies.map((item) => ({
          item_id: item.id,
          validated: entries[item.id].validated,
          custom_quantity: entries[item.id].customQuantity || null,
        }));

        if (itemsPayload.length > 0) {
          await saveInventoryItems(
            sessionId,
            subId || lotId || "",
            itemsPayload,
            dpsName.trim(),
            variantId || null,
            sacType || null
          );
        }

        // Mark sub-entity as checked
        await markSubEntity(
          sessionId,
          subId || lotId || "",
          dpsName.trim(),
          variantId || null,
          sacType || null
        );
      }

      toast.success("Inventaire enregistré avec succès !");

      // Save discrepancy report to DB (1 per lot+variant, keeps only latest)
      const discrepancyEntries = sections.flatMap((section) =>
        section.items
          .filter((item) => !entries[item.id].validated || entries[item.id].customQuantity.trim())
          .map((item) => ({
            itemId: item.id,
            validated: entries[item.id].validated,
            customQuantity: entries[item.id].customQuantity,
            itemName: item.name,
            expectedQuantity: item.expectedQuantity,
            sectionTitle: section.title,
          }))
      );

      // Build discrepancy items for the report
      const discrepancyItems = discrepancyEntries
        .filter((entry) => !entry.validated && entry.customQuantity.trim())
        .map((entry) => {
          const actual = parseInt(entry.customQuantity, 10);
          const subLabel = (() => {
            const subs = lotSubEntities[lotId || ""] || [];
            const sub = subs.find((s) => s.id === subId);
            if (!sub) return subId || "";
            if (variantId) {
              const v = sub.variants?.find((vv) => vv.id === variantId);
              return v?.name || variantId;
            }
            return sub.name;
          })();
          const sacLabel =
            sacType === "soin" ? "Sac de soin" : sacType === "o2" ? "Sac d'O2" : null;
          const locationParts: string[] = [];
          if (subLabel) locationParts.push(subLabel);
          if (sacLabel) locationParts.push(sacLabel);
          locationParts.push(entry.sectionTitle);

          return {
            itemName: entry.itemName,
            expectedQuantity: entry.expectedQuantity,
            actualQuantity: isNaN(actual) ? 0 : actual,
            location: locationParts.join(" / "),
          };
        })
        .filter((d) => d.actualQuantity !== d.expectedQuantity);

      // Build full inventory data for download
      const fullInventoryData = [{
        lotId: lotId || "",
        subId: subId || "",
        variantId: variantId || null,
        sacType: sacType || null,
        entries: discrepancyEntries,
        savedAt: new Date().toISOString(),
      }];

      // Use lot variant (from homepage selection) for report_key, not sub-entity variant
      const lotVariantId = (() => {
        try {
          const lotVars = localStorage.getItem("lot-variants");
          if (lotVars) {
            const parsed = JSON.parse(lotVars);
            return parsed[lotId || ""] || null;
          }
        } catch { /* ignore */ }
        return null;
      })();

      saveDiscrepancyReportToDb({
        lotId: lotId || "",
        variantId: lotVariantId,
        lotName: lot?.name || "",
        variantName: lotVariantName || null,
        dpsName: dpsName.trim(),
        discrepancies: discrepancyItems,
        fullInventory: fullInventoryData,
        hasDiscrepancies: discrepancyItems.length > 0,
      });

      // Log for direct inventory lots (e.g. Lot V, Lot CAI)
      if (isDirectInventory) {
        const completedKey = variantId && sacType
          ? `${lotId}-${subId}-${variantId}-${sacType}`
          : variantId
            ? `${lotId}-${subId}-${variantId}`
            : `${lotId}-${subId}`;

        addLogEntryToDb({
          lot_id: lotId || "",
          lot_name: lot?.name || "",
          sub_entity_name: lotVariantName || lot?.name || "",
          variant_name: lotVariantName,
          sac_type: null,
          dps_name: dpsName.trim(),
          completed_key: completedKey,
        });

        navigate(`/report/${lotId}`);
      } else {
        // Go back to sub-entities page
        navigate(`/lot/${lotId}`);
      }
    } catch (e: any) {
      toast.error(e?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des données existantes...</p>
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
                onClick={() => isDirectInventory ? navigate("/") : navigate(`/lot/${lotId}`)}
                className="cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {displayTitle}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {isDirectInventory ? (lotVariantName || lot.name) : `${lot.name} — ${lot.location}`}
                    {sections.length > 0 && ` · ${processedCount}/${allItems.length} articles traités`}
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="cursor-pointer">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </header>

      {sections.length === 0 ? (
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <p className="text-lg text-muted-foreground">
              Aucun article défini pour ce sous-ensemble.
            </p>
            <p className="text-sm text-muted-foreground">
              Les consommables seront ajoutés prochainement.
            </p>
          </div>
        </main>
      ) : (
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* DPS name field for direct inventory lots */}
          {isDirectInventory && (
            <div className="mb-6 bg-primary/5 rounded-lg px-4 py-3 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <label htmlFor="dps-name-direct" className="block text-sm font-medium text-muted-foreground mb-1">
                  Nom du DPS
                </label>
                <Input
                  id="dps-name-direct"
                  type="text"
                  placeholder="Saisissez le nom du DPS..."
                  value={dpsName}
                  onChange={(e) => {
                    setDpsName(e.target.value);
                    localStorage.setItem("dps-name", e.target.value);
                  }}
                  className="max-w-md"
                />
              </div>
            </div>
          )}
          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.id}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const entry = entries[item.id];
                    const isProcessed = entry.validated || entry.customQuantity.trim();

                    return (
                      <Card
                        key={item.id}
                        className={`transition-all duration-200 ${
                          isProcessed ? "border-emerald-200 bg-emerald-50/50" : ""
                        }`}
                      >
                        <CardContent className="py-3">
                          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {item.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Stock attendu : <span className="font-semibold">{item.expectedQuantity}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`validate-${item.id}`}
                                  checked={entry.validated}
                                  onCheckedChange={() => toggleValidation(item.id)}
                                  className="cursor-pointer"
                                />
                                <label
                                  htmlFor={`validate-${item.id}`}
                                  className="text-sm font-medium cursor-pointer select-none flex items-center gap-1"
                                >
                                  {entry.validated && <Check className="h-3 w-3 text-emerald-600" />}
                                  Conforme ({item.expectedQuantity})
                                </label>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">ou quantité :</span>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="Qté réelle"
                                  value={entry.customQuantity}
                                  onChange={(e) => updateCustomQuantity(item.id, e.target.value)}
                                  disabled={entry.validated}
                                  className="w-24"
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}