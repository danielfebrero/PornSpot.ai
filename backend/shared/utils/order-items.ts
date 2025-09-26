export type OrderItem = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  renewalFrequency?: "monthly" | "yearly";
  finbyPaymentType?: number;
};

export type ResolvedOrderItem = OrderItem & {
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export const orderItems: OrderItem[] = [
  {
    id: "starter-monthly",
    name: "Starter Monthly",
    amount: 9,
    currency: "USD",
    renewalFrequency: "monthly",
    finbyPaymentType: 3,
  },
  {
    id: "starter-yearly",
    name: "Starter Yearly",
    amount: 90,
    currency: "USD",
    renewalFrequency: "yearly",
    finbyPaymentType: 3,
  },
  {
    id: "unlimited-monthly",
    name: "Unlimited Monthly",
    amount: 20,
    currency: "USD",
    renewalFrequency: "monthly",
    finbyPaymentType: 3,
  },
  {
    id: "unlimited-yearly",
    name: "Unlimited Yearly",
    amount: 200,
    currency: "USD",
    renewalFrequency: "yearly",
    finbyPaymentType: 3,
  },
  {
    id: "pro-monthly",
    name: "Pro Monthly",
    amount: 30,
    currency: "USD",
    renewalFrequency: "monthly",
    finbyPaymentType: 3,
  },
  {
    id: "pro-yearly",
    name: "Pro Yearly",
    amount: 300,
    currency: "USD",
    renewalFrequency: "yearly",
    finbyPaymentType: 3,
  },
];

const VIDEO_CREDITS_PREFIX = "video-credits-";
const VIDEO_CREDITS_SECONDS_STEP = 5;
const VIDEO_CREDITS_MIN_SECONDS = 5;
const VIDEO_CREDITS_MAX_SECONDS = 500;

const getVideoCreditsPricePerStep = (seconds: number): number => {
  if (seconds <= 95) {
    return 0.89;
  }

  if (seconds < 500) {
    return 0.79;
  }

  return 0.69;
};

const isValidVideoCreditsSeconds = (seconds: number): boolean => {
  if (!Number.isFinite(seconds)) {
    return false;
  }

  if (seconds % VIDEO_CREDITS_SECONDS_STEP !== 0) {
    return false;
  }

  return (
    seconds >= VIDEO_CREDITS_MIN_SECONDS && seconds <= VIDEO_CREDITS_MAX_SECONDS
  );
};

export const resolveOrderItem = (itemId: string): ResolvedOrderItem | null => {
  const staticItem = orderItems.find((item) => item.id === itemId);
  if (staticItem) {
    return { ...staticItem };
  }

  if (!itemId?.startsWith(VIDEO_CREDITS_PREFIX)) {
    return null;
  }

  const secondsPart = itemId.slice(VIDEO_CREDITS_PREFIX.length);
  const seconds = Number(secondsPart);

  if (!isValidVideoCreditsSeconds(seconds)) {
    return null;
  }

  const pricePerStep = getVideoCreditsPricePerStep(seconds);
  const units = seconds / VIDEO_CREDITS_SECONDS_STEP;
  const rawAmount = units * pricePerStep;
  const amount = Number(rawAmount.toFixed(2));

  return {
    id: itemId,
    name: `Video Credits (${seconds}s)`,
    amount,
    currency: "USD",
    metadata: {
      type: "video-credits",
      seconds,
      unitSeconds: VIDEO_CREDITS_SECONDS_STEP,
      unitPrice: Number(pricePerStep.toFixed(2)),
    },
    finbyPaymentType: 0,
  };
};
