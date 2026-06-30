import { redirect } from "next/navigation";

/** 具体跳转由 proxy 按登录态处理；此处兜底到对话首页 */
export default function Home() {
  redirect("/chat");
}
