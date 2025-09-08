/*
File objective: WebSocket IP Analysis Utilities
Auth: Internal utility (requires proper validation before use)
Special notes:
- Analyzes IP patterns across user connections
- Uses GSI2 and GSI3 for efficient querying
- Includes TTL-aware filtering for recent connections
*/

/**
 * @fileoverview WebSocket IP Analysis Utilities
 * @description Utilities for analyzing IP address patterns across WebSocket connections.
 * @auth Internal utility functions.
 * @notes
 * - Uses GSI2 (WEBSOCKET_BY_IP) to find all connections from an IP
 * - Uses GSI3 (WEBSOCKET_USER_BY_IP) to find user-IP combinations
 * - Filters by date range (last 30 days by default)
 * - Returns analysis of shared IP usage between users
 */

import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ConnectionEntity } from "@shared/shared-types/websocket";

// Initialize DynamoDB client
const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
const clientConfig: any = {};

if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;

export interface IPAnalysisResult {
  hasSharedIP: boolean;
  sharedIPs: string[];
  user1Connections: ConnectionSummary[];
  user2Connections: ConnectionSummary[];
  timeframe: {
    startDate: string;
    endDate: string;
    daysBack: number;
  };
}

export interface ConnectionSummary {
  userId: string;
  clientIp: string;
  connectionId: string;
  connectedAt: string;
  lastActivity: string;
}

/**
 * Get all recent connections for a specific user within the timeframe
 */
export const getUserRecentConnections = async (
  userId: string,
  daysBack: number = 30
): Promise<ConnectionSummary[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const cutoffDate = startDate.toISOString();

  try {
    // Query GSI1 to get all connections for this user
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression:
        "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :userPrefix)",
      FilterExpression: "connectedAt >= :cutoffDate",
      ExpressionAttributeValues: {
        ":gsi1pk": "WEBSOCKET_CONNECTIONS",
        ":userPrefix": `${userId}#`,
        ":cutoffDate": cutoffDate,
      },
    });

    const result = await docClient.send(queryCommand);

    return (
      (result.Items as ConnectionEntity[])?.map((item) => ({
        userId: item.userId!,
        clientIp: item.clientIp,
        connectionId: item.connectionId,
        connectedAt: item.connectedAt,
        lastActivity: item.lastActivity,
      })) || []
    );
  } catch (error) {
    console.error(
      `❌ Error getting recent connections for user ${userId}:`,
      error
    );
    throw error;
  }
};

/**
 * Get all users who have connected from a specific IP within the timeframe
 */
export const getUsersFromIP = async (
  clientIp: string,
  daysBack: number = 30
): Promise<ConnectionSummary[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const cutoffDate = startDate.toISOString();

  try {
    // Query GSI2 to get all connections from this IP
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI2",
      KeyConditionExpression:
        "GSI2PK = :gsi2pk AND begins_with(GSI2SK, :ipPrefix)",
      FilterExpression:
        "connectedAt >= :cutoffDate AND attribute_exists(userId)",
      ExpressionAttributeValues: {
        ":gsi2pk": "WEBSOCKET_BY_IP",
        ":ipPrefix": `${clientIp}#`,
        ":cutoffDate": cutoffDate,
      },
    });

    const result = await docClient.send(queryCommand);

    return (
      (result.Items as ConnectionEntity[])?.map((item) => ({
        userId: item.userId!,
        clientIp: item.clientIp,
        connectionId: item.connectionId,
        connectedAt: item.connectedAt,
        lastActivity: item.lastActivity,
      })) || []
    );
  } catch (error) {
    console.error(`❌ Error getting users from IP ${clientIp}:`, error);
    throw error;
  }
};

/**
 * Check if two users have shared the same IP address recently
 */
export const checkUsersSharedIPRecently = async (
  userId1: string,
  userId2: string,
  daysBack: number = 30
): Promise<IPAnalysisResult> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const endDate = new Date();

  try {
    console.log(
      `🔍 Checking IP sharing between users ${userId1} and ${userId2} (last ${daysBack} days)`
    );

    // Get recent connections for both users
    const [user1Connections, user2Connections] = await Promise.all([
      getUserRecentConnections(userId1, daysBack),
      getUserRecentConnections(userId2, daysBack),
    ]);

    console.log(
      `📊 Found ${user1Connections.length} connections for user1, ${user2Connections.length} connections for user2`
    );

    // Extract unique IPs for each user
    const user1IPs = new Set(user1Connections.map((conn) => conn.clientIp));
    const user2IPs = new Set(user2Connections.map((conn) => conn.clientIp));

    // Find shared IPs
    const sharedIPs = Array.from(user1IPs).filter((ip) => user2IPs.has(ip));

    const result: IPAnalysisResult = {
      hasSharedIP: sharedIPs.length > 0,
      sharedIPs,
      user1Connections,
      user2Connections,
      timeframe: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysBack,
      },
    };

    console.log(
      `✅ IP analysis complete. Shared IPs: ${
        sharedIPs.length > 0 ? sharedIPs.join(", ") : "None"
      }`
    );

    return result;
  } catch (error) {
    console.error(
      `❌ Error checking shared IPs between users ${userId1} and ${userId2}:`,
      error
    );
    throw error;
  }
};

/**
 * Get detailed analysis of all users who have shared IPs with a specific user
 */
export const getIPSharingAnalysisForUser = async (
  userId: string,
  daysBack: number = 30
): Promise<{
  targetUser: string;
  timeframe: { startDate: string; endDate: string; daysBack: number };
  ipAnalysis: Array<{
    ip: string;
    sharedWithUsers: Array<{
      userId: string;
      connectionCount: number;
      firstSeen: string;
      lastSeen: string;
    }>;
  }>;
}> => {
  try {
    console.log(
      `🔍 Getting IP sharing analysis for user ${userId} (last ${daysBack} days)`
    );

    // Get all recent connections for the target user
    const userConnections = await getUserRecentConnections(userId, daysBack);
    const userIPs = [...new Set(userConnections.map((conn) => conn.clientIp))];

    console.log(`📊 User ${userId} has used ${userIPs.length} unique IPs`);

    // For each IP, find other users who have used it
    const ipAnalysis = await Promise.all(
      userIPs.map(async (ip) => {
        const allUsersFromIP = await getUsersFromIP(ip, daysBack);

        // Group by user and calculate stats
        const userStats = new Map<string, ConnectionSummary[]>();
        allUsersFromIP.forEach((conn) => {
          if (conn.userId !== userId) {
            // Exclude the target user
            if (!userStats.has(conn.userId)) {
              userStats.set(conn.userId, []);
            }
            userStats.get(conn.userId)!.push(conn);
          }
        });

        const sharedWithUsers = Array.from(userStats.entries())
          .map(([otherUserId, connections]) => {
            if (connections.length === 0) {
              return {
                userId: otherUserId,
                connectionCount: 0,
                firstSeen: "",
                lastSeen: "",
              };
            }

            return {
              userId: otherUserId,
              connectionCount: connections.length,
              firstSeen: connections.reduce(
                (earliest, conn) =>
                  conn.connectedAt < earliest ? conn.connectedAt : earliest,
                connections[0]!.connectedAt
              ),
              lastSeen: connections.reduce(
                (latest, conn) =>
                  conn.lastActivity > latest ? conn.lastActivity : latest,
                connections[0]!.lastActivity
              ),
            };
          })
          .filter((user) => user.connectionCount > 0);

        return {
          ip,
          sharedWithUsers,
        };
      })
    );

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const result = {
      targetUser: userId,
      timeframe: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        daysBack,
      },
      ipAnalysis: ipAnalysis.filter(
        (analysis) => analysis.sharedWithUsers.length > 0
      ),
    };

    console.log(
      `✅ IP sharing analysis complete. Found ${result.ipAnalysis.length} IPs with sharing`
    );

    return result;
  } catch (error) {
    console.error(
      `❌ Error getting IP sharing analysis for user ${userId}:`,
      error
    );
    throw error;
  }
};
