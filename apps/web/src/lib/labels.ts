// Friendly labels for signup/checkout enum values shown in the admin UI.
// Keep the keys in sync with backend public.py (individual + enterprise pricing).

const PRODUCT_LABELS: Record<string, string> = {
  digital_only: "Digital only",
  none: "No hardware",
  tap_button: "Adhesive NFC TapButton",
  pvc_tapcard: "PVC NFC TapCard",
  keychain: "NFC Keychain",
  wood_tapcard: "Wood NFC TapCard",
  ring: "NFC Ring",
  metal_tapcard: "Metal NFC TapCard",
  premium_custom_metal: "Premium / Custom Metal",
  custom_design: "Custom Design",
  // Legacy values from earlier pricing.
  digital_card: "Digital Card (legacy)",
  physical_tap_card: "Physical Tap Card (legacy)",
  physical_tap_card_with_design: "Physical Tap Card + Design (legacy)",
  tap_button_for_phone: "Adhesive NFC TapButton (legacy)",
};

export function serviceInterestLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.startsWith("enterprise_")) {
    const product = value.slice("enterprise_".length);
    return `Enterprise · ${PRODUCT_LABELS[product] ?? product}`;
  }
  return PRODUCT_LABELS[value] ?? value;
}

const PLAN_LABELS: Record<string, string> = {
  essential_monthly: "Essential · $3.99/mo",
  essential_annual: "Essential Annual · $39/yr",
  enterprise_monthly: "Enterprise · Monthly",
  enterprise_annual: "Enterprise · Annual",
  // Legacy values from earlier pricing.
  basic_monthly: "Basic Monthly (legacy)",
  basic_yearly: "Basic Yearly (legacy)",
  pro_monthly: "Pro Monthly (legacy)",
  pro_yearly: "Pro Yearly (legacy)",
};

export function planInterestLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PLAN_LABELS[value] ?? value;
}
