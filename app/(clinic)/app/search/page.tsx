import { Card, Empty, Flex, Tag } from "antd";
import Link from "next/link";
import { PageHeader } from "@/components/clinic/page-header";
import { PATIENT_STATUS_LABEL, PATIENT_STATUS_TAG, APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TAG, APPOINTMENT_TYPE_LABEL, MESSAGE_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/time";
import { searchQuerySchema } from "@/lib/validation/clinic";
import { env } from "@/server/env";
import { searchAppointments } from "@/server/services/appointments";
import { searchMessages } from "@/server/services/messages";
import { searchPatients } from "@/server/services/patients";
import { requireUser } from "@/server/session";
import { SimpleEmpty, Text } from "@/components/ui";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/app/search">) {
  const user = await requireUser(["admin", "staff"], "/app/search");
  const params = await searchParams;
  const parsed = searchQuerySchema.safeParse(params.q);
  const tz = env.CLINIC_TIME_ZONE;

  if (!parsed.success) {
    return (
      <>
        <PageHeader title="Search" />
        <Card>
          <Empty description="Type at least two characters in the search box to search patients, requests and messages." />
        </Card>
      </>
    );
  }

  const q = parsed.data;
  const [patients, appointments, messages] = await Promise.all([searchPatients(user, q), searchAppointments(user, q), searchMessages(user, q)]);

  return (
    <>
      <PageHeader
        title={`Results for “${q}”`}
        description={user.role === "admin" ? "Searches patients by name or tracking ID, and names, emails and phone numbers in appointment requests and messages." : "Searches your assigned patients by name or tracking ID, and your appointments."}
      />
      <Flex vertical gap={16}>
        <Card title={`Patients (${patients.length}${patients.length === 25 ? "+" : ""})`}>
          {patients.length === 0 ? (
            <SimpleEmpty description="No matching patients." />
          ) : (
            <Flex vertical gap={12} component="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {patients.map((p) => (
                <li key={p.id}>
                  <Flex wrap gap={8} align="center">
                    <Link href={`/app/patients/${p.id}`}>
                      <Text strong>{p.name}</Text>
                    </Link>
                    <Tag>{p.trackingId}</Tag>
                    <Tag color={PATIENT_STATUS_TAG[p.status]}>{PATIENT_STATUS_LABEL[p.status]}</Tag>
                    <Text type="secondary">Guardian {p.guardianName}</Text>
                  </Flex>
                </li>
              ))}
            </Flex>
          )}
        </Card>
        <Card title={`Appointment requests (${appointments.length})`}>
          {appointments.length === 0 ? (
            <SimpleEmpty description="No matching requests." />
          ) : (
            <Flex vertical gap={12} component="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {appointments.map((a) => (
                <li key={a.id}>
                  <Flex wrap gap={8} align="center">
                    <Link href={`/app/appointments?tab=${a.status === "pending" || a.status === "approved" || a.status === "scheduled" ? a.status : "closed"}`}>
                      <Text strong>{a.contactName}</Text>
                    </Link>
                    <Tag>{APPOINTMENT_TYPE_LABEL[a.type]}</Tag>
                    <Tag color={APPOINTMENT_STATUS_TAG[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Tag>
                    <Text type="secondary">
                      {a.contactEmail} · {a.contactPhone} · {formatDate(a.createdAt, tz)}
                    </Text>
                  </Flex>
                </li>
              ))}
            </Flex>
          )}
        </Card>
        {user.role === "admin" && (
          <Card title={`Messages (${messages.length})`}>
            {messages.length === 0 ? (
              <SimpleEmpty description="No matching messages." />
            ) : (
              <Flex vertical gap={12} component="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {messages.map((m) => (
                  <li key={m.id}>
                    <Flex wrap gap={8} align="center">
                      <Link href={`/app/inbox?status=${m.status}`}>
                        <Text strong>{m.subject}</Text>
                      </Link>
                      <Tag>{MESSAGE_STATUS_LABEL[m.status]}</Tag>
                      <Text type="secondary">
                        {m.senderName} · {formatDate(m.createdAt, tz)}
                      </Text>
                    </Flex>
                  </li>
                ))}
              </Flex>
            )}
          </Card>
        )}
      </Flex>
    </>
  );
}
