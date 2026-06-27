"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

/** 历史列表异常时不拖垮侧栏一级模块导航 */
export class ChatHistorySidebarBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ChatHistorySidebar]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="px-3 py-2 text-xs leading-relaxed text-[var(--fg-tertiary)]">
          会话历史暂时无法加载，请刷新页面。一级菜单仍可正常使用。
        </p>
      );
    }
    return this.props.children;
  }
}
