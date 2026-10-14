declare module 'gifenc' {
  export interface GIFEncoderOptions {
    auto?: boolean;
    initialCapacity?: number;
  }

  export interface WriteFrameOptions {
    palette?: number[][];
    delay?: number;
    repeat?: number;
    dispose?: number;
    transparent?: boolean;
    transparentIndex?: number;
  }

  export interface GIFEncoderInstance {
    writeFrame: (
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: WriteFrameOptions
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
    bytesView: () => Uint8Array;
    reset: () => void;
  }

  export function GIFEncoder(opts?: GIFEncoderOptions): GIFEncoderInstance;

  export function quantize(
    rgbaData: Uint8ClampedArray | Uint8Array | number[],
    maxColors: number,
    options?: any
  ): number[][];

  export function applyPalette(
    rgbaData: Uint8ClampedArray | Uint8Array | number[],
    palette: number[][],
    format?: string
  ): Uint8Array;

  export function snapColorsToPalette(
    palette: number[][],
    knownColors: number[][]
  ): number[][];
}
