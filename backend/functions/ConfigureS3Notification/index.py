import boto3
import json
import cfnresponse
import traceback

TRIGGERS = [
    {
        "Id": "ProcessMediaUploadTrigger",
        "Prefix": "albums/",
    },
    {
        "Id": "ProcessAvatarUploadTrigger",
        "Prefix": "users/",
    },
    {
        "Id": "ProcessGeneratedMediaUploadTrigger",
        "Prefix": "generated/",
    },
]
TRIGGER_IDS = {trigger["Id"] for trigger in TRIGGERS}


def build_our_triggers(function_arn):
    """Return our trigger configs with the right function ARN."""
    return [
        {
            "Id": trigger["Id"],
            "LambdaFunctionArn": function_arn,
            "Events": ["s3:ObjectCreated:*"],
            "Filter": {
                "Key": {"FilterRules": [{"Name": "prefix", "Value": trigger["Prefix"]}]}
            },
        }
        for trigger in TRIGGERS
    ]


def clean_empty_keys(cfg):
    """Remove empty keys S3 dislikes."""
    for k in [
        "LambdaFunctionConfigurations",
        "QueueConfigurations",
        "TopicConfigurations",
    ]:
        if k in cfg and not cfg[k]:
            del cfg[k]


def get_current_config(s3, bucket):
    """Get the bucket notification config, handling odd responses."""
    try:
        curr = s3.get_bucket_notification_configuration(Bucket=bucket)
        # S3 sometimes returns 'ResponseMetadata', remove it
        curr.pop("ResponseMetadata", None)
        # Always ensure key presence
        if "LambdaFunctionConfigurations" not in curr:
            curr["LambdaFunctionConfigurations"] = []
        return curr
    except Exception as e:
        print(f"Error fetching current config: {e}")
        return {"LambdaFunctionConfigurations": []}


def remove_our_triggers(cfg):
    """Remove our triggers by Id from config."""
    before = len(cfg.get("LambdaFunctionConfigurations", []))
    cfg["LambdaFunctionConfigurations"] = [
        conf
        for conf in cfg.get("LambdaFunctionConfigurations", [])
        if conf.get("Id") not in TRIGGER_IDS
    ]
    after = len(cfg["LambdaFunctionConfigurations"])
    print(f"Removed {before - after} of our triggers; {after} remaining.")


def upsert_our_triggers(cfg, function_arn):
    """Remove any existing with our Ids and append new ones."""
    # Remove any with our Ids
    orig = cfg.get("LambdaFunctionConfigurations", [])
    new_ours = build_our_triggers(function_arn)
    without_ours = [c for c in orig if c.get("Id") not in TRIGGER_IDS]
    cfg["LambdaFunctionConfigurations"] = without_ours + new_ours


def handler(event, context):
    print("\n--- ConfigureS3NotificationFunction invoked ---")
    print(json.dumps(event, indent=2))
    s3 = boto3.client("s3")
    bucket = event["ResourceProperties"]["BucketName"]
    function_arn = event["ResourceProperties"]["FunctionArn"]
    physical_resource_id = bucket  # constant, for update-in-place

    try:
        if event["RequestType"] == "Delete":
            print(f"DELETE event: only removing our triggers from {bucket}")
            try:
                curr = get_current_config(s3, bucket)
                remove_our_triggers(curr)
                clean_empty_keys(curr)
                # S3 API: if no keys left, send empty dict
                to_set = curr if curr else {}
                print("Setting new config (after delete):", json.dumps(to_set))
                s3.put_bucket_notification_configuration(
                    Bucket=bucket, NotificationConfiguration=to_set
                )
                print("DELETE successful.")
                cfnresponse.send(
                    event, context, cfnresponse.SUCCESS, {}, physical_resource_id
                )
            except Exception as e:
                print("Error in DELETE:", traceback.format_exc())
                cfnresponse.send(
                    event,
                    context,
                    cfnresponse.FAILED,
                    {"Error": str(e)},
                    physical_resource_id,
                )
            return

        # Handle Create and Update together (idempotent)
        print(f"{event['RequestType']} event: adding/updating our triggers to {bucket}")
        try:
            curr = get_current_config(s3, bucket)
            upsert_our_triggers(curr, function_arn)
            clean_empty_keys(curr)
            print("Setting new config (after upsert):", json.dumps(curr))
            s3.put_bucket_notification_configuration(
                Bucket=bucket, NotificationConfiguration=curr
            )
            print("CREATE/UPDATE successful.")
            cfnresponse.send(
                event, context, cfnresponse.SUCCESS, {}, physical_resource_id
            )
        except Exception as e:
            print("Error in CREATE/UPDATE:", traceback.format_exc())
            cfnresponse.send(
                event,
                context,
                cfnresponse.FAILED,
                {"Error": str(e)},
                physical_resource_id,
            )

    except Exception as e:
        print("FATAL error:", traceback.format_exc())
        # Surface error to CloudFormation stack events
        cfnresponse.send(
            event, context, cfnresponse.FAILED, {"Error": str(e)}, physical_resource_id
        )
