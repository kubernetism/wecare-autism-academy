"use client";

import { Empty, Skeleton, Typography, type EmptyProps } from "antd";

/**
 * antd compound members (`Typography.Title`, `Skeleton.Input`,
 * `Empty.PRESENTED_IMAGE_SIMPLE`) are static properties of client components.
 * Server Components only receive a client reference for `Typography`, so
 * dotted access is undefined there. Server Components import these named
 * re-exports instead; Client Components can keep using the dotted form.
 */
export const Title = Typography.Title;
export const Paragraph = Typography.Paragraph;
export const Text = Typography.Text;
export const SkeletonInput = Skeleton.Input;

/** `<Empty>` with antd's small image. */
export function SimpleEmpty(props: Omit<EmptyProps, "image">) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} {...props} />;
}
