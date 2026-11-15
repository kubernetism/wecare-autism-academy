import { Card, Col, Empty, Row } from "antd";
import { LinkButton } from "@/components/link-button";
import { requireUser } from "@/server/session";
import { Paragraph, Title } from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function PortalHome() {
  const user = await requireUser(["parent"], "/portal");
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <Title level={1}>Hello, {firstName}</Title>
      <Paragraph type="secondary" style={{ maxWidth: "60ch" }}>
        This is your WeCare parent portal. Once the clinic links your child to your account, you will see their
        treatment plan, sessions, report cards, attendance and invoices here.
      </Paragraph>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card title="Your children">
            <Empty
              description={
                <Paragraph style={{ maxWidth: "48ch", marginInline: "auto" }}>
                  No children are linked to your account yet. The clinic links them using your child&apos;s tracking ID
                  and your verified phone number or email. This part of the portal opens in a later release.
                </Paragraph>
              }
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Need something now?">
            <Paragraph>Book a visit or send the clinic a message from the website.</Paragraph>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <LinkButton type="primary" href="/book">
                Book a visit
              </LinkButton>
              <LinkButton href="/contact">
                Contact the clinic
              </LinkButton>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
