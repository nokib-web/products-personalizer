import {
  Page,
  Layout,
  Card,
  IndexTable,
  Button,
  Text,
  InlineStack,
  TextField,
  Select,
  Icon,
  Box,
  BlockStack,
} from "@shopify/polaris";
import { SearchIcon, PlusIcon } from "@shopify/polaris-icons";
import { type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { priceRules: [] };
};

export default function GlobalPriceRuleIndex() {
  const { priceRules } = useLoaderData<typeof loader>();
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [sortValue, setSortValue] = useState("newest");

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
                    <Button variant="primary" icon={PlusIcon} onClick={() => {}}>
                      Global Discount
                    </Button>
                    <Button variant="primary" icon={PlusIcon} onClick={() => {}}>
                      Market adjustment
                    </Button>
                  </InlineStack>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: "price rule", plural: "price rules" }}
                itemCount={priceRules.length}
                selectedItemsCount={0}
                onSelectionChange={() => {}}
                emptyState={emptyStateMarkup}
                headings={[
                  { title: "Name" },
                  { title: "Priority" },
                  { title: "Type" },
                  { title: "Status" },
                  { title: "Action" },
                ]}
              >
                {[]}
              </IndexTable>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
