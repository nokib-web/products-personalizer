import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Layout, Card, Text, BlockStack, Button } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="Product Customizer App" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Welcome to Product Customizer App
              </Text>
              <Text as="p" variant="bodyMd">
                Configure customizable products, define print areas, and manage custom text, image uploads, color pickers, and dropdown options for your customers.
              </Text>
              <div>
                <Button variant="primary" url="/app/products">
                  Manage Customizable Products
                </Button>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
