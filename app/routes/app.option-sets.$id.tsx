import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Button,
  Text,
  Select,
  Checkbox,
  InlineStack,
  Divider,
  Box,
  Banner,
} from "@shopify/polaris";
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const optionSet = await prisma.optionSet.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
      },
      assignments: true,
    },
  });

  if (!optionSet) {
    throw new Response("Not Found", { status: 404 });
  }

  return { optionSet };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const title = formData.get("title") as string;
  const internalName = formData.get("internalName") as string;
  const optionsStr = formData.get("options") as string;
  const assignmentsStr = formData.get("assignments") as string;
  
  let options = [];
  let assignments = [];
  try {
    if (optionsStr) options = JSON.parse(optionsStr);
    if (assignmentsStr) assignments = JSON.parse(assignmentsStr);
  } catch(e) {}

  // Update OptionSet
  await prisma.optionSet.update({
    where: { id: params.id, shop: session.shop },
    data: {
      title,
      internalName,
      // Overwrite options by deleting old and recreating
      options: {
        deleteMany: {},
        create: options.map((opt: any, index: number) => ({
          name: opt.name || `Option ${index + 1}`,
          label: opt.label || `Option ${index + 1}`,
          type: opt.type || "TEXT",
          helpText: opt.helpText || "",
          required: !!opt.required,
          settings: JSON.stringify(opt.settings || {}),
          sortOrder: index,
        })),
      },
      assignments: {
        deleteMany: {},
        create: assignments.map((assignment: any) => ({
          type: assignment.type,
          targetId: assignment.targetId,
          isExclusion: !!assignment.isExclusion,
        }))
      }
    },
  });

  return { success: true };
};

export default function OptionSetBuilder() {
  const { optionSet } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const nav = useNavigation();

  const [title, setTitle] = useState(optionSet.title);
  const [internalName, setInternalName] = useState(optionSet.internalName || "");
  const [options, setOptions] = useState<any[]>(
    optionSet.options.map((o) => ({
      ...o,
      settings: JSON.parse(o.settings || "{}"),
    }))
  );
  const [assignments, setAssignments] = useState<any[]>(optionSet.assignments || []);

  const isSaving = nav.state === "submitting";

  const handleSave = () => {
    submit(
      {
        title,
        internalName,
        options: JSON.stringify(options),
        assignments: JSON.stringify(assignments),
      },
      { method: "post" }
    );
  };

  const addOption = () => {
    setOptions([
      ...options,
      {
        id: `new-${Date.now()}`,
        name: `option-${Date.now()}`,
        label: "New Option",
        type: "TEXT",
        required: false,
        helpText: "",
        settings: {},
      },
    ]);
  };

  const updateOption = (index: number, key: string, value: any) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const addAssignment = () => {
    setAssignments([
      ...assignments,
      { id: `new-${Date.now()}`, type: "ALL_PRODUCTS", targetId: "", isExclusion: false },
    ]);
  };

  const updateAssignment = (index: number, key: string, value: any) => {
    const newAssignments = [...assignments];
    newAssignments[index] = { ...newAssignments[index], [key]: value };
    setAssignments(newAssignments);
  };

  const removeAssignment = (index: number) => {
    const newAssignments = [...assignments];
    newAssignments.splice(index, 1);
    setAssignments(newAssignments);
  };

  const selectResource = async (index: number, resourceType: "product" | "collection") => {
    try {
      const selected = await window.shopify.resourcePicker({
        type: resourceType,
        action: "select",
        multiple: false,
      });

      if (selected && selected.length > 0) {
        updateAssignment(index, "targetId", selected[0].id);
      }
    } catch (e) {
      console.error("Resource picker error:", e);
    }
  };

  return (
    <Page
      backAction={{ content: "Option Sets", onAction: () => navigate("/app/option-sets") }}
      title={title || "Untitled Option Set"}
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Box paddingBlockEnd="400">
              <Banner tone="success">Option Set saved successfully.</Banner>
            </Box>
          )}

          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">General</Text>
                <TextField
                  label="Title (Public)"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                />
                <TextField
                  label="Internal Name"
                  value={internalName}
                  onChange={setInternalName}
                  autoComplete="off"
                  helpText="Only visible to you."
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Options</Text>
                  <Button onClick={addOption}>Add Option</Button>
                </InlineStack>
                <Divider />
                
                {options.length === 0 ? (
                  <Text as="p" tone="subdued">No options added yet.</Text>
                ) : (
                  options.map((opt, index) => (
                    <Box key={opt.id} padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingSm" as="h3">Option {index + 1}</Text>
                          <Button tone="critical" variant="plain" onClick={() => removeOption(index)}>
                            Remove
                          </Button>
                        </InlineStack>

                        <Layout>
                          <Layout.Section variant="oneHalf">
                            <TextField
                              label="Label"
                              value={opt.label}
                              onChange={(v) => updateOption(index, "label", v)}
                              autoComplete="off"
                            />
                          </Layout.Section>
                          <Layout.Section variant="oneHalf">
                            <Select
                              label="Type"
                              options={[
                                { label: "Text", value: "TEXT" },
                                { label: "Textarea", value: "TEXTAREA" },
                                { label: "Dropdown", value: "DROPDOWN" },
                                { label: "Radio Buttons", value: "RADIO" },
                                { label: "Checkbox", value: "CHECKBOX" },
                                { label: "File Upload", value: "FILE_UPLOAD" },
                                { label: "Color Swatch", value: "COLOR_SWATCH" },
                                { label: "Image Swatch", value: "IMAGE_SWATCH" },
                              ]}
                              value={opt.type}
                              onChange={(v) => updateOption(index, "type", v)}
                            />
                          </Layout.Section>
                          <Layout.Section variant="oneHalf">
                             <TextField
                              label="Name (Internal key)"
                              value={opt.name}
                              onChange={(v) => updateOption(index, "name", v)}
                              autoComplete="off"
                            />
                          </Layout.Section>
                           <Layout.Section variant="oneHalf">
                             <TextField
                              label="Help Text"
                              value={opt.helpText || ""}
                              onChange={(v) => updateOption(index, "helpText", v)}
                              autoComplete="off"
                            />
                          </Layout.Section>
                        </Layout>
                        
                        <Checkbox
                          label="Required"
                          checked={opt.required}
                          onChange={(v) => updateOption(index, "required", v)}
                        />

                        {["TEXT", "TEXTAREA", "FILE_UPLOAD"].includes(opt.type) && (
                          <Box paddingBlockStart="400">
                            <TextField
                              label="Additional Price"
                              type="number"
                              prefix="$"
                              value={opt.settings?.price || ""}
                              onChange={(v) => updateOption(index, "settings", { ...opt.settings, price: v })}
                              autoComplete="off"
                              helpText="Amount to add to the base product price."
                            />
                          </Box>
                        )}
                        
                        {["DROPDOWN", "RADIO", "CHECKBOX", "COLOR_SWATCH", "IMAGE_SWATCH"].includes(opt.type) && (
                          <Box paddingBlockStart="400">
                            <BlockStack gap="400">
                              <Text variant="headingSm" as="h4">Choices</Text>
                              {(opt.settings?.choices || []).map((choice: any, cIndex: number) => (
                                <InlineStack key={cIndex} gap="200" blockAlign="center" wrap={false}>
                                  <Box minWidth="200px">
                                    <TextField
                                      label="Choice Label"
                                      labelHidden
                                      placeholder="Label (e.g. Red)"
                                      value={choice.label || ""}
                                      onChange={(v) => {
                                        const newChoices = [...(opt.settings.choices || [])];
                                        newChoices[cIndex].label = v;
                                        newChoices[cIndex].value = v; 
                                        updateOption(index, "settings", { ...opt.settings, choices: newChoices });
                                      }}
                                      autoComplete="off"
                                    />
                                  </Box>
                                  <Box minWidth="120px">
                                    <TextField
                                      label="Price"
                                      labelHidden
                                      placeholder="Price"
                                      type="number"
                                      prefix="+$"
                                      value={choice.price || ""}
                                      onChange={(v) => {
                                        const newChoices = [...(opt.settings.choices || [])];
                                        newChoices[cIndex].price = v;
                                        updateOption(index, "settings", { ...opt.settings, choices: newChoices });
                                      }}
                                      autoComplete="off"
                                    />
                                  </Box>
                                  <Button tone="critical" variant="plain" onClick={() => {
                                    const newChoices = [...(opt.settings.choices || [])];
                                    newChoices.splice(cIndex, 1);
                                    updateOption(index, "settings", { ...opt.settings, choices: newChoices });
                                  }}>Remove</Button>
                                </InlineStack>
                              ))}
                              <div>
                                <Button onClick={() => {
                                  const newChoices = [...(opt.settings?.choices || [])];
                                  newChoices.push({ label: "", value: "", price: "" });
                                  updateOption(index, "settings", { ...opt.settings, choices: newChoices });
                                }}>Add Choice</Button>
                              </div>
                            </BlockStack>
                          </Box>
                        )}

                      </BlockStack>
                    </Box>
                  ))
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Product Assignments</Text>
                  <Button onClick={addAssignment}>Add Assignment</Button>
                </InlineStack>
                <Divider />
                
                {assignments.length === 0 ? (
                  <Text as="p" tone="subdued">Not assigned to any products.</Text>
                ) : (
                  assignments.map((assignment, index) => (
                    <Box key={assignment.id || index} padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingSm" as="h3">Assignment {index + 1}</Text>
                          <Button tone="critical" variant="plain" onClick={() => removeAssignment(index)}>
                            Remove
                          </Button>
                        </InlineStack>

                        <Layout>
                          <Layout.Section variant="oneThird">
                            <Select
                              label="Assign to"
                              options={[
                                { label: "All Products", value: "ALL_PRODUCTS" },
                                { label: "Specific Product", value: "PRODUCT" },
                                { label: "Collection", value: "COLLECTION" },
                                { label: "Tag", value: "TAG" },
                                { label: "Vendor", value: "VENDOR" },
                              ]}
                              value={assignment.type}
                              onChange={(v) => updateAssignment(index, "type", v)}
                            />
                          </Layout.Section>
                          <Layout.Section variant="oneThird">
                            {assignment.type !== "ALL_PRODUCTS" && (
                              <BlockStack gap="200">
                                <TextField
                                  label="Target (ID or Name)"
                                  value={assignment.targetId || ""}
                                  onChange={(v) => updateAssignment(index, "targetId", v)}
                                  autoComplete="off"
                                  helpText="Enter string manually or use the select button."
                                />
                                {assignment.type === "PRODUCT" && (
                                  <div>
                                    <Button onClick={() => selectResource(index, "product")}>Select Product</Button>
                                  </div>
                                )}
                                {assignment.type === "COLLECTION" && (
                                  <div>
                                    <Button onClick={() => selectResource(index, "collection")}>Select Collection</Button>
                                  </div>
                                )}
                              </BlockStack>
                            )}
                          </Layout.Section>
                          <Layout.Section variant="oneThird">
                            <Checkbox
                              label="Is Exclusion?"
                              checked={assignment.isExclusion}
                              onChange={(v) => updateAssignment(index, "isExclusion", v)}
                              helpText="If checked, removes this Option Set from the target."
                            />
                          </Layout.Section>
                        </Layout>
                      </BlockStack>
                    </Box>
                  ))
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
