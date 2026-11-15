import { Flex } from "antd";
import type { ReactNode } from "react";
import { Paragraph, Title } from "@/components/ui";

export function PageHeader({
  title,
  description,
  extra,
}: {
  title: string;
  description?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Flex wrap justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <Title level={1} style={{ marginBottom: 4 }}>
          {title}
        </Title>
        {description ? (
          <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: "68ch" }}>
            {description}
          </Paragraph>
        ) : null}
      </div>
      {extra ? <Flex gap={8} wrap>{extra}</Flex> : null}
    </Flex>
  );
}
