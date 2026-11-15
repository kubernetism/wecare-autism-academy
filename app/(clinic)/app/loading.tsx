import { Card, Skeleton } from "antd";

export default function Loading() {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <Skeleton active paragraph={{ rows: 8 }} />
    </Card>
  );
}
