"use client";

import { EditOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Empty, Flex, Popconfirm, Row, Space, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";
import { STAFF_TYPE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/time";
import { setStaffActiveAction } from "@/server/actions/clinical";
import type { StaffMonthRow } from "@/server/services/attendance";
import type { StaffDetail } from "@/server/services/staff-profiles";
import { AttendanceMonth } from "./attendance-month";
import { useActionRunner } from "./patient-workspace";
import { StaffFormDrawer } from "./staff-directory";

export function StaffProfileView({
  staff,
  attendance,
  month,
  isAdmin,
  isSelf,
  therapies,
  timeZone,
}: {
  staff: StaffDetail;
  attendance: StaffMonthRow[];
  month: string;
  isAdmin: boolean;
  isSelf: boolean;
  therapies: { value: string; label: string }[];
  timeZone: string;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, run } = useActionRunner();
  const clinical = staff.staffType !== "labour";

  return (
    <>
      <Flex wrap justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            {staff.fullName}
          </Typography.Title>
          <Space wrap>
            <Tag>{STAFF_TYPE_LABEL[staff.staffType]}</Tag>
            {staff.isVerified ? <Tag color="success">Verified</Tag> : <Tag>Not verified</Tag>}
            {staff.active ? <Tag color="processing">Active</Tag> : <Tag color="error">Inactive</Tag>}
            {staff.title ? <Typography.Text type="secondary">{staff.title}</Typography.Text> : null}
          </Space>
        </div>
        {isAdmin ? (
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Edit profile
            </Button>
            {!isSelf ? (
              <Popconfirm
                title={staff.active ? "Deactivate this staff member?" : "Reactivate this staff member?"}
                description={staff.active ? "Their login stops working, patient assignments close and future sessions need a new therapist. Records are kept." : "They can sign in again. Patient assignments are not restored."}
                okText={staff.active ? "Deactivate" : "Reactivate"}
                okButtonProps={{ danger: staff.active }}
                onConfirm={() => run(() => setStaffActiveAction({ id: staff.id, active: !staff.active }), staff.active ? "Staff member deactivated." : "Staff member reactivated.")}
              >
                <Button danger={staff.active} loading={pending}>
                  {staff.active ? "Deactivate" : "Reactivate"}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ) : null}
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Profile">
            <Descriptions
              size="small"
              column={1}
              items={[
                ...(clinical
                  ? [
                      { key: "lines", label: "Therapy lines", children: staff.therapyNames.length ? staff.therapyNames.join(", ") : "None" },
                      { key: "expertise", label: "Expertise", children: staff.expertise.length ? staff.expertise.map((e) => <Tag key={e}>{e}</Tag>) : "Not recorded" },
                    ]
                  : []),
                { key: "years", label: "Experience", children: staff.experienceYears != null ? `${staff.experienceYears} years` : "Not recorded" },
                { key: "phone", label: "Phone", children: staff.phone ?? "Not recorded" },
                { key: "email", label: "Contact email", children: staff.email ?? "Not recorded" },
                { key: "joined", label: "Joined", children: staff.joinedOn ? formatDate(staff.joinedOn) : "Not recorded" },
                { key: "login", label: "Login", children: staff.loginEmail ?? (clinical ? "No login" : "Support staff do not have logins") },
                ...(staff.bio ? [{ key: "bio", label: "Bio", children: staff.bio }] : []),
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          {clinical ? (
            <Card title={`Assigned patients (${staff.patients.length})`}>
              <Table
                size="small"
                rowKey="id"
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                dataSource={staff.patients}
                locale={{ emptyText: "No patients assigned." }}
                columns={[
                  { title: "Patient", dataIndex: "name", render: (v: string, r) => <Link href={`/app/patients/${r.id}`}>{v}</Link> },
                  { title: "Tracking ID", dataIndex: "trackingId" },
                  { title: "Since", dataIndex: "assignedAt", render: (v: string) => formatDate(v, timeZone) },
                ]}
              />
            </Card>
          ) : null}
          <Card title="Events" style={{ marginTop: clinical ? 16 : 0 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Events and workshops arrive with the Events module in a later phase." />
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="Attendance">
            <AttendanceMonth rows={attendance} month={month} timeZone={timeZone} />
          </Card>
        </Col>
      </Row>
      {editing ? <StaffFormDrawer staff={staff} therapies={therapies} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
