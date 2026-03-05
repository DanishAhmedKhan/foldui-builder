export interface BuilderNode {
    id: string
    type: string
    parent: string | null
    children: string[]
    [key: string]: any
}

export interface BuilderDocumentSchema {
    rootId: string
    nodes: Record<string, BuilderNode>
    selection: string | null
}
