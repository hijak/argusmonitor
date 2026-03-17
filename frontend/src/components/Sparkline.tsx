import { useId, useMemo } from "react";
import { Line, LineChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
  width?: number;
}

export function Sparkline({
  data,
  color = "hsl(217 91% 60%)",
  className,
  height = 32,
  width = 120,
}: SparklineProps) {
  const glowId = useId().replace(/:/g, "");

  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  const chartConfig = useMemo(
    () =>
      ({
        value: {
          label: "Value",
          color,
        },
      }) satisfies ChartConfig,
    [color],
  );

  if (chartData.length < 2) return null;

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto shrink-0 overflow-visible", className)}
      style={{ width, height }}
    >
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{ top: 3, right: 3, bottom: 3, left: 3 }}
      >
        <defs>
          <filter id={glowId} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <Line
          dataKey="value"
          type="bump"
          stroke="var(--color-value)"
          dot={false}
          strokeWidth={2}
          filter={`url(#${glowId})`}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
