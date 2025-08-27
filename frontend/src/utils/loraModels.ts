// LoRA models with translated descriptions
export const getLoraModels = (t: (key: string) => string) => [
  {
    id: "leaked_nudes_style_v1_fixed",
    name: "Leaked amateur",
    description: t("loraModels.leakedAmateur"),
  },
  {
    id: "add-detail-xl",
    name: "Add detail XL",
    description: t("loraModels.addDetailXL"),
  },
  {
    id: "Harness_Straps_sdxl",
    name: "Harness, Straps, Garter and Cupless bra",
    description: t("loraModels.harnessStraps"),
  },
  {
    id: "Pierced_Nipples_XL_Barbell_Edition-000013",
    name: "Pierced Nipples",
    description: t("loraModels.piercedNipples"),
  },
  {
    id: "bdsm_SDXL_1_",
    name: "BDSM",
    description: t("loraModels.bdsm"),
  },
  {
    id: "Body Tattoo_alpha1.0_rank4_noxattn_last",
    name: "Body Tattoo",
    description: t("loraModels.bodyTattoo"),
  },
  {
    id: "Doggystyle anal XL",
    name: "Doggystyle Anal XL",
    description: t("loraModels.doggystyleAnal"),
  },
  {
    id: "orgasmface_SDXL",
    name: "Orgasm Face",
    description: t("loraModels.orgasmFace"),
  },
  {
    id: "RealDownblouseXLv3",
    name: "Real Downblouse XL",
    description: t("loraModels.realDownblouse"),
  },
  {
    id: "Sextoy_Dildo_Pussy_v2_XL",
    name: "Sextoy Dildo",
    description: t("loraModels.sextoyDildo"),
  },
  {
    id: "bread",
    name: "Anthropomorphisme",
    description: t("loraModels.bread"),
  },
];

// Helper function to get lora name by ID
export const getLoraNameById = (
  loraId: string,
  t: (translationKey: string) => string
): string => {
  const loraModels = getLoraModels(t);
  const lora = loraModels.find((model) => model.id === loraId);
  return lora?.name || loraId; // Fallback to ID if not found
};
