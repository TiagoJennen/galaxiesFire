import "@shopify/flash-list";

declare module "@shopify/flash-list" {
  interface FlashListProps<TItem> {
    /**
     * Schatting van de celhoogte in pixels, zodat FlashList sneller kan initialiseren.
     */
    estimatedItemSize?: number;
  }
}
