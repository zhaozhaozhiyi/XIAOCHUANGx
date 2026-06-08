import { ChatThread } from "@/components/chat/ChatThread";

export default async function TranslateSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatThread id={id} surfaceModuleId="translate" />;
}
