import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  InlineStack,
  TextField,
  Select,
  Checkbox,
  Box,
  BlockStack,
  Tabs,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const defaultSettings = {
  // Basic setting
  widgetPosition: "below_variants",
  showQuickView: false,
  takeOverAddToCart: false,
  hideBuyItNow: false,
  showConfirmation: false,
  updateProductPrice: false,
  allowDeselection: true,
  advancedDropdown: false,
  hideDisabledValues: false,
  oneValuePerLine: true,
  hideRequiredIcon: false,
  showQuantityInput: false,
  
  // Text (language) settings
  textAddToCart: "ADD TO CART",
  textAdding: "Adding...",
  textAdded: "Added!",
  textRequired: "Required",
  textOptionLimit: "Option limit reached",
  textPleaseSelect: "Please select an option",
  textTotalPrice: "Total Price",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const appSetting = await prisma.appSetting.findUnique({
    where: { shop: session.shop },
  });

  let settings = defaultSettings;
  if (appSetting && appSetting.settings) {
    try {
      settings = { ...defaultSettings, ...JSON.parse(appSetting.settings) };
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const settingsJson = formData.get("settings") as string;
  
  await prisma.appSetting.upsert({
    where: { shop: session.shop },
    update: {
      settings: settingsJson,
    },
    create: {
      shop: session.shop,
      settings: settingsJson,
    },
  });

  return json({ success: true });
};

export default function SettingsPage() {
  const { settings: initialSettings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [settings, setSettings] = useState(initialSettings);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedSecondaryTab, setSelectedSecondaryTab] = useState(0);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );

  const handleSecondaryTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedSecondaryTab(selectedTabIndex),
    [],
  );

  const handleSave = () => {
    const formData = new FormData();
    formData.append("settings", JSON.stringify(settings));
    submit(formData, { method: "post" });
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: "setting", content: "Setting" },
    { id: "text", content: "Text" },
    { id: "style", content: "Style" },
    { id: "custom-code", content: "Custom code" },
  ];

  const secondaryTabs = [
    { id: "basic-setting", content: "Basic setting" },
    { id: "variant", content: "Variant" },
    { id: "font-files", content: "Font files" },
    { id: "image-swatch", content: "Image swatch" },
    { id: "volume-discount", content: "Volume discount" },
    { id: "sku-weight", content: "Sku & weight" },
    { id: "checkout", content: "Checkout" },
    { id: "other-setting", content: "Other setting" },
  ];

  const renderPreview = () => (
    <Box background="bg-surface" borderRadius="200" borderColor="border" borderWidth="025">
       <Box padding="400" paddingBlockEnd="200">
          <Text variant="headingMd" as="h3">Preview</Text>
       </Box>
       <Box padding="400" style={{ maxHeight: "800px", overflowY: "auto" }}>
         <BlockStack gap="400">
            {/* Preview inputs */}
            <InlineStack gap="400" wrap={false}>
              <Box width="50%">
                <TextField label="Single line text" value="" onChange={()=>{}} placeholder="Your text" autoComplete="off" helpText="This is help text" />
              </Box>
              <Box width="50%">
                <TextField label="Number" value="" onChange={()=>{}} placeholder="Your number" autoComplete="off" />
              </Box>
            </InlineStack>
            
            <TextField label="Multi-line text" value="" onChange={()=>{}} placeholder="Your message" multiline={3} autoComplete="off" />

            <Select label="Dropdown" options={[{label: "-- Please choose --", value: ""}]} value="" onChange={()=>{}} />

            <BlockStack gap="200">
              <Text variant="bodyMd" as="span" fontWeight="medium">Radio button</Text>
              <BlockStack gap="100">
                {[1, 2].map((i) => (
                  <Checkbox key={`radio-${i}`} label={`Option ${i}`} checked={false} onChange={()=>{}} />
                ))}
              </BlockStack>
            </BlockStack>
            
            <Box paddingBlockStart="400">
              <Button size="large" fullWidth>{settings.textAddToCart}</Button>
            </Box>
            <InlineStack align="end">
               <Text variant="bodySm" tone="subdued" as="span">Powered by Personalizer</Text>
            </InlineStack>
         </BlockStack>
       </Box>
    </Box>
  );

  return (
    <Page 
      title="Personalizer" 
      fullWidth
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Box paddingBlockEnd="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} fitted />
      </Box>

      {selectedTab === 0 && (
        <BlockStack gap="400">
          <Card padding="0">
            <Tabs tabs={secondaryTabs} selected={selectedSecondaryTab} onSelect={handleSecondaryTabChange} fitted />
          </Card>

          {selectedSecondaryTab === 0 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="600">
                    <Text variant="headingMd" as="h3">
                      Basic setting
                    </Text>

                    <BlockStack gap="400">
                      <Select
                        label="Position of widget"
                        options={[{ label: "Below product variants", value: "below_variants" }, { label: "Above add to cart button", value: "above_cart" }]}
                        value={settings.widgetPosition}
                        onChange={(v) => updateSetting("widgetPosition", v)}
                        helpText="If use app block in theme editor, this setting will be invalid and the app will appear in the inserted app block."
                      />
                      <Checkbox label="Show options on quick view & other pages" checked={settings.showQuickView} onChange={(v) => updateSetting("showQuickView", v)} />
                      <Checkbox label="Take over add to cart button" checked={settings.takeOverAddToCart} onChange={(v) => updateSetting("takeOverAddToCart", v)} />
                      <Checkbox label="Hide buy it now button on product page" checked={settings.hideBuyItNow} onChange={(v) => updateSetting("hideBuyItNow", v)} />
                      <Checkbox label="Show confirmation before adding to cart" checked={settings.showConfirmation} onChange={(v) => updateSetting("showConfirmation", v)} />
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="400">
                      <Text variant="headingSm" as="h4">Product page</Text>
                      <Checkbox label="Update Product Price based on selected options" checked={settings.updateProductPrice} onChange={(v) => updateSetting("updateProductPrice", v)} />
                      <Checkbox label="Allow deselection for single-choice options" checked={settings.allowDeselection} onChange={(v) => updateSetting("allowDeselection", v)} />
                      <Checkbox label="Use app's advanced dropdown UI" checked={settings.advancedDropdown} onChange={(v) => updateSetting("advancedDropdown", v)} />
                      <Checkbox label="Hide option values disabled by conditions" checked={settings.hideDisabledValues} onChange={(v) => updateSetting("hideDisabledValues", v)} />
                      <Checkbox label="One value per line (Radio & Checkbox)" checked={settings.oneValuePerLine} onChange={(v) => updateSetting("oneValuePerLine", v)} />
                      <Checkbox label="Hide required field icon(*)" checked={settings.hideRequiredIcon} onChange={(v) => updateSetting("hideRequiredIcon", v)} />
                      <Checkbox label="Show quantity input box on product page" checked={settings.showQuantityInput} onChange={(v) => updateSetting("showQuantityInput", v)} />
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                {renderPreview()}
              </Layout.Section>
            </Layout>
          )}
        </BlockStack>
      )}

      {selectedTab === 1 && (
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="600">
                <Text variant="headingMd" as="h3">
                  Text Settings (Translations)
                </Text>

                <BlockStack gap="400">
                  <TextField 
                    label="Add to cart button text" 
                    value={settings.textAddToCart} 
                    onChange={(v) => updateSetting("textAddToCart", v)} 
                    autoComplete="off" 
                  />
                  <TextField 
                    label="Adding to cart text" 
                    value={settings.textAdding} 
                    onChange={(v) => updateSetting("textAdding", v)} 
                    autoComplete="off" 
                  />
                  <TextField 
                    label="Added to cart text" 
                    value={settings.textAdded} 
                    onChange={(v) => updateSetting("textAdded", v)} 
                    autoComplete="off" 
                  />
                  <TextField 
                    label="Required field error" 
                    value={settings.textRequired} 
                    onChange={(v) => updateSetting("textRequired", v)} 
                    autoComplete="off" 
                  />
                  <TextField 
                    label="Option limit reached" 
                    value={settings.textOptionLimit} 
                    onChange={(v) => updateSetting("textOptionLimit", v)} 
                    autoComplete="off" 
                  />
                  <TextField 
                    label="Please select an option prompt" 
                    value={settings.textPleaseSelect} 
                    onChange={(v) => updateSetting("textPleaseSelect", v)} 
                    autoComplete="off" 
                  />
                  <TextField 
                    label="Total Price label" 
                    value={settings.textTotalPrice} 
                    onChange={(v) => updateSetting("textTotalPrice", v)} 
                    autoComplete="off" 
                  />
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {renderPreview()}
          </Layout.Section>
        </Layout>
      )}
    </Page>
  );
}
