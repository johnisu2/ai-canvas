export type ElementType = "text" | "qr" | "image" | "table" | "signature";

export interface CanvasElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    fieldName?: string;
    fieldValue?: string;
    script?: string;
    formula?: string;
    fontSize?: number;
    alignment?: "left" | "center" | "right";
    pageNumber: number;
    rotation?: number;
    // Metadata for specific configs (Table columns etc)
    metadata?: any;
}
