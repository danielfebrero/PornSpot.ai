import { formatNumber } from "../../src/lib/utils";

describe("formatNumber", () => {
  it("formats numbers greater than 1000 with K notation and 1 decimal place", () => {
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(22823)).toBe("22.8K");
    expect(formatNumber(5432)).toBe("5.4K");
    expect(formatNumber(10000)).toBe("10.0K");
    expect(formatNumber(999999)).toBe("1000.0K");
  });

  it("returns number as string for values <= 1000", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(100)).toBe("100");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1000)).toBe("1000");
  });

  it("handles edge cases correctly", () => {
    expect(formatNumber(null)).toBe("0");
    expect(formatNumber(undefined)).toBe("0");
    expect(formatNumber(0)).toBe("0");
  });

  it("formats numbers just above 1000 correctly", () => {
    expect(formatNumber(1001)).toBe("1.0K");
    expect(formatNumber(1050)).toBe("1.1K");
    expect(formatNumber(1099)).toBe("1.1K");
  });

  it("rounds to 1 decimal place correctly", () => {
    expect(formatNumber(1234)).toBe("1.2K");
    expect(formatNumber(1254)).toBe("1.3K");
    expect(formatNumber(1999)).toBe("2.0K");
  });
});
