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
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg shrink-0">
            <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              <h3 className="text-base sm:text-lg font-semibold text-foreground leading-tight">
                {t("availableCredits")}
              </h3>
              <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {availableCredits}s
              </p>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
              {t("useCreditsToGenerate")}
            </p>
          </div>
        </div>
        <div className="flex sm:block">
          <Button
            onClick={onBuyCredits}
            className="w-full sm:w-auto justify-center flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            size="sm"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-medium">{t("buyCredits")}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
