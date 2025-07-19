declare global {
  interface Window {
    L: typeof import("leaflet");
  }
}

// Basic Leaflet type declarations
declare namespace L {
  function map(element: string | HTMLElement, options?: MapOptions): Map;
  function tileLayer(
    urlTemplate: string,
    options?: TileLayerOptions
  ): TileLayer;
  function marker(latlng: LatLngExpression, options?: MarkerOptions): Marker;
  function divIcon(options: DivIconOptions): DivIcon;

  interface MapOptions {
    center?: LatLngExpression;
    zoom?: number;
    maxZoom?: number;
  }

  interface TileLayerOptions {
    attribution?: string;
    maxZoom?: number;
  }

  interface MarkerOptions {
    icon?: Icon | DivIcon;
  }

  interface DivIconOptions {
    html?: string;
    className?: string;
    iconSize?: PointExpression;
    iconAnchor?: PointExpression;
    popupAnchor?: PointExpression;
  }

  type LatLngExpression = [number, number] | LatLng;
  type PointExpression = [number, number] | Point;

  class Map {
    setView(center: LatLngExpression, zoom?: number): this;
    addLayer(layer: Layer): this;
    removeLayer(layer: Layer): this;
    remove(): this;
  }

  class Layer {
    addTo(map: Map): this;
  }

  class TileLayer extends Layer {}

  class Marker extends Layer {
    bindPopup(content: string, options?: PopupOptions): this;
  }

  class Icon {}
  class DivIcon extends Icon {}
  class LatLng {}
  class Point {}

  interface PopupOptions {
    maxWidth?: number;
    minWidth?: number;
  }
}

export {};
