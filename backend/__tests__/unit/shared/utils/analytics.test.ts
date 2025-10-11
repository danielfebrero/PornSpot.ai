import { calculateBusinessMetrics } from "../../../../shared/utils/analytics";
import { mockDynamoDBDocumentClient } from "../../../setup";

const mockSend = mockDynamoDBDocumentClient.send as jest.Mock;

describe("calculateBusinessMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates MRR using active monthly subscriptions across paid plans", async () => {
    mockSend
      .mockResolvedValueOnce({ Count: 2, LastEvaluatedKey: { id: "next" } })
      .mockResolvedValueOnce({ Count: 1 })
      .mockResolvedValueOnce({ Count: 3 })
      .mockResolvedValueOnce({ Count: 4 });

    const result = await calculateBusinessMetrics(
      mockDynamoDBDocumentClient as any,
      "2024-01-01T00:00:00.000Z",
      "2024-01-31T23:59:59.999Z"
    );

    const expectedMrr = (2 + 1) * 9 + 3 * 20 + 4 * 30;
    expect(result.MRR).toBe(expectedMrr);
    expect(mockSend).toHaveBeenCalledTimes(4);
  });

  it("returns zero MRR when no active subscriptions are found", async () => {
    mockSend.mockResolvedValue({ Count: 0 });

    const result = await calculateBusinessMetrics(
      mockDynamoDBDocumentClient as any,
      "2024-02-01T00:00:00.000Z",
      "2024-02-29T23:59:59.999Z"
    );

    expect(result.MRR).toBe(0);
    expect(mockSend).toHaveBeenCalled();
  });
});
