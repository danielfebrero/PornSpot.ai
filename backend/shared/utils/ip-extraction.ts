/*
 * File objective: Utility for extracting real client IP address from AWS API Gateway events
 * Auth: Utility function used by rate limiting and generation services
 *
 * Key responsibilities:
 * - Extract real client IP from CloudFront, ALB, and proxy headers
 * - Handle IPv6 and IPv4 addresses
 * - Provide fallback to source IP when proxy headers unavailable
 */

import { APIGatewayProxyEvent } from "aws-lambda";

/**
 * Extracts the real client IP address from API Gateway event headers.
 * Handles various proxy headers used by CloudFront, ALB, and other proxies.
 *
 * @param event - The API Gateway proxy event
 * @returns The client IP address as string
 */
export function extractClientIP(event: APIGatewayProxyEvent): string {
  const headers = event.headers;

  // List of headers to check for real client IP, in order of preference
  const ipHeaders = [
    "CF-Connecting-IP", // CloudFront
    "True-Client-IP", // CloudFront with True Client IP enabled
    "X-Forwarded-For", // Standard proxy header
    "X-Real-IP", // Nginx proxy
    "X-Client-IP", // Apache proxy
    "X-Cluster-Client-IP", // Cluster/load balancer
    "Forwarded", // RFC 7239 standard
  ];

  // Check each header for IP address
  for (const headerName of ipHeaders) {
    const headerValue =
      headers[headerName] || headers[headerName.toLowerCase()];

    if (headerValue) {
      // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
      // We want the first (leftmost) IP which is the original client
      if (headerName === "X-Forwarded-For") {
        const ips = headerValue.split(",").map((ip) => ip.trim());
        if (ips.length > 0 && ips[0]) {
          const clientIP = cleanIP(ips[0]);
          if (isValidIP(clientIP)) {
            console.log(
              `✅ Extracted client IP from ${headerName}: ${clientIP}`
            );
            return clientIP;
          }
        }
      } else if (headerName === "Forwarded") {
        // RFC 7239 format: for=clientIP;proto=https;host=example.com
        const forMatch = headerValue.match(/for=([^;,]+)/i);
        if (forMatch && forMatch[1]) {
          const clientIP = cleanIP(forMatch[1]);
          if (isValidIP(clientIP)) {
            console.log(
              `✅ Extracted client IP from ${headerName}: ${clientIP}`
            );
            return clientIP;
          }
        }
      } else {
        // Direct IP value
        const clientIP = cleanIP(headerValue);
        if (isValidIP(clientIP)) {
          console.log(`✅ Extracted client IP from ${headerName}: ${clientIP}`);
          return clientIP;
        }
      }
    }
  }

  // Fallback to source IP from request context
  const sourceIP = event.requestContext?.identity?.sourceIp;
  if (sourceIP && isValidIP(sourceIP)) {
    console.log(`✅ Using source IP as fallback: ${sourceIP}`);
    return sourceIP;
  }

  // Last resort fallback
  console.warn("⚠️ Could not extract valid client IP, using fallback");
  return "unknown";
}

/**
 * Cleans IP address string by removing quotes, brackets, and port numbers
 */
function cleanIP(ip: string): string {
  return ip
    .replace(/["[\]]/g, "") // Remove quotes and brackets
    .replace(/:.*$/, "") // Remove port number if present
    .trim();
}

/**
 * Validates if a string is a valid IPv4 or IPv6 address
 */
function isValidIP(ip: string): boolean {
  if (!ip || ip === "unknown") return false;

  // IPv4 validation
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(ip)) {
    return true;
  }

  // IPv6 validation (basic)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }

  return false;
}

/**
 * Anonymizes an IP address for logging purposes while preserving enough information
 * for rate limiting (keeps subnet information)
 */
export function anonymizeIP(ip: string): string {
  if (!isValidIP(ip)) {
    return ip;
  }

  // For IPv4, mask the last octet
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }

  // For IPv6, mask the last 64 bits
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(":")}::xxxx`;
    }
  }

  return "xxx.xxx.xxx.xxx";
}
