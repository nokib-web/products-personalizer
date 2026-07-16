import type { LoaderFunctionArgs } from "@remix-run/node";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  BlockStack, 
  InlineStack,
  InlineGrid, 
  Button, 
  Box, 
  Divider,
  ProgressBar,
  Badge,
  Icon,
  Collapsible
} from "@shopify/polaris";
import { 
  PlayCircleIcon,
  QuestionCircleIcon,
  EmailIcon,
  ChatIcon,
  StatusActiveIcon
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const [optionSetCount] = await Promise.all([
    prisma.optionSet.count({ where: { shop: session.shop } })
  ]);

  return { optionSetCount };
};

export default function Index() {
  const { optionSetCount } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [faq1Open, setFaq1Open] = useState(false);
  const [faq2Open, setFaq2Open] = useState(false);

  const stepsCompleted = optionSetCount > 0 ? 1 : 0;
  const progress = (stepsCompleted / 2) * 100;

  return (
    <Page>
      <TitleBar title="Product Options" />
      <Layout>
        
        {/* Setup Guide */}
        <Layout.Section>
          <Card padding="500">
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Setup guide</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">Let's get started by following this guide</Text>
                </BlockStack>
                <Text as="p" variant="bodySm" tone="subdued">{stepsCompleted} / 2 completed</Text>
              </InlineStack>
              <ProgressBar progress={progress} size="small" tone="primary" />
              
              <Box paddingBlockStart="400">
                <BlockStack gap="400">
                  <InlineStack gap="400" wrap={false}>
                    <div style={{ opacity: optionSetCount > 0 ? 0.5 : 1 }}>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">Step 1: Create your first option set</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Start by creating a new set of product options or editing an existing one.</Text>
                        <InlineStack>
                          <Button onClick={() => navigate("/app/option-sets")} disabled={optionSetCount > 0}>Create option set</Button>
                        </InlineStack>
                      </BlockStack>
                    </div>
                  </InlineStack>

                  <Divider />

                  <InlineStack gap="400" wrap={false}>
                    <Box>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">Step 2: Make options visible on your storefront</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Enable the app from Shopify's Theme Editor to display your options on the storefront.</Text>
                        <InlineStack>
                          <Button onClick={() => window.open(`https://admin.shopify.com/store/current/themes/current/editor?context=apps`, "_blank")}>
                            Activate
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </InlineStack>

                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* App Status */}
        <Layout.Section>
          <InlineGrid gap="400" columns={2}>
            <Card padding="400">
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Text as="h3" variant="headingSm">App embed status</Text>
                  <Badge tone="info">Deactivated</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">To display options on your Online Store, you must enable app embed in your theme.</Text>
                <InlineStack>
                  <Button variant="primary" onClick={() => window.open(`https://admin.shopify.com/store/current/themes/current/editor?context=apps`, "_blank")}>Activate</Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">App blocks status</Text>
                <Text as="p" variant="bodyMd" tone="subdued">You have 0 active app block(s) on your store.</Text>
                <InlineStack>
                  <Button variant="primary" tone="critical" onClick={() => window.open(`https://admin.shopify.com/store/current/themes/current/editor?context=apps`, "_blank")}>Add app block</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Creation Options */}
        <Layout.Section>
          <InlineGrid gap="400" columns={2}>
            <Card padding="400">
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <InlineStack gap="200">
                    <Icon source={StatusActiveIcon} tone="base" />
                    <Text as="h3" variant="headingMd">Option set – Recommended</Text>
                  </InlineStack>
                  <Button variant="primary" onClick={() => navigate("/app/option-sets")}>Create option set</Button>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Add options to multiple products at once by creating an <strong>Option Set</strong>.<br/>
                  Ideal when many products share the same options — you only need to create it once, making future management much easier.
                  <br/><br/>
                  Recommended for: Bulk management, consistency.
                </Text>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <InlineStack gap="200">
                    <Icon source={StatusActiveIcon} tone="base" />
                    <Text as="h3" variant="headingMd">Single product options</Text>
                  </InlineStack>
                  <Button variant="primary" onClick={() => navigate("/app/single-product-options")}>Add options to a single product</Button>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Select a specific product and add custom options just for it.<br/><br/>
                  This method works best for unique products that require options different from the rest of your store.
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Statistics */}
        <Layout.Section>
          <Card padding="400">
            <BlockStack gap="400">
              <InlineStack>
                <Button variant="tertiary" icon={StatusActiveIcon}>Last 7 Days</Button>
              </InlineStack>
              <Divider />
              <InlineGrid columns={3}>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Total sales</Text>
                  <Text as="p" variant="headingXl">0.00 USD</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Total orders</Text>
                  <Text as="p" variant="headingXl">0</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Total products</Text>
                  <Text as="p" variant="headingXl">0</Text>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Video Tutorial */}
        <Layout.Section>
          <Card padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h3" variant="headingMd">Video tutorial</Text>
                <Button variant="plain" icon={QuestionCircleIcon}>FAQ</Button>
              </InlineStack>
              
              <InlineGrid gap="400" columns={2}>
                <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                  <InlineStack gap="400" wrap={false}>
                    <img src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png" width="60" alt="Video thumb"/>
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">How to create and publish an Option Set</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Learn how to use add on fields to charge extra for custom options.</Text>
                      <InlineStack>
                        <Button variant="plain" icon={PlayCircleIcon}>Watch video</Button>
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>
                </Box>
                
                <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                  <InlineStack gap="400" wrap={false}>
                    <img src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png" width="60" alt="Video thumb"/>
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">How to create conditional logic options</Text>
                      <Text as="p" variant="bodySm" tone="subdued">In this video, we'll guide you how to show or hide any option based on values.</Text>
                      <InlineStack>
                        <Button variant="plain" icon={PlayCircleIcon}>Watch video</Button>
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>
                </Box>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Need Help */}
        <Layout.Section>
          <Card padding="400">
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">Need help or customizations?</Text>
              
              <InlineGrid gap="400" columns={3}>
                <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack gap="200">
                      <Icon source={EmailIcon} tone="base" />
                      <Text as="p" variant="bodyMd" tone="base">Get email support</Text>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">Email us and we'll get back to you as soon as possible.</Text>
                  </BlockStack>
                </Box>
                <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack gap="200">
                      <Icon source={ChatIcon} tone="base" />
                      <Text as="p" variant="bodyMd" tone="base">Contact us</Text>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">Contact us to get help with your question.</Text>
                  </BlockStack>
                </Box>
                <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack gap="200">
                      <Icon source={QuestionCircleIcon} tone="base" />
                      <Text as="p" variant="bodyMd" tone="base">Help docs</Text>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">Find a solution for your problem with documents and tutorials.</Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              <Divider />
              
              <BlockStack gap="200">
                <div onClick={() => setFaq1Open(!faq1Open)} style={{ cursor: "pointer" }}>
                  <Box paddingBlock="200">
                    <InlineStack align="space-between">
                      <Text as="h4" variant="bodyMd">Why does the option not appear on my product detail page?</Text>
                      <Text as="span" variant="bodyMd">{faq1Open ? "▲" : "▼"}</Text>
                    </InlineStack>
                  </Box>
                </div>
                <Collapsible open={faq1Open} id="faq-1" transition={{ duration: "500ms", timingFunction: "ease-in-out" }}>
                  <Box padding="200" background="bg-surface-secondary">
                    <Text as="p" variant="bodyMd">Make sure you have activated the app blocks in your Theme Editor and that the product is included in the assignment rules.</Text>
                  </Box>
                </Collapsible>
                <Divider />

                <div onClick={() => setFaq2Open(!faq2Open)} style={{ cursor: "pointer" }}>
                  <Box paddingBlock="200">
                    <InlineStack align="space-between">
                      <Text as="h4" variant="bodyMd">How to change the position of the option set?</Text>
                      <Text as="span" variant="bodyMd">{faq2Open ? "▲" : "▼"}</Text>
                    </InlineStack>
                  </Box>
                </div>
                <Collapsible open={faq2Open} id="faq-2" transition={{ duration: "500ms", timingFunction: "ease-in-out" }}>
                  <Box padding="200" background="bg-surface-secondary">
                    <Text as="p" variant="bodyMd">You can change the position by going to Online Store &gt; Themes &gt; Customize, and dragging the App Block to your desired position.</Text>
                  </Box>
                </Collapsible>
                <Divider />
                
                <Box paddingBlockStart="200">
                  <InlineStack align="center">
                    <Button variant="plain" url="#">View more faq</Button>
                  </InlineStack>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        
      </Layout>
    </Page>
  );
}
