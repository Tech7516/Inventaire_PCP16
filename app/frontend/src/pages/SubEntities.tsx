import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lots, lotSubEntities, subEntitySections } from "@/data/lots";
import { ArrowLeft, ClipboardList, Package } from "lucide-react";

export default function SubEntitiesPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const lot = lots.find((l) => l.id === lotId);
  const subEntities = lotId ? lotSubEntities[lotId] || [] : [];

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

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

  const handleInventory = (subId: string, hasVariants: boolean) => {
    if (hasVariants) {
      const variantId = selectedVariants[subId];
      if (!variantId) return;
      navigate(`/inventory/${lotId}/${subId}/${variantId}`);
    } else {
      navigate(`/inventory/${lotId}/${subId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
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

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subEntities.map((sub) => {
            const sections = subEntitySections[sub.id] || [];
            const itemCount = sections.reduce(
              (total, section) => total + section.items.length,
              0
            );
            const hasVariants = sub.variants && sub.variants.length > 0;
            const selectedVariant = selectedVariants[sub.id];

            return (
              <Card
                key={sub.id}
                className="group transition-all duration-200 hover:shadow-md hover:border-primary/30"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {sub.name}
                  </CardTitle>
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
                        Sélectionnez un lot :
                      </label>
                      <Select
                        value={selectedVariant || ""}
                        onValueChange={(value) =>
                          setSelectedVariants((prev) => ({ ...prev, [sub.id]: value }))
                        }
                      >
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Choisir une variante..." />
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

                  <div className="pt-3 border-t">
                    <Button
                      className="w-full cursor-pointer"
                      variant="default"
                      disabled={hasVariants ? !selectedVariant : false}
                      onClick={() => handleInventory(sub.id, !!hasVariants)}
                    >
                      Vérifier l'inventaire
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}