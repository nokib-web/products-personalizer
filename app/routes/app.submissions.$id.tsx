import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Button,
  Select,
  FormLayout,
  Divider,
} from "@shopify/polaris";
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  const submission = await prisma.designSubmission.findUnique({
    where: { id, shop: session.shop },
    include: {
      product: true,
    },
  });

  if (!submission) {
    throw new Response("Submission not found", { status: 404 });
  }

  return { submission };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();

  const intent = formData.get("intent");

  if (intent === "update_status") {
    const status = formData.get("status") as string;
    await prisma.designSubmission.update({
      where: { id, shop: session.shop },
      data: { status },
    });
    return { success: true };
  } else if (intent === "delete") {
    await prisma.designSubmission.delete({
      where: { id, shop: session.shop },
    });
    return redirect("/app/submissions");
  }

  return { success: true };
};

export default function SubmissionDetail() {
  const { submission } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") === "update_status";

  const [status, setStatus] = useState(submission.status);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };

  const saveStatus = () => {
    const formData = new FormData();
    formData.append("intent", "update_status");
    formData.append("status", status);
    submit(formData, { method: "post" });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this submission?")) {
      const formData = new FormData();
      formData.append("intent", "delete");
      submit(formData, { method: "post" });
    }
  };

  let parsedDesignData = null;
  try {
    parsedDesignData = JSON.parse(submission.designData);
  } catch (e) {
    // ignore
  }

  return (
    <Page
      backAction={{ content: "Submissions", onAction: () => navigate("/app/submissions") }}
      title={`Submission: ${submission.id.slice(-8)}`}
      primaryAction={{
        content: "Save changes",
        onAction: saveStatus,
        loading: isSaving,
        disabled: status === submission.status,
      }}
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          onAction: handleDelete,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Design Preview</Text>
                <Button url={submission.previewImageUrl} target="_blank" download>
                  Download Image
                </Button>
              </InlineStack>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <img 
                  src={submission.previewImageUrl} 
                  alt="Customer Design Preview" 
                  style={{ maxWidth: "100%", maxHeight: "600px", objectFit: "contain" }}
                />
              </div>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Raw Design Data</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Below is the raw canvas data exported by the customer. This can be used to re-render or extract exact coordinates, texts, and images used.
              </Text>
              <div style={{ background: "#1e293b", color: "#f8fafc", padding: "16px", borderRadius: "8px", overflowX: "auto" }}>
                <pre style={{ margin: 0, fontSize: "12px" }}>
                  {parsedDesignData ? JSON.stringify(parsedDesignData, null, 2) : submission.designData}
                </pre>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Submission Details</Text>
              <FormLayout>
                <Select
                  label="Status"
                  options={[
                    { label: "Pending", value: "PENDING" },
                    { label: "In Production", value: "IN_PRODUCTION" },
                    { label: "Completed", value: "COMPLETED" },
                  ]}
                  value={status}
                  onChange={handleStatusChange}
                />
              </FormLayout>

              <Divider />
              
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Product</Text>
                <Text variant="bodyMd" as="p">{submission.product?.title || "Unknown Product"}</Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Order ID</Text>
                <Text variant="bodyMd" as="p">{submission.shopifyOrderId || "No order attached yet"}</Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Created At</Text>
                <Text variant="bodyMd" as="p">{new Date(submission.createdAt).toLocaleString()}</Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Customer Note</Text>
                <Text variant="bodyMd" as="p">{submission.customerNote || "None"}</Text>
              </BlockStack>

            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
