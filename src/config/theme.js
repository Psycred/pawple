const GREEN_BRAND_SAGE = '#8FAF9B';
const GREEN_BRAND_SAGE_MUTED = '#A8C4B1';
const GREEN_BRAND_SAGE_LIGHT = '#E8F1EA';
const GREEN_BRAND_SAGE_DARK = '#6D8B74';
const GREEN_ACTION_PRIMARY = '#738F7F';
const GREEN_STATUS_SUCCESS = '#48BB78';
const GREEN_FEEDBACK_SUCCESS = '#7F9E8A';
const TEXT_INVERSE = '#FFFFFF';
const TEXT_PLACEHOLDER = '#9A9A9A';
const TEXT_MUTED_SPEC = '#7A7A7A';
const TEXT_SECONDARY_SPEC = '#6A6A6A';
const WARM_OVERLAY = '#F7EFE4';
const ICON_MUTED = '#A8A8A8';
const BRAND_SIGNATURE = '#BEB8B2';
const DANGER = '#FF4444';
const TAB_BAR_INACTIVE = '#8A94A6';

const lightColors = {
  background: '#F5F4F1',
  card: '#FBFAF8',
  text: {
    primary: '#2F2F2F',
    secondary: TEXT_SECONDARY_SPEC,
    muted: TEXT_MUTED_SPEC,
    inverse: TEXT_INVERSE,
  },
  brand: {
    sage: GREEN_BRAND_SAGE,
    sageMuted: GREEN_BRAND_SAGE_MUTED,
    sageLight: GREEN_BRAND_SAGE_LIGHT,
    sageDark: GREEN_BRAND_SAGE_DARK,
  },
  action: {
    primary: GREEN_ACTION_PRIMARY,
  },
  status: {
    success: GREEN_STATUS_SUCCESS,
  },
  accent: '#7B61FF',
  border: '#E2E8F0',
  error: '#F56565',
  warning: '#F6AD55',
  info: '#4299E1',
};

const darkColors = {
  background: '#1F1F1F',
  card: '#2A2A2A',
  text: {
    primary: '#EDEBE7',
    secondary: '#A0AEC0',
    muted: '#718096',
    inverse: TEXT_INVERSE,
  },
  brand: {
    sage: GREEN_BRAND_SAGE,
    sageMuted: GREEN_BRAND_SAGE_MUTED,
    sageLight: GREEN_BRAND_SAGE_LIGHT,
    sageDark: GREEN_BRAND_SAGE_DARK,
  },
  action: {
    primary: GREEN_ACTION_PRIMARY,
  },
  status: {
    success: GREEN_STATUS_SUCCESS,
  },
  accent: '#9F7AEA',
  border: '#4A5568',
  error: '#F56565',
  warning: '#F6AD55',
  info: '#63B3ED',
};

const theme = {
  colors: {
    light: lightColors,
    dark: darkColors,
    // Mode-first aliases to match screen-level usage.
    background: {
      light: lightColors.background,
      dark: darkColors.background,
      screen: '#F5F4F1',
      card: '#FBFAF8',
    },
    card: { light: lightColors.card, dark: darkColors.card },
    brand: {
      sage: {
        light: lightColors.brand.sage,
        dark: darkColors.brand.sage,
        value: GREEN_BRAND_SAGE,
      },
      sageMuted: {
        light: lightColors.brand.sageMuted,
        dark: darkColors.brand.sageMuted,
        value: GREEN_BRAND_SAGE_MUTED,
      },
      sageLight: {
        light: lightColors.brand.sageLight,
        dark: darkColors.brand.sageLight,
        value: GREEN_BRAND_SAGE_LIGHT,
      },
      sageDark: {
        light: lightColors.brand.sageDark,
        dark: darkColors.brand.sageDark,
        value: GREEN_BRAND_SAGE_DARK,
      },
    },
    action: {
      primary: {
        light: lightColors.action.primary,
        dark: darkColors.action.primary,
        value: GREEN_ACTION_PRIMARY,
      },
    },
    status: {
      success: {
        light: lightColors.status.success,
        dark: darkColors.status.success,
        value: GREEN_STATUS_SUCCESS,
      },
    },
    // Backward compatibility alias; prefer semantic brand/action tokens.
    primary: {
      light: lightColors.brand.sage,
      dark: darkColors.brand.sage,
    },
    accent: {
      light: lightColors.accent,
      dark: darkColors.accent,
      interaction: '#7B61FF',
      frame: '#7A4F46',
      warmOverlay: WARM_OVERLAY,
      sage: GREEN_BRAND_SAGE,
    },
    border: { light: lightColors.border, dark: darkColors.border },
    error: { light: lightColors.error, dark: darkColors.error },
    destructive: { light: lightColors.error, dark: darkColors.error },
    danger: { light: DANGER, dark: DANGER, value: DANGER },
    text: {
      primary: {
        light: lightColors.text.primary,
        dark: darkColors.text.primary,
        value: '#2F2F2F',
      },
      secondary: {
        light: lightColors.text.secondary,
        dark: darkColors.text.secondary,
        value: '#6A6A6A',
      },
      inverse: {
        light: lightColors.text.inverse,
        dark: darkColors.text.inverse,
        value: TEXT_INVERSE,
      },
      muted: {
        light: lightColors.text.muted,
        dark: darkColors.text.muted,
        value: TEXT_MUTED_SPEC,
      },
      signature: {
        light: BRAND_SIGNATURE,
        dark: BRAND_SIGNATURE,
        value: BRAND_SIGNATURE,
      },
    },
    icon: {
      muted: ICON_MUTED,
    },
    placeholder: {
      light: TEXT_PLACEHOLDER,
      dark: TEXT_PLACEHOLDER,
      value: TEXT_PLACEHOLDER,
    },
    feedback: {
      success: {
        light: GREEN_FEEDBACK_SUCCESS,
        dark: GREEN_FEEDBACK_SUCCESS,
        value: GREEN_FEEDBACK_SUCCESS,
      },
      error: {
        light: lightColors.error,
        dark: darkColors.error,
        value: lightColors.error,
      },
    },
    tabBar: {
      inactive: TAB_BAR_INACTIVE,
    },
  },
  fonts: {
    heading: 'Inter-Bold',
    body: 'Inter-Regular',
    medium: 'Inter-Medium',
    /** Handwritten captions only (feed + moment compose) — Kalam */
    caption: 'Kalam',
    feedCaptionHand: 'Kalam',
    mono: 'monospace',
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    /** Creation screen titles (meetup / moment) */
    creationTitle: 30,
    /** Meetup card date line (Inter-Medium 13 per spec) */
    timeMeta: 13,
  },
  fontWeights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  spacing: {
    grid: 8,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
    xxxxl: 64,
    /** Meetup card inner padding (spec) */
    meetupCard: 18,
  },
  borderRadius: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    /** Meetup cards (spec) */
    meetup: 18,
    /** Primary pill CTAs (meetup) */
    meetupCta: 22,
    full: 9999,
  },
  shadows: {
    none: 'none',
    sm: '0 1px 4px rgba(0,0,0,0.05)',
    md: '0 2px 8px rgba(0,0,0,0.08)',
    lg: '0 4px 16px rgba(0,0,0,0.12)',
    xl: '0 8px 24px rgba(0,0,0,0.16)',
  },
  components: {
    /** Dimmed overlay behind native-style bottom sheets (Moment hub, pet switcher, etc.). */
    bottomSheet: {
      backdrop: 'rgba(0,0,0,0.35)',
      /** Grabber dimensions set after `spacing` is defined (see below). */
      handleWidth: 0,
      handleHeight: 0,
      handleRadius: 0,
    },
    button: {
      primaryBg: GREEN_ACTION_PRIMARY,
      primaryText: TEXT_INVERSE,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      minHeight: 48,
    },
    input: {
      background: '#FBFAF8',
      border: '#E2E8F0',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 48,
    },
    card: {
      background: '#FBFAF8',
      borderRadius: 16,
      padding: 16,
      shadow: '0 2px 8px rgba(0,0,0,0.05)',
    },
    meetup: {
      /** Apple HIG minimum; meetup spec uses 44px CTAs */
      ctaMinHeight: 44,
      rsvpMinHeight: 44,
      compactChipFontSize: 11,
    },
    /** Create meetup title / directions field vertical padding (spec 14px; tokenized). */
    meetupForm: {
      fieldPaddingY: 14,
    },
    /** Create / capture moment form (Pawple spec). */
    captureMoment: {
      imagePickerBorder: '#D9D1C7',
      imagePickerBackground: '#FBFAF8',
      saveButtonHeight: 44,
      saveButtonRadius: 22,
      captionMinHeight: 80,
    },
  },
  /** Pet profile "Paw Frame" upload (Onboarding + future profile screens). */
  pawPhotoFrame: {
    frameSize: 150,
    photoDiameter: 100,
    /** (frameSize - photoDiameter) / 2 — centers the circle in the frame */
    photoInset: 25,
    watermarkOpacity: 0.12,
    photoBorderWidth: 3,
    photoBorderColor: '#FFFFFF',
  },
  /** Feed top shell + carousel (FeedScreen, EventCarousel, MeetupCard compact). */
  feed: {
    /** Calm top breathing room below safe area (pawple-ui-composition minimum 32px). */
    shellPaddingTop: 32,
    shellPaddingHorizontal: 24,
    shellPaddingBottom: 32,
    carouselCardWidthRatio: 0.85,
    carouselCardGap: 16,
    carouselSectionGap: 24,
    screenBackground: '#F5F4F1',
    cardBackground: '#FBFAF8',
    /** Premium postcard outer corner radius */
    cardRadius: 12,
    postcardRadius: 12,
    photoInnerRadius: 8,
    /** Postcard text rhythm (8pt grid) */
    imageToCaptionGap: 12,
    captionToPetGap: 8,
    petToMetaGap: 4,
    /** Apple "shelf" — space below metadata row to card edge */
    metaToBottomGap: 24,
    /** @deprecated use metaToBottomGap */
    contentFooterPaddingBottom: 24,
    postAspectRatio: 4 / 5,
    warmOverlayColor: WARM_OVERLAY,
    warmOverlayOpacity: 0.08,
    desaturateVeilColor: '#F0EEEA',
    desaturateVeilOpacity: 0.06,
    /** Image area share of 4:5 card (~88–90% height). */
    imageSectionFlexRatio: 0.88,
    textSectionFlexRatio: 0.12,
    /** @deprecated use imageSectionFlexRatio */
    imageDominanceRatio: 0.82,
    tonalSoftOpacity: 0.04,
    memoryFrameColor: '#7A4F46',
    memoryFrameOpacity: 0.75,
    memoryFrameStrokeWidth: 2,
    memoryTiltDegrees: -1.5,
    /** @deprecated use memoryFrame* */
    scrapbookFrameColor: '#7A4F46',
    scrapbookFrameOpacity: 0.75,
    scrapbookFrameStrokeWidth: 2,
    scrapbookTiltDegrees: -1.5,
    /** Gap between photo edge and outer hand-drawn frame (mat / page color shows through). */
    frameGap: 12,
    scrapbookPaperFill: '#FBFAF8',
    cardPaddingTop: 16,
    cardPaddingLeft: 16,
    cardPaddingRight: 16,
    cardPaddingBottom: 18,
    photoBottomSpacing: 20,
    contentInnerPaddingH: 2,
    printShadowOpacity: 0.05,
    shadowOpacity: 0.028,
    shadowRadius: 12,
    shadowOffsetY: 3,
    itemGap: 18,
    topSpacing: 12,
    bottomSafeMin: 34,
    postHorizontalInset: 16,
    actionRowMarginTop: 12,
    captionPetGap: 10,
    petMetaGap: 8,
    metaBrandGap: 14,
    /** @deprecated use cardPadding* */
    contentPaddingH: 16,
    contentPaddingBottom: 18,
    captionFontSize: 18,
    captionLineHeight: 22,
    captionColor: '#2F2F2F',
    petNameFontSize: 14,
    petNameLineHeight: 18,
    petNameColor: '#4A4A4A',
    metaFontSize: 11,
    metaLineHeight: 14,
    metaColor: TEXT_MUTED_SPEC,
    brandFontSize: 11,
    brandLetterSpacing: 0.3,
    brandColor: BRAND_SIGNATURE,
    brandOpacity: 1,
    actionIconColor: TEXT_SECONDARY_SPEC,
    likeColor: '#7B61FF',
    heartSize: 22,
    shareSize: 20,
    /** Full gentle heartbeat on first like (2 lub–dub cycles, ~3s) */
    likeAnimationMs: 3000,
    heartbeatLubDubCycles: 2,
    petBarHeight: 56,
    avatarSize: 32,
    meetupCarouselCardWidthRatio: 0.82,
    meetupCarouselCardGap: 12,
    momentBatchSizes: [7, 8, 9],
    /** @deprecated HomeScreen legacy */
    vignettePrimaryOpacity: 0.12,
    crayonBorder: '#8A3A3A',
    imageSectionFlex: 8,
    textSectionFlex: 2,
  },
  /** Create Moment — single-screen memory framing (spec). */
  createMoment: {
    screenBackground: '#F5F4F1',
    cardBackground: '#FBFAF8',
    cardRadius: 16,
    cardHorizontalInset: 40,
    imageSectionRatio: 0.83,
    annotationSectionRatio: 0.17,
    annotationFadedOpacity: 0.35,
    revealDurationMs: 250,
    headerPaddingTop: 24,
    screenPaddingH: 20,
    headerTitleSize: 16,
    headerTitleColor: '#2F2F2F',
    emptyLabelSize: 15,
    emptyLabelColor: '#7A7A7A',
    emptyIconColor: '#9A9A9A',
    captionFontSize: 18,
    captionColor: '#2F2F2F',
    /** Handwritten caption — Kalam (Nothing You Could Do / Caveat when added). */
    captionFontFamily: 'Kalam-Regular',
    petFontSize: 15,
    petColor: '#4A4A4A',
    petColorMuted: '#C8C4BE',
    metaFontSize: 12,
    metaColor: '#9A9A9A',
    metaPlaceholderColor: '#C8C4BE',
    brandFontSize: 11,
    brandColor: '#B7B0A5',
    placeholderFill: '#EDEAE4',
    cardShadowOpacity: 0.06,
    cardShadowRadius: 14,
    ctaHeight: 48,
    ctaRadius: 22,
    secondaryTextColor: '#7A7A7A',
  },
  /**
   * Create Moment — Step 1 foundation (Inter only, 8pt grid).
   * Hooks: `onCameraPress` / `onGalleryPress` wired in Step 2 (picker + framing).
   */
  createMomentFoundation: {
    screenBackground: '#F5F4F1',
    /** Page insets (beyond SafeArea). */
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    cardBackground: '#FBFAF8',
    cardRadius: 16,
    cardHorizontalInset: 40,
    cardShadowOpacity: 0.06,
    cardShadowRadius: 12,
    /** Empty state — superseded by keepsake tokens in screen until Step 2+. */
    emptyIconColor: '#7A4F46',
    emptyIconSize: 28,
    emptyLabelSize: 15,
    emptyLabelColor: '#8A7E74',
    emptyLabelMarginTop: 12,
    headerTitleSize: 16,
    headerTitleColor: '#2F2F2F',
    dismissHitPadding: 8,
    spacerWidth: 40,
    primarySage: '#8FAF9B',
    primaryBorderRadius: 22,
    primaryHeight: 44,
    primaryMarginTop: 24,
    primaryLabelSize: 16,
    galleryMarginTop: 14,
    galleryLabelSize: 14,
    galleryLabelColor: '#9A9A9A',
  },
  /** React Native shadow styles (theme.shadows.* strings are for web/CSS only). */
  shadowsRN: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    meetupCard: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1,
    },
  },
  breakpoints: {
    phone: 375,
    tablet: 768,
    desktop: 1024,
  },
};

// Composite typography for screens that need consistent headings / emphasis without breaking legacy `fonts.body` string.
theme.fonts.h2 = {
  fontFamily: theme.fonts.heading,
  fontSize: theme.fontSizes.xxl,
  lineHeight: Math.round(theme.fontSizes.xxl * theme.lineHeights.tight),
};
theme.fonts.semibold = 'Inter-SemiBold';
theme.fonts.bodySemibold = {
  fontFamily: theme.fonts.semibold,
  fontSize: theme.fontSizes.md,
  fontWeight: theme.fontWeights.semibold,
};
/** Feed post caption — Kalam (requires font in App.js useFonts). */
theme.fonts.feedCaption = {
  fontFamily: theme.fonts.feedCaptionHand,
  fontSize: theme.feed.captionFontSize,
  lineHeight: theme.feed.captionLineHeight,
  color: theme.feed.captionColor,
};
theme.fonts.feedPetName = {
  fontFamily: theme.fonts.medium,
  fontSize: theme.feed.petNameFontSize,
  lineHeight: theme.feed.petNameLineHeight,
  color: theme.feed.petNameColor,
};

// Bottom sheet grabber: derived from spacing so dimensions stay on-system.
theme.components.bottomSheet.handleWidth = theme.spacing.xxl + theme.spacing.sm;
theme.components.bottomSheet.handleHeight = theme.spacing.xs;
theme.components.bottomSheet.handleRadius = theme.spacing.xs / 2;

// Typography scale (pair with allowFontScaling on Text). Sizes align to spec + 8pt rhythm.
theme.fonts.scale = {
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
  },
  input: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
  },
  creationTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.creationTitle,
    lineHeight: Math.round(theme.fontSizes.creationTitle * theme.lineHeights.tight),
  },
  cardTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    lineHeight: Math.round(theme.fontSizes.lg * theme.lineHeights.tight),
  },
  dateTime: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.timeMeta,
    lineHeight: Math.round(theme.fontSizes.timeMeta * theme.lineHeights.normal),
  },
  chip: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,  // Fixed: was undefined theme.fontSizes.chip
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
  },
  helper: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    lineHeight: Math.round(theme.fontSizes.xs * theme.lineHeights.normal),
  },
  cta: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
  },
};

theme.opacity = {
  /** Pawple wordmark on meetup cards */
  signature: 0.68,
  /** Subtle pressed state for tappable rows */
  pressedUi: 0.88,
};

/** Consent rows, footers, disclaimers — Inter only (never Caveat). */
theme.fonts.legalDisclosure = {
  fontFamily: 'Inter-Regular',
  fontSize: theme.fontSizes.xs,
  color: theme.colors.text.muted.value,
  lineHeight: Math.round(theme.fontSizes.xs * theme.lineHeights.normal),
};

theme.fonts.legalLink = {
  fontFamily: 'Inter-Regular',
  fontSize: theme.fontSizes.xs,
  color: theme.colors.accent.interaction,
  textDecorationLine: 'underline',
};

/** Full legal document body (Terms / Privacy screens). */
theme.fonts.legalBody = {
  fontFamily: 'Inter-Regular',
  fontSize: theme.fontSizes.md,
  lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
  color: theme.colors.text.primary.value,
};

theme.fonts.legalSectionTitle = {
  fontFamily: 'Inter-Medium',
  fontSize: theme.fontSizes.md,
  lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
  color: theme.colors.text.primary.value,
};

theme.fonts.legalPageTitle = {
  fontFamily: 'Inter-SemiBold',
  fontSize: theme.fontSizes.creationTitle,
  lineHeight: Math.round(theme.fontSizes.creationTitle * theme.lineHeights.tight),
  color: theme.colors.text.primary.value,
};

export { theme };
export default theme;