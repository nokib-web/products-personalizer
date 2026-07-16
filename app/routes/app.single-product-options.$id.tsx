import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  Select,
  Checkbox,
  InlineStack,
  Box,
  Divider,
  Icon,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigate, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (id === "new") {
    return { customizableProduct: null };
  }

  const customizableProduct = await prisma.customizableProduct.findUnique({
    where: { id, shop: session.shop },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!customizableProduct) {
    throw new Response("Configuration not found", { status: 404 });
  }

  return { customizableProduct };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const shopifyProductId = formData.get("shopifyProductId") as string;
  const mockupImageUrl = formData.get("mockupImageUrl") as string;
  const isActive = formData.get("isActive") === "true";
  const optionsJson = formData.get("options") as string;

  const options = JSON.parse(optionsJson || "[]");

  if (id === "new") {
    // Note: Creating via 'new' is not strictly used if we create a draft from index first,
    // but handled here just in case.
    const newConfig = await prisma.customizableProduct.create({
      data: {
        shop: session.shop,
        title,
        shopifyProductId,
        mockupImageUrl,
        isActive,
        options: {
          create: options.map((opt: any, index: number) => ({
            type: opt.type,
            label: opt.label,
            required: !!opt.required,
            config: typeof opt.config === 'string' ? opt.config : JSON.stringify(opt.config || {}),
            printAreaX: Number(opt.printAreaX) || 0,
            printAreaY: Number(opt.printAreaY) || 0,
            printAreaWidth: Number(opt.printAreaWidth) || 200,
            printAreaHeight: Number(opt.printAreaHeight) || 200,
            sortOrder: index,
          })),
        },
      },
    });
    return redirect(`/app/single-product-options/${newConfig.id}`);
  }

  await prisma.customizableProduct.update({
    where: { id, shop: session.shop },
    data: {
      title,
      shopifyProductId,
      mockupImageUrl,
      isActive,
      options: {
        deleteMany: {},
        create: options.map((opt: any, index: number) => ({
          type: opt.type,
          label: opt.label,
          required: !!opt.required,
          config: typeof opt.config === 'string' ? opt.config : JSON.stringify(opt.config || {}),
          printAreaX: Number(opt.printAreaX) || 0,
          printAreaY: Number(opt.printAreaY) || 0,
          printAreaWidth: Number(opt.printAreaWidth) || 200,
          printAreaHeight: Number(opt.printAreaHeight) || 200,
          sortOrder: index,
        })),
      },
    },
  });

  return { success: true };
};

export default function CustomizableProductEdit() {
  const { customizableProduct } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isSaving = navigation.state === "submitting";

  const [title, setTitle] = useState(customizableProduct?.title || "");
  const [shopifyProductId, setShopifyProductId] = useState(customizableProduct?.shopifyProductId || "");
  const [mockupImageUrl, setMockupImageUrl] = useState(customizableProduct?.mockupImageUrl || "");
  const [isActive, setIsActive] = useState(customizableProduct?.isActive ?? true);
  
  const initialOptions = customizableProduct?.options.map(opt => ({
    ...opt,
    config: opt.config ? JSON.parse(opt.config) : {}
  })) || [];
  
  const [options, setOptions] = useState<any[]>(initialOptions);

  const handleSave = () => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("shopifyProductId", shopifyProductId);
    formData.append("mockupImageUrl", mockupImageUrl);
    formData.append("isActive", String(isActive));
    formData.append("options", JSON.stringify(options));
    submit(formData, { method: "post" });
  };

  const addOption = () => {
    setOptions([
      ...options,
      {
        id: `new-${Date.now()}`,
        type: "TEXT",
        label: "New Option",
        required: false,
        config: {},
        printAreaX: 0,
        printAreaY: 0,
        printAreaWidth: 200,
        printAreaHeight: 200,
      },
    ]);
  };

  const updateOption = (index: number, field: string, value: any) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const selectProduct = async () => {
    try {
      const selected = await window.shopify.resourcePicker({
        type: 'product',
        action: 'select',
        multiple: false,
      });

      if (selected && selected.length > 0) {
        // App bridge v4 returns GID
        setShopifyProductId(selected[0].id);
      }
    } catch (e) {
      console.error("Resource picker error:", e);
    }
  };

  return (
    <Page
      backAction={{ content: "Option", onAction: () => navigate("/app/single-product-options") }}
      title="Edit option"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h2">{title || "Untitled Product"}</Text>
              <InlineStack gap="300" blockAlign="center">
                <Select
                  label="Status"
                  labelHidden
                  options={[
                    { label: "Active", value: "true" },
                    { label: "Draft", value: "false" },
                  ]}
                  value={String(isActive)}
                  onChange={(v) => setIsActive(v === "true")}
                />
                <Button icon={PlusIcon} variant="plain" accessibilityLabel="Duplicate" />
              </InlineStack>
            </InlineStack>

            <InlineStack gap="400">
              <Box
                padding="400"
                borderColor="border-disabled"
                borderWidth="025"
                borderRadius="200"
                borderStyle="dashed"
                background="bg-surface-secondary"
                width="100%"
              >
                <Button variant="primary" fullWidth size="large" onClick={addOption}>
                  <InlineStack gap="200" align="center" blockAlign="center">
                    <Icon source={PlusIcon} />
                    <Text as="span" fontWeight="medium">Add option</Text>
                  </InlineStack>
                </Button>
              </Box>
              <Box
                padding="400"
                borderColor="border-disabled"
                borderWidth="025"
                borderRadius="200"
                borderStyle="dashed"
                background="bg-surface-secondary"
                width="100%"
              >
                <Button variant="primary" fullWidth size="large" tone="critical">
                  <InlineStack gap="200" align="center" blockAlign="center">
                    <Icon source={PlusIcon} />
                    <Text as="span" fontWeight="medium">Add option set</Text>
                  </InlineStack>
                </Button>
              </Box>
            </InlineStack>

            {options.map((option, index) => (
              <Box key={option.id} padding="400" borderColor="border" borderWidth="025" borderRadius="200" background="bg-surface">
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingSm" as="h3">Option {index + 1}</Text>
                    <Button tone="critical" variant="plain" onClick={() => removeOption(index)}>Remove</Button>
                  </InlineStack>
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        label="Option Name"
                        value={option.label}
                        onChange={(v) => updateOption(index, "label", v)}
                        autoComplete="off"
                      />
                      <Select
                        label="Type"
                        options={[
                          { label: "Text", value: "TEXT" },
                          { label: "Image Upload", value: "IMAGE_UPLOAD" },
                        ]}
                        value={option.type}
                        onChange={(v) => updateOption(index, "type", v)}
                      />
                    </FormLayout.Group>
                  </FormLayout>
                </BlockStack>
              </Box>
            ))}

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">Settings & Connection</Text>
                <FormLayout>
                  <TextField
                    label="Configuration Title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                  />
                  <InlineStack align="start" blockAlign="center" gap="400">
                    <div style={{ flexGrow: 1 }}>
                      <TextField
                        label="Shopify Product ID"
                        value={shopifyProductId}
                        onChange={setShopifyProductId}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ marginTop: '24px' }}>
                      <Button onClick={selectProduct}>Select Product</Button>
                    </div>
                  </InlineStack>
                  <TextField
                    label="Mockup Image URL"
                    value={mockupImageUrl}
                    onChange={setMockupImageUrl}
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Box background="bg-surface-secondary" borderRadius="300" padding="400">
            <BlockStack gap="600">
              <Text variant="headingMd" as="h3">Preview</Text>
              
              <InlineStack gap="400" align="start" wrap={false}>
                <Box width="40%">
                  {mockupImageUrl ? (
                    <img
                      src={mockupImageUrl}
                      alt="Mockup Preview"
                      style={{ width: "100%", borderRadius: "8px", aspectRatio: "1/1", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "1/1", background: "#e1e3e5", borderRadius: "8px" }} />
                  )}
                </Box>
                
                <Box width="60%">
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h4">{title || "Product Name"}</Text>
                    <BlockStack gap="100">
                      <div style={{ height: "12px", background: "#e1e3e5", borderRadius: "4px", width: "100%" }} />
                      <div style={{ height: "12px", background: "#e1e3e5", borderRadius: "4px", width: "80%" }} />
                      <div style={{ height: "12px", background: "#e1e3e5", borderRadius: "4px", width: "40%" }} />
                    </BlockStack>
                    
                    <Box paddingBlockStart="400">
                      <div style={{ border: "1px solid #000", padding: "12px", textAlign: "center", borderRadius: "4px", background: "#fff" }}>
                        <Text as="span" fontWeight="bold">ADD TO CART</Text>
                      </div>
                    </Box>
                    <InlineStack align="end">
                      <Text variant="bodySm" tone="subdued" as="span">Powered by Personalizer</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
