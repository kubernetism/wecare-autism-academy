"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Flex, Input, Popconfirm, Table, Upload } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/time";
import { deleteFileAction } from "@/server/actions/clinical";
import type { MedicalFileRow } from "@/server/services/files";
import type { WorkspacePerms } from "./patient-workspace";
import { useActionRunner } from "./patient-workspace";

const LABEL: Record<string, string> = {
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
};

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function FilesTab({ patientId, files, perms, timeZone }: { patientId: string; files: MedicalFileRow[]; perms: WorkspacePerms; timeZone: string }) {
  const router = useRouter();
  const { message } = App.useApp();
  const { pending, run } = useActionRunner();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Flex vertical gap={16}>
      {perms.uploadFiles ? (
        <Card title="Upload a file">
          {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} closable={{ onClose: () => setError(null) }} /> : null}
          <Input placeholder="Description (optional), for example: school report, MRI scan" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} style={{ marginBottom: 12 }} />
          <Upload.Dragger
            name="file"
            multiple={false}
            showUploadList={false}
            accept=".png,.jpg,.jpeg,.webp,.pdf,.docx"
            customRequest={async ({ file, onSuccess, onError }) => {
              setError(null);
              const body = new FormData();
              body.append("file", file as File);
              if (description.trim()) body.append("description", description.trim());
              const response = await fetch(`/api/patients/${patientId}/files`, { method: "POST", body });
              const data = (await response.json().catch(() => ({}))) as { error?: string };
              if (response.ok) {
                onSuccess?.(data);
                setDescription("");
                message.success({ content: "File uploaded.", duration: 6 });
                router.refresh();
              } else {
                setError(data.error ?? "The upload failed.");
                onError?.(new Error(data.error ?? "Upload failed"));
              }
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag a file here to upload</p>
            <p className="ant-upload-hint">Images (PNG, JPEG, WebP), PDF or Word (DOCX), up to 10 MB. The type is checked from the file itself.</p>
          </Upload.Dragger>
        </Card>
      ) : null}
      <Table<MedicalFileRow>
        rowKey="id"
        dataSource={files}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 760 }}
        locale={{ emptyText: "No files yet." }}
        columns={[
          {
            title: "File",
            dataIndex: "originalName",
            render: (v: string, r) => (
              <a href={`/api/files/${r.id}`} target="_blank" rel="noopener noreferrer">
                {v}
              </a>
            ),
          },
          { title: "Type", dataIndex: "contentType", render: (v: string) => LABEL[v] ?? v },
          { title: "Size", dataIndex: "sizeBytes", render: size },
          { title: "Description", dataIndex: "description", render: (v: string | null) => v ?? "" },
          { title: "Uploaded", dataIndex: "createdAt", render: (v: string, r) => `${formatDateTime(v, timeZone)}${r.uploadedBy ? ` by ${r.uploadedBy}` : ""}` },
          ...(perms.deleteFiles
            ? [
                {
                  title: "",
                  key: "delete",
                  render: (_: unknown, r: MedicalFileRow) => (
                    <Popconfirm title="Delete this file?" description="It is hidden from the record and kept for the audit trail." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => run(() => deleteFileAction({ id: r.id }), "File deleted.")}>
                      <Button size="small" type="link" danger loading={pending}>
                        Delete
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Flex>
  );
}
