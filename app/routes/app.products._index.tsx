import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
            }
          }
        }
      }`,
    {
      variables: {
        first: 50,
      },
    }
  );

  const responseJson = await response.json();
  const shopifyProducts = responseJson.data?.products?.edges?.map((edge: any) => edge.node) || [];

  const customizableProducts = await prisma.customizableProduct.findMany({
    where: { shop: session.shop },
    select: {
      id: true,
      shopifyProductId: true,
      isActive: true,
    },
  });

  const configuredMap = new Map();
  customizableProducts.forEach((cp) => {
    configuredMap.set(cp.shopifyProductId, cp);
    const numericId = cp.shopifyProductId.split("/").pop();
    if (numericId) {
      configuredMap.set(numericId, cp);
    }
  });

  return {
    products: shopifyProducts.map((p: any) => {
      const numericId = p.id.split("/").pop() || p.id;
      const config = configuredMap.get(p.id) || configuredMap.get(numericId);
      return {
        id: p.id,
        numericId,
        title: p.title,
        handle: p.handle,
        imageUrl: p.featuredImage?.url || null,
        isCustomizable: Boolean(config && config.isActive),
        customizableProductId: config?.id || null,
      };
    }),
  };
};

export default function ProductsList() {
  const { products } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const rowMarkup = products.map(
    ({ id, numericId, title, imageUrl, isCustomizable }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Thumbnail
            source={
              imageUrl ||
              "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
            }
            alt={title}
            size="small"
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {isCustomizable ? (
            <Badge tone="success">Customizable</Badge>
          ) : (
            <Badge tone="info">Not set up</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            size="micro"
            onClick={() => navigate(`/app/products/${numericId}/customize`)}
          >
            {isCustomizable ? "Edit customizer" : "Set up customizer"}
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page>
      <TitleBar title="Products" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {products.length === 0 ? (
              <EmptyState
                heading="No products found in store"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add products to your Shopify store to set up customization options.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                headings={[
                  { title: "Image" },
                  { title: "Product" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
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
