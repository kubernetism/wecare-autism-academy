import { Result } from "antd";
import { LinkButton } from "@/components/link-button";

export function AccessDenied() {
  return (
    <Result
      status="403"
      title="You do not have access to this page"
      subTitle="Ask the clinic administrator if you think you should."
      extra={
        <LinkButton type="primary" href="/app">
          Back to dashboard
        </LinkButton>
      }
    />
  );
}
