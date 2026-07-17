const disabledValues = new Set(["0", "false", "off", "disabled"]);

/** Remove after 0.1.7 once the 0.1.6 renderer has completed its rollback window. */
export const CHAT_ACTIVITY_V2_ENABLED = !disabledValues.has(
  (process.env.CHAT_ACTIVITY_V2_ENABLED ?? "true").trim().toLowerCase(),
);
