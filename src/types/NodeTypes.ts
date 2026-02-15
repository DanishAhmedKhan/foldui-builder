export type NodeType = {
    id: string
    type: string
    props?: any
    style?: Record<string, any>
    responsive?: {
        [breakpoint: string]: {
            props?: Record<string, any>
            style?: Record<string, any>
        }
    }
    children: NodeType[]
}

export interface BuilderNode {
    id: string
    type: string
    parent: string | null
    children: string[]
    props?: any
    responsive?: {
        [breakpoint: string]: {
            props?: Record<string, any>
            style?: Record<string, any>
        }
    }
    style: Record<string, any>
}

export interface BuilderDocumentSchema {
    rootId: string
    nodes: Record<string, BuilderNode>
    selection: string | null
}
