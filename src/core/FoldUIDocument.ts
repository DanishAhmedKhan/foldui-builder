import { UndoRedoManager } from '../core/UndoRedoManager'
import type { BuilderDocumentSchema, BuilderNode } from '../types/builderNodes'
import type { NodeType } from '../types/nodes'

export class FoldUIDocument {
    // private schema: BuilderDocumentSchema
    private history: UndoRedoManager<BuilderDocumentSchema>

    constructor() {
        const root = this.createNode('fragment')

        const schema: BuilderDocumentSchema = {
            rootId: root.id,
            nodes: {
                [root.id]: root,
            },
            selection: root.id,
        }

        this.history = new UndoRedoManager(schema)
    }

    private get schema(): BuilderDocumentSchema {
        return this.history.value
    }

    public getRootId() {
        return this.schema.rootId
    }

    public getNode(id: string): BuilderNode | undefined {
        return this.schema.nodes[id]
    }

    public getSchema(): BuilderDocumentSchema {
        return structuredClone(this.schema)
    }

    public toRenderSchema(): NodeType {
        const { nodes, rootId } = this.schema

        const build = (id: string): NodeType => {
            const node = nodes[id]
            if (!node) {
                throw new Error(`Node not found: ${id}`)
            }

            const { parent, children, ...rest } = node

            return {
                ...rest,
                id: node.id,
                children: children.map(build),
            } as NodeType
        }

        return build(rootId)
    }

    public add(type: NodeType['type'], props?: any) {
        const node = this.createNode(type, props)

        return {
            into: (parentId: string, index?: number) => {
                const next = structuredClone(this.schema)
                this.attach(node, parentId, index, next)
                this.history.push(next)
                return node.id
            },
        }
    }

    public remove(nodeId: string) {
        if (nodeId === this.schema.rootId) return

        const next = structuredClone(this.schema)
        this.removeInternal(nodeId, next)
        this.history.push(next)
    }

    public move(nodeId: string) {
        return {
            into: (newParentId: string, index?: number) => {
                const next = structuredClone(this.schema)
                this.detach(nodeId, next)
                const node = next.nodes[nodeId]
                this.attach(node, newParentId, index, next)
                this.history.push(next)
            },
        }
    }

    private createNode(type: NodeType['type'], props?: any): BuilderNode {
        return {
            id: crypto.randomUUID(),
            type,
            parent: null,
            children: [],
            props,
            style: {},
        } as BuilderNode
    }

    private removeInternal(nodeId: string, schema: BuilderDocumentSchema) {
        const node = schema.nodes[nodeId]
        if (!node) return

        node.children.forEach((childId) => this.removeInternal(childId, schema))

        const parent = node.parent ? schema.nodes[node.parent] : null
        if (parent) {
            parent.children = parent.children.filter((id) => id !== nodeId)
        }

        delete schema.nodes[nodeId]
    }

    private attach(node: BuilderNode, parentId: string, index: number | undefined, schema: BuilderDocumentSchema) {
        const parent = schema.nodes[parentId]
        if (!parent) {
            throw new Error('Parent not found')
        }

        if (!this.canAcceptChild(parent.type, node.type)) {
            throw new Error(`${parent.type} cannot contain ${node.type}`)
        }

        node.parent = parentId
        schema.nodes[node.id] = node

        if (index === undefined) {
            parent.children.push(node.id)
        } else {
            parent.children.splice(index, 0, node.id)
        }
    }

    private detach(nodeId: string, schema: BuilderDocumentSchema) {
        const node = schema.nodes[nodeId]
        if (!node || !node.parent) return

        const parent = schema.nodes[node.parent]
        if (!parent) return

        parent.children = parent.children.filter((id) => id !== nodeId)
        node.parent = null
    }

    private canAcceptChild(parentType: NodeType['type'], childType: NodeType['type']): boolean {
        if (parentType === 'text') return false

        if (parentType === 'list') {
            return childType === 'list-item'
        }

        if (parentType === 'list-item') {
            return childType === 'text' || childType === 'image'
        }

        return true
    }

    public select(nodeId: string | null) {
        const next = structuredClone(this.schema)
        next.selection = nodeId
        this.history.push(next)
    }

    public getSelection(): string | null {
        return this.schema.selection
    }

    public undo(): boolean {
        return this.history.undo() !== null
    }

    public redo(): boolean {
        return this.history.redo() !== null
    }
}
