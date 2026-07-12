import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Thumbnail,
  Text,
  Badge,
  Button,
  EmptyState,
  BlockStack,
  InlineStack,
  Grid,
  Tabs,
  TextField,
  Modal,
  Select,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const submissions = await prisma.designSubmission.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: {
      customizableProduct: {
        select: {
          title: true,
          mockupImageUrl: true,
        },
      },
    },
  });

  const summary = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === "PENDING").length,
    ordered: submissions.filter((s) => s.status === "ORDERED").length,
    inProduction: submissions.filter((s) => s.status === "IN_PRODUCTION").length,
    completed: submissions.filter((s) => s.status === "COMPLETED").length,
  };

  return {
    shop: session.shop,
    submissions,
    summary,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const submissionId = String(formData.get("submissionId") || "");
  const newStatus = String(formData.get("status") || "");

  if (!submissionId || !["PENDING", "ORDERED", "IN_PRODUCTION", "COMPLETED"].includes(newStatus)) {
    return { success: false, error: "Invalid parameters" };
  }

  await prisma.designSubmission.updateMany({
    where: {
      id: submissionId,
      shop: session.shop,
    },
    data: {
      status: newStatus,
    },
  });

  return { success: true };
};

export default function DesignsDashboard() {
  const { shop, submissions, summary } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [modalStatus, setModalStatus] = useState<string>("PENDING");

  // Keep modal status in sync when selecting a submission or after status update
  useEffect(() => {
    if (selectedSubmission) {
      const updated = submissions.find((s) => s.id === selectedSubmission.id);
      if (updated) {
        setSelectedSubmission(updated);
        setModalStatus(updated.status);
      } else {
        setModalStatus(selectedSubmission.status);
      }
    }
  }, [submissions, selectedSubmission]);

  const tabs = [
    { id: "all", content: `All (${summary.total})` },
    { id: "PENDING", content: `Pending (${summary.pending})` },
    { id: "ORDERED", content: `Ordered (${summary.ordered})` },
    { id: "IN_PRODUCTION", content: `In Production (${summary.inProduction})` },
    { id: "COMPLETED", content: `Completed (${summary.completed})` },
  ];

  const filteredSubmissions = submissions.filter((item) => {
    // 1. Tab Status Filter
    if (selectedTab > 0) {
      const targetStatus = tabs[selectedTab].id;
      if (item.status !== targetStatus) return false;
    }

    // 2. Search Filter (by Order Number or Product Title)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchOrder = item.shopifyOrderId?.toLowerCase().includes(q);
      const matchProduct = item.customizableProduct?.title?.toLowerCase().includes(q);
      return Boolean(matchOrder || matchProduct);
    }

    return true;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return <Badge tone="warning">Pending</Badge>;
      case "ORDERED":
        return <Badge tone="info">Ordered</Badge>;
      case "IN_PRODUCTION":
        return <Badge tone="attention">In Production</Badge>;
      case "COMPLETED":
        return <Badge tone="success">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }

  function renderCustomizationSummary(designDataJson: string) {
    try {
      const parsed = JSON.parse(designDataJson);
      const objects = parsed.objects || [];
      if (objects.length === 0) {
        return <Text as="p" tone="subdued">No custom layers found on canvas</Text>;
      }
      return (
        <List type="bullet">
          {objects.map((obj: any, idx: number) => {
            if (obj.type === "i-text" || obj.type === "text" || obj.text !== undefined) {
              return (
                <List.Item key={idx}>
                  <Text as="span" fontWeight="bold">
                    Text:
                  </Text>{" "}
                  "{obj.text}"{" "}
                  <Text as="span" tone="subdued">
                    (Color: {obj.fill || "#000000"}, Font: {obj.fontFamily || "Default"})
                  </Text>
                </List.Item>
              );
            }
            if (obj.type === "image") {
              return (
                <List.Item key={idx}>
                  <Text as="span" fontWeight="bold">
                    Uploaded/Selected Image
                  </Text>{" "}
                  (Layer #{idx + 1})
                </List.Item>
              );
            }
            if (obj.fill && typeof obj.fill === "string") {
              return (
                <List.Item key={idx}>
                  <Text as="span" fontWeight="bold">
                    Shape layer ({obj.type}):
                  </Text>{" "}
                  Color {obj.fill}
                </List.Item>
              );
            }
            return (
              <List.Item key={idx}>
                {obj.type || "Canvas element"} (Layer #{idx + 1})
              </List.Item>
            );
          })}
        </List>
      );
    } catch (e) {
      return <Text as="p" tone="subdued">Unable to parse design details</Text>;
    }
  }

  const cleanShop = shop.replace(".myshopify.com", "").split(".")[0];

  const rowMarkup = filteredSubmissions.map((submission, index) => {
    const orderNumber = submission.shopifyOrderId ? `#${submission.shopifyOrderId}` : "Not linked";
    const orderUrl = submission.shopifyOrderId
      ? `https://admin.shopify.com/store/${cleanShop}/orders/${submission.shopifyOrderId}`
      : null;

    return (
      <IndexTable.Row
        id={submission.id}
        key={submission.id}
        position={index}
        onClick={() => setSelectedSubmission(submission)}
      >
        <IndexTable.Cell>
          <Thumbnail
            source={
              submission.previewImageUrl ||
              "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
            }
            alt={submission.customizableProduct?.title || "Design preview"}
            size="small"
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {submission.customizableProduct?.title || "Custom Product"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {orderUrl ? (
            <Button
              variant="plain"
              onClick={(e) => {
                e.stopPropagation();
                window.open(orderUrl, "_blank");
              }}
            >
              {orderNumber}
            </Button>
          ) : (
            <Text variant="bodySm" tone="subdued" as="span">
              {orderNumber}
            </Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>{getStatusBadge(submission.status)}</IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(submission.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            size="micro"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSubmission(submission);
            }}
          >
            Manage
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page>
      <TitleBar title="Incoming Customized Orders" />
      <BlockStack gap="500">
        {/* Top Summary Card */}
        <Grid columns={{ xs: 2, sm: 4, md: 4, lg: 4, xl: 4 }}>
          <Grid.Cell>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Pending Designs
                </Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="headingLg">
                    {summary.pending}
                  </Text>
                  <Badge tone="warning">Pending</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Ordered
                </Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="headingLg">
                    {summary.ordered}
                  </Text>
                  <Badge tone="info">Ordered</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  In Production
                </Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="headingLg">
                    {summary.inProduction}
                  </Text>
                  <Badge tone="attention">In Production</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Completed
                </Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="headingLg">
                    {summary.completed}
                  </Text>
                  <Badge tone="success">Completed</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Table & Filtering */}
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
          <Box padding="400">
            <TextField
              label="Search"
              labelHidden
              placeholder="Search by order number or product title..."
              value={searchQuery}
              onChange={setSearchQuery}
              clearButton
              onClear={() => setSearchQuery("")}
              autoComplete="off"
            />
          </Box>
          <Divider />
          {filteredSubmissions.length === 0 ? (
            <EmptyState
              heading="No design submissions found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>When customers create custom designs on your storefront, they will appear right here.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "design", plural: "designs" }}
              itemCount={filteredSubmissions.length}
              headings={[
                { title: "Preview" },
                { title: "Product" },
                { title: "Order" },
                { title: "Status" },
                { title: "Created Date" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>

      {/* Detail View Modal */}
      {selectedSubmission && (
        <Modal
          open={Boolean(selectedSubmission)}
          onClose={() => setSelectedSubmission(null)}
          title={`Customized Order: #${selectedSubmission.id.slice(-8)}`}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {/* Product & Order Information */}
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingMd">
                    {selectedSubmission.customizableProduct?.title || "Custom Product"}
                  </Text>
                  {selectedSubmission.shopifyOrderId ? (
                    <Button
                      variant="plain"
                      onClick={() => {
                        window.open(
                          `https://admin.shopify.com/store/${cleanShop}/orders/${selectedSubmission.shopifyOrderId}`,
                          "_blank"
                        );
                      }}
                    >
                      View Order #{selectedSubmission.shopifyOrderId} in Shopify Admin →
                    </Button>
                  ) : (
                    <Text as="span" tone="subdued" variant="bodySm">
                      No Shopify order linked yet (Pending cart checkout)
                    </Text>
                  )}
                </BlockStack>
                {getStatusBadge(selectedSubmission.status)}
              </InlineStack>

              <Divider />

              {/* Preview & Hi-Res Image */}
              <BlockStack gap="200" align="center">
                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={selectedSubmission.previewImageUrl}
                      alt="Design preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "350px",
                        objectFit: "contain",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                </Box>
                <InlineStack align="center">
                  <Button
                    variant="primary"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href =
                        selectedSubmission.hiResImageUrl || selectedSubmission.previewImageUrl;
                      link.download = `custom-design-${selectedSubmission.id}.png`;
                      link.target = "_blank";
                      link.click();
                    }}
                  >
                    {selectedSubmission.hiResImageUrl
                      ? "Download hi-res production image"
                      : "Download preview image"}
                  </Button>
                </InlineStack>
              </BlockStack>

              <Divider />

              {/* Customization Details List */}
              <BlockStack gap="200">
                <Text as="h4" variant="headingSm">
                  Customization Details
                </Text>
                {renderCustomizationSummary(selectedSubmission.designData)}
              </BlockStack>

              <Divider />

              {/* Status Update Controls */}
              <BlockStack gap="300">
                <Text as="h4" variant="headingSm">
                  Update Order Status
                </Text>
                <Grid columns={{ xs: 1, sm: 2 }}>
                  <Grid.Cell>
                    <Select
                      label="Current status"
                      options={[
                        { label: "Pending (Pre-order)", value: "PENDING" },
                        { label: "Ordered (In Queue)", value: "ORDERED" },
                        { label: "In Production (Making)", value: "IN_PRODUCTION" },
                        { label: "Completed (Fulfilled)", value: "COMPLETED" },
                      ]}
                      value={modalStatus}
                      onChange={setModalStatus}
                    />
                  </Grid.Cell>
                  <Grid.Cell>
                    <div style={{ marginTop: "24px" }}>
                      <Button
                        variant="primary"
                        loading={fetcher.state !== "idle"}
                        disabled={modalStatus === selectedSubmission.status}
                        onClick={() => {
                          fetcher.submit(
                            {
                              submissionId: selectedSubmission.id,
                              status: modalStatus,
                            },
                            { method: "POST" }
                          );
                        }}
                      >
                        Save Status
                      </Button>
                    </div>
                  </Grid.Cell>
                </Grid>
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
