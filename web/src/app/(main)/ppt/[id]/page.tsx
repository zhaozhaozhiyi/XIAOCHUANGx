import { ChatThread } from "@/components/chat/ChatThread";

export default async function PptSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatThread id={id} surfaceModuleId="ppt" />;
}
