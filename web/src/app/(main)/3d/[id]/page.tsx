import { ChatThread } from "@/components/chat/ChatThread";

export default async function ThreeDSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatThread id={id} surfaceModuleId="3d" />;
}
