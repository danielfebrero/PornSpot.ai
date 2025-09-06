"""
cfnresponse - CloudFormation Custom Resource Response Module

This module provides a function to send responses to CloudFormation for custom resources.
It handles the HTTP PUT request to the pre-signed S3 URL provided by CloudFormation.

Auth: Internal utility module for AWS Lambda custom resources.
Notes:
- Standard AWS utility for sending SUCCESS or FAILED responses.
- Includes logging for debugging.
- Handles JSON serialization and HTTP request with urllib3.
- Used in ConfigureS3Notification to respond to CloudFormation events.

Original: Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
"""

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import logging
import urllib3

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

SUCCESS = "SUCCESS"
FAILED = "FAILED"

http = urllib3.PoolManager()


def send(
    event,
    context,
    responseStatus,
    responseData=None,
    physicalResourceId=None,
    noEcho=False,
    reason=None,
):
    """
    Sends a response to CloudFormation to indicate whether the custom resource operation was successful or not.
    """
    if responseData is None:
        responseData = {}

    responseUrl = event["ResponseURL"]

    logger.info(f"Response URL: {responseUrl}")

    responseBody = {
        "Status": responseStatus,
        "Reason": reason
        or f"See the details in CloudWatch Log Stream: {context.log_stream_name}",
        "PhysicalResourceId": physicalResourceId or context.log_stream_name,
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "NoEcho": noEcho,
        "Data": responseData,
    }

    json_responseBody = json.dumps(responseBody)

    logger.info(f"Response body: {json_responseBody}")

    headers = {"content-type": "", "content-length": str(len(json_responseBody))}

    try:
        response = http.request(
            "PUT", responseUrl, headers=headers, body=json_responseBody
        )
        logger.info(f"Status code: {response.status}")
        logger.info(f"Status message: {response.reason}")
        return True

    except Exception as e:
        logger.error(f"send(..) failed executing http.request(..) with error: {e}")
        return False
