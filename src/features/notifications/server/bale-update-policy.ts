export function shouldIgnoreBaleGroupMessage(input: {
  chatType?: string;
  text?: string;
  hasCallback: boolean;
}) {
  if (input.hasCallback || !input.chatType || input.chatType === "private") return false;
  return !input.text?.trim().startsWith("/");
}
