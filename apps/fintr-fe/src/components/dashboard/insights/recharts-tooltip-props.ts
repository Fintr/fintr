/** Theme-aware Recharts <Tooltip /> styles (light + dark via CSS variables). */
export const rechartsTooltipProps = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "12px",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
  },
  labelStyle: {
    color: "var(--foreground)",
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: "var(--foreground)",
  },
} as const;
