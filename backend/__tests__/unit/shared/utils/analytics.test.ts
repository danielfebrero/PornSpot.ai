import { calculateBusinessMetrics } from "../../../../shared/utils/analytics";
import { mockDynamoDBDocumentClient } from "../../../setup";

const mockSend = mockDynamoDBDocumentClient.send as jest.Mock;

describe("calculateBusinessMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates business metrics including MRR and revenue", async () => {
    mockSend
      .mockResolvedValueOnce({ Count: 2, LastEvaluatedKey: { id: "next" } })
      .mockResolvedValueOnce({ Count: 1 })
      .mockResolvedValueOnce({ Count: 3 })
      .mockResolvedValueOnce({ Count: 4 })
      .mockResolvedValueOnce({
        Items: [
          {
            amount: "9.00",
            completedAt: "2023-12-31T23:59:59.000Z",
          },
          {
            amount: "30.50",
            completedAt: "2024-01-15T10:00:00.000Z",
          },
          {
            amount: "15.00",
            completedAt: "2024-02-01T00:00:00.000Z",
          },
        ],
      });

    const result = await calculateBusinessMetrics(
      mockDynamoDBDocumentClient as any,
      "2024-01-01T00:00:00.000Z",
      "2024-01-31T23:59:59.999Z"
    );

    const expectedMrr = (2 + 1) * 9 + 3 * 20 + 4 * 30;
    expect(result.MRR).toBe(expectedMrr);
    expect(result.totalRevenue).toBe(54.5);
    expect(result.newRevenue).toBe(30.5);
    expect(mockSend).toHaveBeenCalledTimes(5);
  });

  it("returns zero MRR when no active subscriptions are found", async () => {
    mockSend
      .mockResolvedValueOnce({ Count: 0 })
      .mockResolvedValueOnce({ Count: 0 })
      .mockResolvedValueOnce({ Count: 0 })
      .mockResolvedValueOnce({ Items: [] });

    const result = await calculateBusinessMetrics(
      mockDynamoDBDocumentClient as any,
      "2024-02-01T00:00:00.000Z",
      "2024-02-29T23:59:59.999Z"
    );

    expect(result.MRR).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.newRevenue).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(4);
  });
});
