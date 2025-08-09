import { ResponseUtil } from "../../../../shared/utils/response";
import { ApiResponse } from "@shared";

describe("ResponseUtil", () => {
  describe("success", () => {
    it("should return a successful response with default status code 200", () => {
      const data = { message: "Success" };
      const result = ResponseUtil.success(data);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      });

      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.error).toBeUndefined();
    });

    it("should return a successful response with custom status code", () => {
      const data = { id: "123" };
      const result = ResponseUtil.success(data, 201);

      expect(result.statusCode).toBe(201);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });
  });

  describe("error", () => {
    it("should return an error response with default status code 400", () => {
      const errorMessage = "Something went wrong";
      const result = ResponseUtil.error(errorMessage);

      expect(result.statusCode).toBe(400);
      expect(result.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      });

      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(errorMessage);
      expect(body.data).toBeUndefined();
    });

    it("should return an error response with custom status code", () => {
      const errorMessage = "Unauthorized";
      const result = ResponseUtil.error(errorMessage, 401);

      expect(result.statusCode).toBe(401);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(errorMessage);
    });
  });

  describe("notFound", () => {
    it("should return a 404 response with default message", () => {
      const result = ResponseUtil.notFound();

      expect(result.statusCode).toBe(404);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Resource not found");
    });

    it("should return a 404 response with custom message", () => {
      const customMessage = "Album not found";
      const result = ResponseUtil.notFound(customMessage);

      expect(result.statusCode).toBe(404);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(customMessage);
    });
  });

  describe("badRequest", () => {
    it("should return a 400 response with default message", () => {
      const result = ResponseUtil.badRequest();

      expect(result.statusCode).toBe(400);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Bad request");
    });

    it("should return a 400 response with custom message", () => {
      const customMessage = "Invalid input";
      const result = ResponseUtil.badRequest(customMessage);

      expect(result.statusCode).toBe(400);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(customMessage);
    });
  });

  describe("unauthorized", () => {
    it("should return a 401 response with default message", () => {
      const result = ResponseUtil.unauthorized();

      expect(result.statusCode).toBe(401);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Unauthorized");
    });

    it("should return a 401 response with custom message", () => {
      const customMessage = "Invalid token";
      const result = ResponseUtil.unauthorized(customMessage);

      expect(result.statusCode).toBe(401);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(customMessage);
    });
  });

  describe("forbidden", () => {
    it("should return a 403 response with default message", () => {
      const result = ResponseUtil.forbidden();

      expect(result.statusCode).toBe(403);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Forbidden");
    });

    it("should return a 403 response with custom message", () => {
      const customMessage = "Access denied";
      const result = ResponseUtil.forbidden(customMessage);

      expect(result.statusCode).toBe(403);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(customMessage);
    });
  });

  describe("internalError", () => {
    it("should return a 500 response with default message", () => {
      const result = ResponseUtil.internalError();

      expect(result.statusCode).toBe(500);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Internal server error");
    });

    it("should return a 500 response with custom message", () => {
      const customMessage = "Database connection failed";
      const result = ResponseUtil.internalError(customMessage);

      expect(result.statusCode).toBe(500);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(customMessage);
    });
  });

  describe("created", () => {
    it("should return a 201 response with data", () => {
      const data = { id: "123", name: "New Item" };
      const result = ResponseUtil.created(data);

      expect(result.statusCode).toBe(201);
      const body: ApiResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });
  });

  describe("noContent", () => {
    it("should return a 204 response with empty body", () => {
      const result = ResponseUtil.noContent();

      expect(result.statusCode).toBe(204);
      expect(result.headers).toEqual({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      });
      expect(result.body).toBe("");
    });
  });
});
