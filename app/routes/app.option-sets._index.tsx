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
  BlockStack
} from "@shopify/polaris";
import { SearchIcon, PlusIcon } from "@shopify/polaris-icons";
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const optionSets = await prisma.optionSet.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { options: true, assignments: true },
      },
    },
  });

  return { optionSets };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const newOptionSet = await prisma.optionSet.create({
      data: {
        shop: session.shop,
        title: "Untitled Option Set",
      },
    });
    return redirect(`/app/option-sets/${newOptionSet.id}`);
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await prisma.optionSet.delete({
      where: { id, shop: session.shop },
    });
    return null;
  }

  return null;
};

export default function OptionSetsIndex() {
  const { optionSets } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [sortValue, setSortValue] = useState("newest");

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(optionSets as any);

  const handleCreate = () => {
    submit({ intent: "create" }, { method: "post" });
  };

  const filteredOptionSets = optionSets.filter((os) => {
    if (searchValue && !os.title.toLowerCase().includes(searchValue.toLowerCase())) return false;
    if (statusValue !== "all") {
      const isActive = statusValue === "active";
      if (os.isActive !== isActive) return false;
    }
    return true;
  });

  const rowMarkup = filteredOptionSets.map(
    (
      { id, title, isActive, _count },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
        onClick={() => navigate(`/app/option-sets/${id}`)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {_count.assignments > 0 ? `${_count.assignments} products` : "0 products"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            -
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
                navigate(`/app/option-sets/${id}`);
              }}
            >
              Edit
            </Button>
            <Button
              size="micro"
              tone="critical"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Are you sure you want to delete this option set?")) {
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
                    <Button variant="primary" tone="critical" onClick={() => {}}>
                      Sync option sets from other stores
                    </Button>
                    <Button variant="primary" icon={PlusIcon} onClick={handleCreate}>
                      Add option set
                    </Button>
                  </InlineStack>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: "option set", plural: "option sets" }}
                itemCount={filteredOptionSets.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                emptyState={emptyStateMarkup}
                headings={[
                  { title: "Name" },
                  { title: "Products" },
                  { title: "Customers" },
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
