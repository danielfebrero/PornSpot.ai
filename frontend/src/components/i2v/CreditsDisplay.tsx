import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Coins, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

interface CreditsDisplayProps {
  availableCredits: number;
  onBuyCredits: () => void;
}

export function CreditsDisplay({
  availableCredits,
  onBuyCredits,
}: CreditsDisplayProps) {
  const t = useTranslations("i2v.creditsDisplay");

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("availableCredits")}
            </h3>
            <p className="text-2xl font-bold text-foreground">
              {availableCredits}s
            </p>
            <p className="text-sm text-muted-foreground">
              {t("useCreditsToGenerate")}
            </p>
          </div>
        </div>
        <Button
          onClick={onBuyCredits}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          size="lg"
        >
          <ShoppingCart className="h-4 w-4" />
          {t("buyCredits")}
        </Button>
      </div>
    </Card>
  );
}
