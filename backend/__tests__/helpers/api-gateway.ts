import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const createAPIGatewayEvent = (
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent => ({
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

export const createGetAlbumsEvent = (
  queryParams?: Record<string, string>
): APIGatewayProxyEvent =>
  createAPIGatewayEvent({
    httpMethod: "GET",
    path: "/albums",
    queryStringParameters: queryParams || null,
  });

export const createGetAlbumByIdEvent = (
  albumId: string
): APIGatewayProxyEvent =>
  createAPIGatewayEvent({
    httpMethod: "GET",
    path: `/albums/${albumId}`,
    pathParameters: { albumId },
  });

export const createCreateAlbumEvent = (body: unknown): APIGatewayProxyEvent =>
  createAPIGatewayEvent({
    httpMethod: "POST",
    path: "/albums",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

export const createGetMediaEvent = (
  albumId: string,
  queryParams?: Record<string, string>
): APIGatewayProxyEvent =>
  createAPIGatewayEvent({
    httpMethod: "GET",
    path: `/albums/${albumId}/media`,
    pathParameters: { albumId },
    queryStringParameters: queryParams || null,
  });

export const createUploadMediaEvent = (
  albumId: string,
  body: unknown
): APIGatewayProxyEvent =>
  createAPIGatewayEvent({
    httpMethod: "POST",
    path: `/albums/${albumId}/media`,
    pathParameters: { albumId },
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

// Response assertion helpers
export const expectSuccessResponse = (
  response: APIGatewayProxyResult,
  statusCode: number = 200
) => {
  expect(response.statusCode).toBe(statusCode);
  expect(response.headers).toEqual(
    expect.objectContaining({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    })
  );

  const body = JSON.parse(response.body);
  expect(body.success).toBe(true);
  expect(body.data).toBeDefined();

  return body.data;
};

export const expectErrorResponse = (
  response: APIGatewayProxyResult,
  statusCode: number,
  errorMessage?: string
) => {
  expect(response.statusCode).toBe(statusCode);
  expect(response.headers).toEqual(
    expect.objectContaining({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    })
  );

  const body = JSON.parse(response.body);
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();

  if (errorMessage) {
    expect(body.error).toBe(errorMessage);
  }

  return body.error;
};

export const expectBadRequestResponse = (
  response: APIGatewayProxyResult,
  errorMessage?: string
) => expectErrorResponse(response, 400, errorMessage);

export const expectNotFoundResponse = (
  response: APIGatewayProxyResult,
  errorMessage?: string
) => expectErrorResponse(response, 404, errorMessage);

export const expectInternalErrorResponse = (
  response: APIGatewayProxyResult,
  errorMessage?: string
) => expectErrorResponse(response, 500, errorMessage);

export const expectCreatedResponse = (response: APIGatewayProxyResult) =>
  expectSuccessResponse(response, 201);

// Pagination helpers
export const createCursor = (lastEvaluatedKey: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");

export const parseCursor = (cursor: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(cursor, "base64").toString());
