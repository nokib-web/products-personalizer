import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  Button,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const submissions = await prisma.designSubmission.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: {
      product: true,
    },
  });
  return { submissions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  if (intent === "delete") {
    const id = formData.get("id") as string;
    await prisma.designSubmission.delete({
      where: { id, shop: session.shop },
    });
  } else if (intent === "bulk_delete") {
    const ids = JSON.parse(formData.get("ids") as string);
    await prisma.designSubmission.deleteMany({
      where: { id: { in: ids }, shop: session.shop },
    });
  }

  return { success: true };
};

export default function SubmissionsIndex() {
  const { submissions } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(submissions);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this submission?")) {
      submit({ intent: "delete", id }, { method: "post" });
    }
  };

  const promotedBulkActions = [
    {
      content: "Delete submissions",
      onAction: () => {
        if (confirm("Are you sure you want to delete selected submissions?")) {
          submit(
            { intent: "bulk_delete", ids: JSON.stringify(selectedResources) },
            { method: "post" }
          );
        }
      },
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge tone="warning">Pending</Badge>;
      case "IN_PRODUCTION":
        return <Badge tone="info">In Production</Badge>;
      case "COMPLETED":
        return <Badge tone="success">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const rowMarkup = submissions.map(
    (
      { id, product, shopifyOrderId, status, previewImageUrl, createdAt },
      index
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <div style={{ padding: "4px 0" }}>
            <img 
              src={previewImageUrl} 
              alt="Design Preview" 
              style={{ width: "50px", height: "50px", objectFit: "contain", borderRadius: "4px", border: "1px solid #e2e8f0" }}
            />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {product?.title || "Unknown Product"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{shopifyOrderId || "Not attached to order"}</IndexTable.Cell>
        <IndexTable.Cell>{getStatusBadge(status)}</IndexTable.Cell>
        <IndexTable.Cell>{new Date(createdAt).toLocaleDateString()}</IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack align="end" gap="200">
            <Button onClick={() => navigate(`/app/submissions/${id}`)}>View</Button>
            <Button tone="critical" variant="plain" onClick={() => handleDelete(id)}>
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page title="Design Submissions">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {submissions.length === 0 ? (
              <EmptyState
                heading="No design submissions yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>When customers create designs on your storefront, they will appear here.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: "submission", plural: "submissions" }}
                itemCount={submissions.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                promotedBulkActions={promotedBulkActions}
                headings={[
                  { title: "Preview" },
                  { title: "Product" },
                  { title: "Order ID" },
                  { title: "Status" },
                  { title: "Date" },
                  { title: "Actions", alignment: "end" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
