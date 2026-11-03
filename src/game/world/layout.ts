// Street dimensions. The high street runs along X; the road is centred on z = 0.
export const ROAD_HALF = 6; // road edge / kerb line
export const FACADE = 10; // building frontage line
export const KERB_H = 0.15;
export const PLOT = 6;
export const STREET_X = 138; // buildings run from -138 to 138
export const PLAY_X = 86; // player can walk between -86 and 86
export const LANE_Z = 2.2; // traffic lanes; UK drives on the left, so eastbound uses z = -2.2
export const ZEBRA_X = 12;
export const BUS_STOP_X = -6;

export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number }

export const groundY = (z: number) => (Math.abs(z) > ROAD_HALF ? KERB_H : 0);

export interface LightSource {
  x: number; y: number; z: number;
  color: string;
  intensity: number;
  range: number;
  kind: "lamp" | "shop" | "neon" | "beacon";
  placeId?: string;
  pool?: number; // ground glow radius
  hours?: [number, number]; // only lit while open
}
