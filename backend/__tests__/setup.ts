// Set up environment variables for testing
process.env["DYNAMODB_TABLE"] = "test-table";
process.env["S3_BUCKET"] = "test-bucket";
process.env["CLOUDFRONT_DOMAIN"] = "test.cloudfront.net";

// Mock implementations for AWS SDK
export const mockDynamoDBDocumentClient = {
  send: jest.fn(),
};

export const mockS3Client = {
  send: jest.fn(),
};

// Mock AWS SDK clients using Jest mocks
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actualModule = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actualModule,
    DynamoDBDocumentClient: {
      from: jest.fn(() => mockDynamoDBDocumentClient),
    },
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
    UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteCommand: jest.fn().mockImplementation((input) => ({ input })),
    QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn((input) => ({ input })),
  GetObjectCommand: jest.fn((input) => ({ input })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

// Global test setup
beforeEach(() => {
  // Clear console logs in tests unless explicitly testing them
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test utilities
export const mockDate = (isoString: string) => {
  const mockDate = new Date(isoString);
  jest.spyOn(global, "Date").mockImplementation(() => mockDate as Date);
  return mockDate;
};

export const restoreDate = () => {
  jest.restoreAllMocks();
};

import { APIGatewayProxyEvent } from "aws-lambda";

// Helper to create mock API Gateway events
export const createMockAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: "GET",
  isBase64Encoded: false,
  path: "/",
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: "123456789012",
    apiId: "test-api",
    authorizer: {},
    httpMethod: "GET",
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: "127.0.0.1",
      user: null,
      userAgent: "test-agent",
      userArn: null,
    },
    path: "/",
    protocol: "HTTP/1.1",
    requestId: "test-request-id",
    requestTime: "01/Jan/2023:00:00:00 +0000",
    requestTimeEpoch: 1672531200000,
    resourceId: "test-resource",
    resourcePath: "/",
    stage: "test",
  },
  resource: "/",
  ...overrides,
});
