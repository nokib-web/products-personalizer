import {
  Page,
  Layout,
  Card,
  IndexTable,
  Button,
  Text,
  Badge,
  useIndexResourceState,
  EmptyState,
  InlineStack,
  TextField,
  Select,
  Icon,
  Box,
  BlockStack,
  Thumbnail
} from "@shopify/polaris";
import { SearchIcon, PlusIcon, ImageIcon } from "@shopify/polaris-icons";
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const customizableProducts = await prisma.customizableProduct.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { options: true },
      },
    },
  });

  return { customizableProducts };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const newProduct = await prisma.customizableProduct.create({
      data: {
        shop: session.shop,
        title: "Untitled Product",
        shopifyProductId: "",
        mockupImageUrl: "",
      },
    });
    return redirect(`/app/single-product-options/${newProduct.id}`);
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await prisma.customizableProduct.delete({
      where: { id, shop: session.shop },
    });
    return null;
  }

  return null;
};

export default function CustomizableProductsIndex() {
  const { customizableProducts } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [sortValue, setSortValue] = useState("newest");

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(customizableProducts as any);

  const handleCreate = () => {
    submit({ intent: "create" }, { method: "post" });
  };

  const filteredProducts = customizableProducts.filter((product) => {
    if (searchValue && !product.title.toLowerCase().includes(searchValue.toLowerCase())) return false;
    if (statusValue !== "all") {
      const isActive = statusValue === "active";
      if (product.isActive !== isActive) return false;
    }
    return true;
  });

  const rowMarkup = filteredProducts.map(
    (
      { id, title, shopifyProductId, isActive, mockupImageUrl },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
        onClick={() => navigate(`/app/single-product-options/${id}`)}
      >
        <IndexTable.Cell>
          <Thumbnail
            source={mockupImageUrl || ImageIcon}
            size="small"
            alt={title}
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {isActive ? <Text tone="success" as="span">Active</Text> : <Text tone="subdued" as="span">Draft</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" wrap={false}>
            <Button
              size="micro"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/single-product-options/${id}`);
              }}
            >
              Edit
            </Button>
            <Button
              size="micro"
              tone="critical"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Are you sure you want to delete this configuration?")) {
                  submit({ intent: "delete", id }, { method: "post" });
                }
              }}
            >
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <Box padding="400">
      <InlineStack align="center" blockAlign="center">
        <Text variant="bodyMd" as="span" tone="subdued">
          No matching records found
        </Text>
      </InlineStack>
    </Box>
  );

  return (
    <Page title="Personalizer">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <BlockStack>
              <Box padding="400" paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <Box width="250px">
                      <TextField
                        label="Search By Name"
                        labelHidden
                        placeholder="Search By Name"
                        value={searchValue}
                        onChange={setSearchValue}
                        prefix={<Icon source={SearchIcon} />}
                        autoComplete="off"
                        clearButton
                        onClearButtonClick={() => setSearchValue("")}
                      />
                    </Box>
                    <Select
                      label="Status"
                      labelHidden
                      options={[
                        { label: "Status", value: "all" },
                        { label: "Active", value: "active" },
                        { label: "Draft", value: "draft" },
                      ]}
                      value={statusValue}
                      onChange={setStatusValue}
                    />
                    <Select
                      label="Sort"
                      labelHidden
                      options={[
                        { label: "Sort", value: "newest" },
                        { label: "Oldest", value: "oldest" },
                      ]}
                      value={sortValue}
                      onChange={setSortValue}
                    />
                  </InlineStack>
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <Button variant="primary" icon={PlusIcon} onClick={handleCreate}>
                      Search product to add option
                    </Button>
                  </InlineStack>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: "option", plural: "options" }}
                itemCount={filteredProducts.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                emptyState={emptyStateMarkup}
                headings={[
                  { title: "Product image" },
                  { title: "Product Name" },
                  { title: "Status" },
                  { title: "Action" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
