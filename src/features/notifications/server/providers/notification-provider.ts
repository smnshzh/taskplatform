export type NotificationProviderName = "telegram" | "bale";

export type SendMessageInput = {
  recipientId: string;
  text: string;
  parseMode?: "plain" | "markdown";
  idempotencyKey: string;
  replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] };
};

export type SendMessageResult = {
  providerMessageId?: string;
  delivered: boolean;
  rawStatus?: string;
};

export interface NotificationProvider {
  readonly name: NotificationProviderName;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
