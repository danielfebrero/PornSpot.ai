import { SQS } from "aws-sdk";

const sqs = new SQS();

export class SQSService {
  static async sendMessage(
    queueUrl: string,
    message: any,
    delaySeconds: number = 0
  ): Promise<void> {
    await sqs
      .sendMessage({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        DelaySeconds: Math.min(delaySeconds, 900), // Max 15 minutes
      })
      .promise();
  }
}
