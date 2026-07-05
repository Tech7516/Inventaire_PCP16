import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lots, lotSubEntities, subEntitySections } from "@/data/lots";
import { ArrowLeft, ClipboardList, Package, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { addLogEntry } from "./Log";

function getCompletedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem("inventory-completed");
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function markCompleted(key: string) {
  const set = getCompletedKeys();
  set.add(key);
  localStorage.setItem("inventory-completed", JSON.stringify([...set]));
}

export { markCompleted };

export default function SubEntitiesPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const lot = lots.find((l) => l.id === lotId);
  const subEntities = lotId ? lotSubEntities[lotId] || [] : [];

  const [dpsName, setDpsName] = useState(() => localStorage.getItem("dps-name") || "");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("selected-variants");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(getCompletedKeys);

  // Refresh completed keys when page gains focus (returning from inventory)
  useEffect(() => {
    const refresh = () => setCompletedKeys(getCompletedKeys());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Also refresh on mount
  useEffect(() => {
    setCompletedKeys(getCompletedKeys());
  }, []);

  const persistVariant = (subId: string, value: string) => {
    setSelectedVariants((prev) => {
      const next = { ...prev, [subId]: value };
      localStorage.setItem("selected-variants", JSON.stringify(next));
      return next;
    });
  };

  const handleSave = () => {
    if (!dpsName.trim()) {
      toast.error("Veuillez saisir le nom du DPS avant de sauvegarder.");
      return;
    }
    localStorage.setItem("dps-name", dpsName.trim());

    // Log each completed sub-entity for this lot
    const dpsNameValue = dpsName.trim();
    subEntities.forEach((sub) => {
      const hasVariants = sub.variants && sub.variants.length > 0;
      const selectedVariant = selectedVariants[sub.id];

      if (hasVariants && sub.inventoryType === "lot-b") {
        // Lot B type: check both sac de soin and sac d'O2
        if (selectedVariant) {
          const soinKey = `${lotId}-${sub.id}-${selectedVariant}-soin`;
          const o2Key = `${lotId}-${sub.id}-${selectedVariant}-o2`;
          const soinDone = completedKeys.has(soinKey);
          const o2Done = completedKeys.has(o2Key);

          if (soinDone) {
            const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
            addLogEntry({
              lotId: lotId || "",
              lotName: lot?.name || "",
              subEntityName: sub.name,
              variantName: variantObj?.name || null,
              sacType: "soin",
              dpsName: dpsNameValue,
              completedAt: new Date().toISOString(),
              completedKey: soinKey,
            });
          }
          if (o2Done) {
            const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
            addLogEntry({
              lotId: lotId || "",
              lotName: lot?.name || "",
              subEntityName: sub.name,
              variantName: variantObj?.name || null,
              sacType: "o2",
              dpsName: dpsNameValue,
              completedAt: new Date().toISOString(),
              completedKey: o2Key,
            });
          }
        }
      } else if (hasVariants) {
        // Variant type (e.g. POM, Caisse)
        if (selectedVariant) {
          const key = `${lotId}-${sub.id}-${selectedVariant}`;
          if (completedKeys.has(key)) {
            const variantObj = sub.variants!.find((v) => v.id === selectedVariant);
            addLogEntry({
              lotId: lotId || "",
              lotName: lot?.name || "",
              subEntityName: sub.name,
              variantName: variantObj?.name || null,
              sacType: null,
              dpsName: dpsNameValue,
              completedAt: new Date().toISOString(),
              completedKey: key,
            });
          }
        }
      } else {
        // No variants
        const key = `${lotId}-${sub.id}`;
        if (completedKeys.has(key)) {
          addLogEntry({
            lotId: lotId || "",
            lotName: lot?.name || "",
            subEntityName: sub.name,
            variantName: null,
            sacType: null,
            dpsName: dpsNameValue,
            completedAt: new Date().toISOString(),
            completedKey: key,
          });
        }
      }
    });

    toast.success("Inventaire sauvegardé et envoyé !");
    console.log("Inventaire sauvegardé:", {
      lotId,
      dpsName: dpsNameValue,
      completed: [...completedKeys],
    });

    // Reset completed keys for this lot
    const allCompleted = getCompletedKeys();
    const keysToRemove = [...allCompleted].filter((key) => key.startsWith(`${lotId}-`));
    keysToRemove.forEach((key) => allCompleted.delete(key));
    localStorage.setItem("inventory-completed", JSON.stringify([...allCompleted]));
    setCompletedKeys(allCompleted);

    // Reset DPS name
    localStorage.removeItem("dps-name");
    setDpsName("");

    // Redirect to discrepancy report page
    if (lotId) {
      navigate(`/report/${lotId}`);
    }
  };

  if (!lot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Lot introuvable</p>
          <Button variant="outline" onClick={() => navigate("/")} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const isSubCompleted = (subId: string, variantId?: string, sacType?: string) => {
    let key: string;
    if (variantId && sacType) {
      key = `${lotId}-${subId}-${variantId}-${sacType}`;
    } else if (variantId) {
      key = `${lotId}-${subId}-${variantId}`;
    } else {
      key = `${lotId}-${subId}`;
    }
    return completedKeys.has(key);
  };

  const isLotBComplete = (subId: string) => {
    const variantId = selectedVariants[subId];
    if (!variantId) return false;
    return isSubCompleted(subId, variantId, "soin") && isSubCompleted(subId, variantId, "o2");
  };

  const isVariantComplete = (subId: string) => {
    const variantId = selectedVariants[subId];
    if (!variantId) return false;
    return isSubCompleted(subId, variantId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  {lot.name} — {lot.location}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Sélectionnez un sous-ensemble à inventorier
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Nom du DPS */}
        <div className="mb-6">
          <label htmlFor="dps-name" className="block text-sm font-medium text-muted-foreground mb-1.5">
            Nom du DPS
          </label>
          <Input
            id="dps-name"
            type="text"
            placeholder="Saisissez le nom du DPS..."
            value={dpsName}
            onChange={(e) => setDpsName(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subEntities.map((sub) => {
            const sections = subEntitySections[sub.id] || [];
            const itemCount = sections.reduce(
              (total, section) => total + section.items.length,
              0
            );
            const hasVariants = sub.variants && sub.variants.length > 0;
            const selectedVariant = selectedVariants[sub.id];
            const isCompleted = hasVariants
              ? sub.inventoryType === "lot-b"
                ? isLotBComplete(sub.id)
                : isVariantComplete(sub.id)
              : isSubCompleted(sub.id);

            return (
              <Card
                key={sub.id}
                className={`group transition-all duration-200 hover:shadow-md ${
                  isCompleted ? "border-emerald-300 bg-emerald-50/30" : "hover:border-primary/30"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {sub.name}
                    </CardTitle>
                    {isCompleted && (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sub.description && (
                    <p className="text-sm text-muted-foreground">
                      {sub.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>
                      {hasVariants
                        ? `${sub.variants!.length} variante${sub.variants!.length > 1 ? "s" : ""}`
                        : itemCount > 0
                          ? `${itemCount} article${itemCount > 1 ? "s" : ""} à vérifier`
                          : "Aucun article défini"}
                    </span>
                  </div>

                  {hasVariants && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">
                        {sub.inventoryType === "lot-b" ? "Choix du lot B :" : `Choix du ${sub.name.toLowerCase()} :`}
                      </label>
                      <Select
                        value={selectedVariant || ""}
                        onValueChange={(value) => persistVariant(sub.id, value)}
                      >
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder={`Choisir ${sub.inventoryType === "lot-b" ? "un lot B" : `un ${sub.name.toLowerCase()}`}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {sub.variants!.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id} className="cursor-pointer">
                              {variant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="pt-3 border-t space-y-2">
                    {hasVariants && sub.inventoryType === "lot-b" ? (
                      <>
                        <Button
                          className="w-full cursor-pointer"
                          variant="default"
                          disabled={!selectedVariant}
                          onClick={() => {
                            if (selectedVariant) {
                              navigate(`/inventory/${lotId}/${sub.id}/${selectedVariant}/soin`);
                            }
                          }}
                        >
                          {isSubCompleted(sub.id, selectedVariant, "soin") && (
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-200" />
                          )}
                          Vérifier le sac de soin
                        </Button>
                        <Button
                          className="w-full cursor-pointer"
                          variant="default"
                          disabled={!selectedVariant}
                          onClick={() => {
                            if (selectedVariant) {
                              navigate(`/inventory/${lotId}/${sub.id}/${selectedVariant}/o2`);
                            }
                          }}
                        >
                          {isSubCompleted(sub.id, selectedVariant, "o2") && (
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-200" />
                          )}
                          Vérifier le sac d'O2
                        </Button>
                      </>
                    ) : hasVariants ? (
                      <Button
                        className="w-full cursor-pointer"
                        variant="default"
                        disabled={!selectedVariant}
                        onClick={() => {
                          if (selectedVariant) {
                            navigate(`/inventory/${lotId}/${sub.id}/${selectedVariant}`);
                          }
                        }}
                      >
                        Vérifier l'inventaire
                      </Button>
                    ) : (
                      <Button
                        className="w-full cursor-pointer"
                        variant="default"
                        onClick={() => navigate(`/inventory/${lotId}/${sub.id}`)}
                      >
                        Vérifier l'inventaire
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Bouton Sauvegarder/Envoyer en bas */}
      <footer className="border-t bg-card">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            className="w-full sm:w-auto cursor-pointer"
            variant="default"
            size="lg"
            onClick={handleSave}
          >
            <Save className="h-4 w-4 mr-2" />
            Sauvegarder / Envoyer
          </Button>
        </div>
      </footer>
    </div>
  );
}