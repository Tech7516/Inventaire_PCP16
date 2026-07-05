import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { lots, lotSubEntities, subEntitySections } from "@/data/lots";
import { ArrowLeft, Save, ClipboardList, Check } from "lucide-react";
import { toast } from "sonner";
import { markCompleted } from "./SubEntities";
import { addLogEntry } from "./Log";

interface InventoryEntry {
  itemId: string;
  validated: boolean;
  customQuantity: string;
}

export default function InventoryPage() {
  const { lotId, subId, variantId, sacType } = useParams<{ lotId: string; subId: string; variantId?: string; sacType?: string }>();
  const navigate = useNavigate();
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

  const [entries, setEntries] = useState<Record<string, InventoryEntry>>(
    () => {
      const initial: Record<string, InventoryEntry> = {};
      sections.forEach((section) => {
        section.items.forEach((item) => {
          initial[item.id] = {
            itemId: item.id,
            validated: false,
            customQuantity: "",
          };
        });
      });
      return initial;
    }
  );

  const sacLabel = sacType === "o2" ? "Sac d'O2" : sacType === "soin" ? "Sac de soin" : "";
  const displayTitle = isDirectInventory
    ? lot?.name || ""
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
    setEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        validated: !prev[itemId].validated,
        customQuantity: !prev[itemId].validated ? "" : prev[itemId].customQuantity,
      },
    }));
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

  const handleSubmit = () => {
    const unprocessed = allItems.filter(
      (item) => !entries[item.id].validated && !entries[item.id].customQuantity.trim()
    );
    if (unprocessed.length > 0) {
      toast.error(
        `${unprocessed.length} article(s) non traité(s). Validez le stock ou indiquez une quantité différente.`
      );
      return;
    }
    toast.success("Inventaire enregistré avec succès !");
    // Mark this section as completed so green check appears on SubEntities page
    const completedKey = variantId && sacType
      ? `${lotId}-${subId}-${variantId}-${sacType}`
      : variantId
        ? `${lotId}-${subId}-${variantId}`
        : `${lotId}-${subId}`;
    markCompleted(completedKey);

    // Log the completion
    const dpsName = localStorage.getItem("dps-name") || "";
    const lotVariantRaw = localStorage.getItem("lot-variants");
    let lotVariantName: string | null = null;
    if (lot?.variants && lotVariantRaw) {
      try {
        const lotVariants = JSON.parse(lotVariantRaw);
        const selectedVId = lotVariants[lotId];
        if (selectedVId) {
          const v = lot.variants.find((vv) => vv.id === selectedVId);
          if (v) lotVariantName = v.name;
        }
      } catch { /* ignore */ }
    }

    const subEntityName = isDirectInventory
      ? (lotVariantName || lot?.name || "")
      : (subEntity?.name || subId || "");

    const variantName = variant?.name || lotVariantName || null;

    addLogEntry({
      lotId: lotId || "",
      lotName: lot?.name || "",
      subEntityName,
      variantName,
      sacType: sacType || null,
      dpsName,
      completedAt: new Date().toISOString(),
      completedKey,
    });

    console.log("Inventaire soumis:", { lotId, subId, variantId, sacType, entries });
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
                    {lot.name} — {lot.location}
                    {sections.length > 0 && ` · ${processedCount}/${allItems.length} articles traités`}
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleSubmit} className="cursor-pointer">
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
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