import { Alert, Card, Col, Row, Statistic } from "antd";
import Link from "next/link";
import { PageHeader } from "@/components/clinic/page-header";
import { TodaySchedule } from "@/components/clinic/today-schedule";
import { getDashboard, type StatValue } from "@/server/services/dashboard";
import { requireUser } from "@/server/session";
import { Paragraph, Text } from "@/components/ui";
import { MyPatients, RecentAdmissions } from "@/components/clinic/dashboard-lists";

export const metadata = { title: "Dashboard" };

function StatBody({ value }: { value: StatValue }) {
  if (value.kind === "count") {
    return <Statistic value={value.value} />;
  }
  return (
    <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
      Not tracked yet. Arrives with Phase {value.phase}.
    </Paragraph>
  );
}

export default async function DashboardPage() {
  const user = await requireUser(["admin", "staff"], "/app");
  const data = await getDashboard(user);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={data.isAdmin ? "Clinic overview for today." : "Your day at a glance."}
      />

      {data.isAdmin && data.pendingRequests > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          title={
            <>
              {data.pendingRequests} {data.pendingRequests === 1 ? "request is" : "requests are"} waiting for a decision.{" "}
              <Link href="/app/appointments">Open the request queue</Link>
            </>
          }
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {data.stats.map((stat) => (
          <Col key={stat.key} xs={24} sm={12} xl={6}>
            <Card style={{ height: "100%" }}>
              <Text type="secondary" strong>
                {stat.href ? <Link href={stat.href}>{stat.label}</Link> : stat.label}
              </Text>
              <StatBody value={stat.value} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Today's schedule">
            <TodaySchedule
              sessions={data.todaySessions}
              appointments={data.todayAppointments}
              timeZone={data.timeZone}
              emptyText={data.isAdmin ? "Nothing scheduled for today." : "You have nothing scheduled today."}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            title={data.isAdmin ? "Recent admissions" : "My assigned patients"}
            extra={<Link href="/app/patients">All patients</Link>}
          >
            {data.isAdmin ? <RecentAdmissions rows={data.recentAdmissions} /> : <MyPatients rows={data.myPatients} />}
          </Card>
        </Col>
      </Row>
    </>
  );
}
