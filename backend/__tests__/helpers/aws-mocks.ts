// DynamoDB Mock Helpers
export const mockDynamoDBSuccess = (mockImplementation: any) => {
  const mockSend = jest.fn().mockResolvedValue(mockImplementation);
  return mockSend;
};

export const mockDynamoDBError = (error: Error) => {
  const mockSend = jest.fn().mockRejectedValue(error);
  return mockSend;
};

export const mockDynamoDBGetItem = (item: any) => {
  return mockDynamoDBSuccess({ Item: item });
};

export const mockDynamoDBPutItem = () => {
  return mockDynamoDBSuccess({});
};

export const mockDynamoDBQueryItems = (
  items: any[],
  lastEvaluatedKey?: any
) => {
  const response: any = { Items: items };
  if (lastEvaluatedKey) {
    response.LastEvaluatedKey = lastEvaluatedKey;
  }
  return mockDynamoDBSuccess(response);
};

export const mockDynamoDBUpdateItem = () => {
  return mockDynamoDBSuccess({});
};

export const mockDynamoDBDeleteItem = () => {
  return mockDynamoDBSuccess({});
};

// S3 Mock Helpers
export const mockS3Success = (mockImplementation: any) => {
  const mockSend = jest.fn().mockResolvedValue(mockImplementation);
  return mockSend;
};

export const mockS3Error = (error: Error) => {
  const mockSend = jest.fn().mockRejectedValue(error);
  return mockSend;
};

export const mockS3PutObject = () => {
  return mockS3Success({});
};

export const mockS3DeleteObject = () => {
  return mockS3Success({});
};

export const mockS3GetObject = (body: any) => {
  return mockS3Success({ Body: body });
};

// Presigned URL Mock
export const mockPresignedUrl = (url: string) => {
  return jest.fn().mockResolvedValue(url);
};

// Command verification helpers
export const expectDynamoDBCommand = (
  mockSend: jest.Mock,
  commandType: any,
  expectedParams: any
) => {
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      constructor: commandType,
      input: expect.objectContaining(expectedParams),
    })
  );
};

export const expectS3Command = (
  mockSend: jest.Mock,
  commandType: any,
  expectedParams: any
) => {
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      constructor: commandType,
      input: expect.objectContaining(expectedParams),
    })
  );
};

// Error factories
export const createDynamoDBError = (code: string, message: string) => {
  const error = new Error(message);
  (error as any).name = code;
  return error;
};

export const createS3Error = (code: string, message: string) => {
  const error = new Error(message);
  (error as any).name = code;
  return error;
};

// Common DynamoDB errors
export const conditionalCheckFailedError = () =>
  createDynamoDBError(
    "ConditionalCheckFailedException",
    "The conditional request failed"
  );

export const resourceNotFoundError = () =>
  createDynamoDBError(
    "ResourceNotFoundException",
    "Requested resource not found"
  );

export const validationError = () =>
  createDynamoDBError(
    "ValidationException",
    "One or more parameter values were invalid"
  );

// Common S3 errors
export const noSuchBucketError = () =>
  createS3Error("NoSuchBucket", "The specified bucket does not exist");

export const noSuchKeyError = () =>
  createS3Error("NoSuchKey", "The specified key does not exist");

export const accessDeniedError = () =>
  createS3Error("AccessDenied", "Access Denied");
