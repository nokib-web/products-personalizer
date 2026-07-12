import React, { useState, useRef, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Select,
  Checkbox,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Divider,
  Box,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productId = params.id;

  if (!productId) {
    throw new Response("Product ID required", { status: 400 });
  }

  const fullShopifyId = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const response = await admin.graphql(
    `#graphql
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          featuredImage {
            url
          }
        }
      }`,
    {
      variables: { id: fullShopifyId },
    }
  );

  const responseJson = await response.json();
  const shopifyProduct = responseJson.data?.product;

  if (!shopifyProduct) {
    throw new Response("Product not found on Shopify", { status: 404 });
  }

  const numericId = shopifyProduct.id.split("/").pop() || productId;

  const customizableProduct = await prisma.customizableProduct.findFirst({
    where: {
      shop: session.shop,
      shopifyProductId: {
        in: [numericId, shopifyProduct.id],
      },
    },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return json({
    shopifyProduct: {
      id: shopifyProduct.id,
      numericId,
      title: shopifyProduct.title,
      imageUrl: shopifyProduct.featuredImage?.url || "",
    },
    customizableProduct: customizableProduct
      ? {
          id: customizableProduct.id,
          isActive: customizableProduct.isActive,
          mockupImageUrl: customizableProduct.mockupImageUrl,
          options: customizableProduct.options.map((opt) => ({
            id: opt.id,
            type: opt.type as "TEXT" | "IMAGE_UPLOAD" | "COLOR_PICKER" | "DROPDOWN",
            label: opt.label,
            required: opt.required,
            config: JSON.parse(opt.config || "{}"),
            printAreaX: opt.printAreaX,
            printAreaY: opt.printAreaY,
            printAreaWidth: opt.printAreaWidth,
            printAreaHeight: opt.printAreaHeight,
            sortOrder: opt.sortOrder,
          })),
        }
      : null,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const payloadStr = formData.get("payload") as string;

  if (!payloadStr) {
    return json({ error: "Missing payload data" }, { status: 400 });
  }

  try {
    const data = JSON.parse(payloadStr);
    const { shopifyProductId, title, mockupImageUrl, isActive, options } = data;

    let customizableProduct = await prisma.customizableProduct.findFirst({
      where: {
        shop: session.shop,
        shopifyProductId: {
          in: [shopifyProductId, `gid://shopify/Product/${shopifyProductId}`],
        },
      },
    });

    if (customizableProduct) {
      customizableProduct = await prisma.customizableProduct.update({
        where: { id: customizableProduct.id },
        data: {
          title,
          mockupImageUrl,
          isActive: Boolean(isActive),
        },
      });
    } else {
      customizableProduct = await prisma.customizableProduct.create({
        data: {
          shop: session.shop,
          shopifyProductId,
          title,
          mockupImageUrl,
          isActive: Boolean(isActive),
        },
      });
    }

    await prisma.customizationOption.deleteMany({
      where: { customizableProductId: customizableProduct.id },
    });

    if (Array.isArray(options) && options.length > 0) {
      await prisma.customizationOption.createMany({
        data: options.map((opt: any, index: number) => ({
          customizableProductId: customizableProduct!.id,
          type: opt.type || "TEXT",
          label: opt.label || `Option ${index + 1}`,
          required: Boolean(opt.required),
          config: JSON.stringify(opt.config || {}),
          printAreaX: Number(opt.printAreaX) || 0,
          printAreaY: Number(opt.printAreaY) || 0,
          printAreaWidth: Number(opt.printAreaWidth) || 150,
          printAreaHeight: Number(opt.printAreaHeight) || 150,
          sortOrder: index,
        })),
      });
    }

    return json({ success: true, message: "Customizer configuration saved successfully!" });
  } catch (err: any) {
    console.error("Failed to save customizer config:", err);
    return json({ error: err.message || "Failed to save configuration" }, { status: 500 });
  }
};

export interface OptionItem {
  id: string;
  type: "TEXT" | "IMAGE_UPLOAD" | "COLOR_PICKER" | "DROPDOWN";
  label: string;
  required: boolean;
  config: Record<string, any>;
  printAreaX: number;
  printAreaY: number;
  printAreaWidth: number;
  printAreaHeight: number;
  sortOrder: number;
}

export default function CustomizerBuilder() {
  const { shopifyProduct, customizableProduct } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [mockupImageUrl, setMockupImageUrl] = useState(
    customizableProduct?.mockupImageUrl || shopifyProduct.imageUrl || ""
  );
  const [isActive, setIsActive] = useState(customizableProduct?.isActive ?? true);
  const [options, setOptions] = useState<OptionItem[]>(
    customizableProduct?.options || [
      {
        id: "opt_1",
        type: "TEXT",
        label: "Custom Text",
        required: true,
        config: {
          fonts: ["Arial", "Courier New", "Georgia", "Times New Roman", "Verdana"],
          maxChars: 50,
          defaultFontSize: 24,
          defaultColor: "#000000",
        },
        printAreaX: 100,
        printAreaY: 100,
        printAreaWidth: 200,
        printAreaHeight: 80,
        sortOrder: 0,
      },
    ]
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    options.length > 0 ? options[0].id : null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    type: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const selectedOption = options.find((opt) => opt.id === selectedOptionId) || null;

  const handleAddOption = () => {
    const newId = `opt_${Date.now()}`;
    const newOption: OptionItem = {
      id: newId,
      type: "TEXT",
      label: `Option ${options.length + 1}`,
      required: false,
      config: {
        fonts: ["Arial", "Courier New", "Georgia", "Times New Roman", "Verdana"],
        maxChars: 50,
        defaultFontSize: 24,
        defaultColor: "#000000",
      },
      printAreaX: 50 + options.length * 20,
      printAreaY: 50 + options.length * 20,
      printAreaWidth: 180,
      printAreaHeight: 80,
      sortOrder: options.length,
    };
    setOptions([...options, newOption]);
    setSelectedOptionId(newId);
  };

  const handleRemoveOption = (id: string) => {
    const updated = options.filter((opt) => opt.id !== id);
    setOptions(updated);
    if (selectedOptionId === id) {
      setSelectedOptionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const updateOptionField = (id: string, field: keyof OptionItem, value: any) => {
    setOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== id) return opt;
        if (field === "type") {
          let newConfig = {};
          if (value === "TEXT") {
            newConfig = {
              fonts: ["Arial", "Courier New", "Georgia", "Times New Roman", "Verdana"],
              maxChars: 50,
              defaultFontSize: 24,
              defaultColor: "#000000",
            };
          } else if (value === "IMAGE_UPLOAD") {
            newConfig = { maxFileSizeMB: 10, maxWidth: 3000, maxHeight: 3000 };
          } else if (value === "COLOR_PICKER") {
            newConfig = { colors: ["#FF0000", "#00FF00", "#0000FF", "#000000", "#FFFFFF"] };
          } else if (value === "DROPDOWN") {
            newConfig = { choices: ["Choice 1", "Choice 2", "Choice 3"] };
          }
          return { ...opt, type: value, config: newConfig };
        }
        return { ...opt, [field]: value };
      })
    );
  };

  const updateOptionConfig = (id: string, configKey: string, value: any) => {
    setOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== id) return opt;
        return {
          ...opt,
          config: { ...opt.config, [configKey]: value },
        };
      })
    );
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    id: string,
    actionType: "move" | "resize"
  ) => {
    e.stopPropagation();
    setSelectedOptionId(id);
    const opt = options.find((o) => o.id === id);
    if (!opt) return;

    setDragState({
      id,
      type: actionType,
      startX: e.clientX,
      startY: e.clientY,
      origX: opt.printAreaX,
      origY: opt.printAreaY,
      origW: opt.printAreaWidth,
      origH: opt.printAreaHeight,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !containerRef.current) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      setOptions((prev) =>
        prev.map((opt) => {
          if (opt.id !== dragState.id) return opt;
          if (dragState.type === "move") {
            return {
              ...opt,
              printAreaX: Math.max(0, Math.round(dragState.origX + dx)),
              printAreaY: Math.max(0, Math.round(dragState.origY + dy)),
            };
          } else {
            return {
              ...opt,
              printAreaWidth: Math.max(40, Math.round(dragState.origW + dx)),
              printAreaHeight: Math.max(30, Math.round(dragState.origH + dy)),
            };
          }
        })
      );
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
      }
    };

    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  const handleSave = () => {
    const payload = {
      shopifyProductId: shopifyProduct.numericId,
      title: shopifyProduct.title,
      mockupImageUrl,
      isActive,
      options,
    };

    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    submit(formData, { method: "post" });
  };

  return (
    <Page>
      <TitleBar title={`Customize: ${shopifyProduct.title}`}>
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </TitleBar>

      <BlockStack gap="400">
        {actionData?.success && (
          <Banner tone="success" title="Success">
            <p>{actionData.message}</p>
          </Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical" title="Error">
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneHalf">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Mockup Image Setup
                  </Text>
                  <TextField
                    label="Mockup Image URL"
                    value={mockupImageUrl}
                    onChange={setMockupImageUrl}
                    autoComplete="off"
                    helpText="Paste the base mockup image URL that customers will design on top of."
                  />
                  <Checkbox
                    label="Active for customer customization on product page"
                    checked={isActive}
                    onChange={setIsActive}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Visual Print Area Canvas
                    </Text>
                    <Badge tone="info">Drag boxes to reposition, drag corner to resize</Badge>
                  </InlineStack>

                  <div
                    ref={containerRef}
                    style={{
                      position: "relative",
                      width: "100%",
                      minHeight: "450px",
                      border: "1px solid #c9cccf",
                      borderRadius: "8px",
                      overflow: "hidden",
                      backgroundColor: "#f4f6f8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      userSelect: "none",
                    }}
                  >
                    {mockupImageUrl ? (
                      <img
                        src={mockupImageUrl}
                        alt="Mockup"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <Text as="p" tone="subdued">
                        Enter a Mockup Image URL above to load the visual preview
                      </Text>
                    )}

                    {options.map((opt) => {
                      const isSelected = opt.id === selectedOptionId;
                      return (
                        <div
                          key={opt.id}
                          onMouseDown={(e) => handleMouseDown(e, opt.id, "move")}
                          style={{
                            position: "absolute",
                            left: `${opt.printAreaX}px`,
                            top: `${opt.printAreaY}px`,
                            width: `${opt.printAreaWidth}px`,
                            height: `${opt.printAreaHeight}px`,
                            border: isSelected
                              ? "2px solid #008060"
                              : "2px dashed #5c6ac4",
                            backgroundColor: isSelected
                              ? "rgba(0, 128, 96, 0.18)"
                              : "rgba(92, 106, 196, 0.12)",
                            cursor: "move",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px",
                            boxSizing: "border-box",
                            zIndex: isSelected ? 10 : 1,
                            transition: dragState?.id === opt.id ? "none" : "border 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: isSelected ? "#004c3f" : "#202e78",
                              textAlign: "center",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              pointerEvents: "none",
                            }}
                          >
                            {opt.label} ({opt.type})
                          </span>

                          {isSelected && (
                            <div
                              onMouseDown={(e) => handleMouseDown(e, opt.id, "resize")}
                              style={{
                                position: "absolute",
                                right: "-6px",
                                bottom: "-6px",
                                width: "14px",
                                height: "14px",
                                backgroundColor: "#008060",
                                border: "2px solid #ffffff",
                                borderRadius: "50%",
                                cursor: "se-resize",
                                zIndex: 20,
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Customization Options ({options.length})
                    </Text>
                    <Button onClick={handleAddOption} variant="primary">
                      Add Option
                    </Button>
                  </InlineStack>

                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack gap="200" wrap>
                      {options.map((opt) => (
                        <Button
                          key={opt.id}
                          size="small"
                          variant={opt.id === selectedOptionId ? "primary" : "secondary"}
                          onClick={() => setSelectedOptionId(opt.id)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </InlineStack>
                  </Box>

                  <Divider />

                  {selectedOption ? (
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Editing: {selectedOption.label}
                        </Text>
                        <Button
                          tone="critical"
                          size="micro"
                          onClick={() => handleRemoveOption(selectedOption.id)}
                        >
                          Remove Option
                        </Button>
                      </InlineStack>

                      <TextField
                        label="Label"
                        value={selectedOption.label}
                        onChange={(val) => updateOptionField(selectedOption.id, "label", val)}
                        autoComplete="off"
                      />

                      <Select
                        label="Option Type"
                        options={[
                          { label: "Text Field", value: "TEXT" },
                          { label: "Image Upload", value: "IMAGE_UPLOAD" },
                          { label: "Color Picker", value: "COLOR_PICKER" },
                          { label: "Dropdown Choice", value: "DROPDOWN" },
                        ]}
                        value={selectedOption.type}
                        onChange={(val) => updateOptionField(selectedOption.id, "type", val)}
                      />

                      <Checkbox
                        label="Required option"
                        checked={selectedOption.required}
                        onChange={(val) => updateOptionField(selectedOption.id, "required", val)}
                      />

                      <TextField
                        label="Option Price Add-on ($)"
                        type="number"
                        placeholder="0.00"
                        value={String(selectedOption.config?.priceAddon || "")}
                        onChange={(val) => updateOptionConfig(selectedOption.id, "priceAddon", Number(val))}
                        autoComplete="off"
                        helpText="Extra cost added when customer uses this customization option."
                      />

                      <Divider />

                      <Text as="h4" variant="headingSm">
                        Print Area Coordinates
                      </Text>
                      <InlineStack gap="300">
                        <Box width="20%">
                          <TextField
                            label="X (px)"
                            type="number"
                            value={String(selectedOption.printAreaX)}
                            onChange={(val) => updateOptionField(selectedOption.id, "printAreaX", Number(val))}
                            autoComplete="off"
                          />
                        </Box>
                        <Box width="20%">
                          <TextField
                            label="Y (px)"
                            type="number"
                            value={String(selectedOption.printAreaY)}
                            onChange={(val) => updateOptionField(selectedOption.id, "printAreaY", Number(val))}
                            autoComplete="off"
                          />
                        </Box>
                        <Box width="25%">
                          <TextField
                            label="Width (px)"
                            type="number"
                            value={String(selectedOption.printAreaWidth)}
                            onChange={(val) => updateOptionField(selectedOption.id, "printAreaWidth", Number(val))}
                            autoComplete="off"
                          />
                        </Box>
                        <Box width="25%">
                          <TextField
                            label="Height (px)"
                            type="number"
                            value={String(selectedOption.printAreaHeight)}
                            onChange={(val) => updateOptionField(selectedOption.id, "printAreaHeight", Number(val))}
                            autoComplete="off"
                          />
                        </Box>
                      </InlineStack>

                      <Divider />

                      <Text as="h4" variant="headingSm">
                        Type-Specific Configuration
                      </Text>

                      {selectedOption.type === "TEXT" && (
                        <BlockStack gap="300">
                          <TextField
                            label="Available Fonts (comma separated)"
                            value={(selectedOption.config.fonts || []).join(", ")}
                            onChange={(val) =>
                              updateOptionConfig(
                                selectedOption.id,
                                "fonts",
                                val.split(",").map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            autoComplete="off"
                          />
                          <InlineStack gap="300">
                            <Box width="48%">
                              <TextField
                                label="Max Characters"
                                type="number"
                                value={String(selectedOption.config.maxChars || 50)}
                                onChange={(val) =>
                                  updateOptionConfig(selectedOption.id, "maxChars", Number(val))
                                }
                                autoComplete="off"
                              />
                            </Box>
                            <Box width="48%">
                              <TextField
                                label="Default Font Size (px)"
                                type="number"
                                value={String(selectedOption.config.defaultFontSize || 24)}
                                onChange={(val) =>
                                  updateOptionConfig(selectedOption.id, "defaultFontSize", Number(val))
                                }
                                autoComplete="off"
                              />
                            </Box>
                          </InlineStack>
                        </BlockStack>
                      )}

                      {selectedOption.type === "IMAGE_UPLOAD" && (
                        <BlockStack gap="300">
                          <TextField
                            label="Max File Size (MB)"
                            type="number"
                            value={String(selectedOption.config.maxFileSizeMB || 10)}
                            onChange={(val) =>
                              updateOptionConfig(selectedOption.id, "maxFileSizeMB", Number(val))
                            }
                            autoComplete="off"
                          />
                          <InlineStack gap="300">
                            <Box width="48%">
                              <TextField
                                label="Max Width (px)"
                                type="number"
                                value={String(selectedOption.config.maxWidth || 3000)}
                                onChange={(val) =>
                                  updateOptionConfig(selectedOption.id, "maxWidth", Number(val))
                                }
                                autoComplete="off"
                              />
                            </Box>
                            <Box width="48%">
                              <TextField
                                label="Max Height (px)"
                                type="number"
                                value={String(selectedOption.config.maxHeight || 3000)}
                                onChange={(val) =>
                                  updateOptionConfig(selectedOption.id, "maxHeight", Number(val))
                                }
                                autoComplete="off"
                              />
                            </Box>
                          </InlineStack>
                        </BlockStack>
                      )}

                      {selectedOption.type === "COLOR_PICKER" && (
                        <BlockStack gap="300">
                          <TextField
                            label="Allowed Hex Colors (comma separated)"
                            value={(selectedOption.config.colors || []).join(", ")}
                            onChange={(val) =>
                              updateOptionConfig(
                                selectedOption.id,
                                "colors",
                                val.split(",").map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            autoComplete="off"
                            helpText="Example: #FF0000, #00FF00, #0000FF, #FFFFFF"
                          />
                        </BlockStack>
                      )}

                      {selectedOption.type === "DROPDOWN" && (
                        <BlockStack gap="300">
                          <TextField
                            label="Choices (comma separated)"
                            value={(selectedOption.config.choices || []).join(", ")}
                            onChange={(val) =>
                              updateOptionConfig(
                                selectedOption.id,
                                "choices",
                                val.split(",").map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            autoComplete="off"
                            helpText="Example: Small logo, Center chest, Back full print"
                          />
                        </BlockStack>
                      )}
                    </BlockStack>
                  ) : (
                    <Text as="p" tone="subdued">
                      Select or add an option above to configure its settings.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Save Changes
                  </Text>
                  <Button variant="primary" onClick={handleSave} loading={isSaving}>
                    Save Customizer Configuration
                  </Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
