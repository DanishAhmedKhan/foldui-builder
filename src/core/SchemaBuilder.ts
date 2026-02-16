import { deepClone } from '../helper/deepClone'
import type { BuilderDocumentSchema, BuilderNode, NodeType } from '../types/NodeTypes'
import { HistoryManager } from './HistoryManager'

type AddInput =
    | string
    | {
          type: string
          props?: Record<string, any>
          style?: Record<string, any>
          responsive?: Record<string, any>
      }

export class SchemaBuilder {
    private history: HistoryManager<BuilderDocumentSchema>

    constructor() {
        const root = this.createNode({ type: 'fragment' })

        const schema: BuilderDocumentSchema = {
            rootId: root.id,
            nodes: {
                [root.id]: root,
            },
            selection: root.id,
        }

        this.history = new HistoryManager(schema)
    }

    private get schema(): BuilderDocumentSchema {
        return this.history.value
    }

    public getRootId(): string {
        return this.schema.rootId
    }

    public getNode(id: string): BuilderNode | undefined {
        return this.schema.nodes[id]
    }

    public getSchema(): BuilderDocumentSchema {
        return deepClone(this.schema)
    }

    public toRenderSchema(): NodeType {
        const { nodes, rootId } = this.schema

        const build = (id: string): NodeType => {
            const node = nodes[id]
            if (!node) throw new Error(`Node not found: ${id}`)

            return {
                id: node.id,
                type: node.type,
                props: node.props,
                style: node.style,
                responsive: node.responsive,
                children: node.children.map(build),
            }
        }

        return build(rootId)
    }

    public add(input: AddInput, extra?: Omit<BuilderNode, 'id' | 'parent' | 'children' | 'type'>) {
        const config = this.normalizeAddInput(input, extra)
        const node = this.createNode(config)

        return {
            into: (parentId: string, index?: number) => {
                const next = deepClone(this.schema)
                this.attach(node, parentId, index, next)
                this.history.push(next)
                return node.id
            },
        }
    }

    private normalizeAddInput(input: AddInput, extra?: Omit<BuilderNode, 'id' | 'parent' | 'children' | 'type'>) {
        if (typeof input === 'string') {
            return {
                type: input,
                props: extra?.props ?? {},
                style: extra?.style ?? {},
                responsive: extra?.responsive ?? {},
            }
        }

        return {
            type: input.type,
            props: input.props ?? {},
            style: input.style ?? {},
            responsive: input.responsive ?? {},
        }
    }

    public updateProps(nodeId: string, newProps: Record<string, any>) {
        const node = this.schema.nodes[nodeId]
        if (!node) throw new Error('Node not found')

        const next = deepClone(this.schema)

        next.nodes[nodeId].props = {
            ...next.nodes[nodeId].props,
            ...newProps,
        }

        this.history.push(next)
    }

    public updateStyle(nodeId: string, newStyle: Record<string, any>) {
        const node = this.schema.nodes[nodeId]
        if (!node) throw new Error('Node not found')

        const next = deepClone(this.schema)

        next.nodes[nodeId].style = {
            ...next.nodes[nodeId].style,
            ...newStyle,
        }

        this.history.push(next)
    }

    public updateResponsive(nodeId: string, newResponsive: Record<string, any>) {
        const node = this.schema.nodes[nodeId]
        if (!node) throw new Error('Node not found')

        const next = deepClone(this.schema)

        next.nodes[nodeId].responsive = {
            ...next.nodes[nodeId].responsive,
            ...newResponsive,
        }

        this.history.push(next)
    }

    public remove(nodeId: string) {
        if (nodeId === this.schema.rootId) return

        const next = deepClone(this.schema)
        this.removeInternal(nodeId, next)
        this.history.push(next)
    }

    public move(nodeId: string) {
        if (nodeId === this.schema.rootId) {
            throw new Error('Cannot move root node')
        }

        return {
            into: (newParentId: string, index?: number) => {
                const next = deepClone(this.schema)

                this.detach(nodeId, next)

                const node = next.nodes[nodeId]
                if (!node) throw new Error('Node not found')

                this.attach(node, newParentId, index, next)
                this.history.push(next)
            },
        }
    }

    public select(nodeId: string | null) {
        const next = deepClone(this.schema)
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

    public transaction(fn: () => void) {
        this.history.begin()

        try {
            fn()
            this.history.commit()
        } catch (err) {
            this.history.cancel()
            throw err
        }
    }

    private createNode(config: {
        type: string
        props?: Record<string, any>
        style?: Record<string, any>
        responsive?: Record<string, any>
    }): BuilderNode {
        return {
            id: crypto.randomUUID(),
            type: config.type,
            parent: null,
            children: [],
            props: config.props ?? {},
            style: config.style ?? {},
            responsive: config.responsive ?? {},
        }
    }

    private attach(node: BuilderNode, parentId: string, index: number | undefined, schema: BuilderDocumentSchema) {
        const parent = schema.nodes[parentId]
        if (!parent) throw new Error('Parent not found')

        if (!this.canAcceptChild(parent.type, node.type)) {
            throw new Error(`${parent.type} cannot contain ${node.type}`)
        }

        node.parent = parentId
        schema.nodes[node.id] = node

        if (index === undefined || index < 0 || index > parent.children.length) {
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

    private removeInternal(nodeId: string, schema: BuilderDocumentSchema) {
        const node = schema.nodes[nodeId]
        if (!node) return

        for (const childId of node.children) {
            this.removeInternal(childId, schema)
        }

        if (node.parent) {
            const parent = schema.nodes[node.parent]
            if (parent) {
                parent.children = parent.children.filter((id) => id !== nodeId)
            }
        }

        delete schema.nodes[nodeId]
    }

    private canAcceptChild(parentType: string, childType: string): boolean {
        if (parentType === 'text') return false

        if (parentType === 'list') {
            return childType === 'list-item'
        }

        if (parentType === 'list-item') {
            return childType === 'text' || childType === 'image'
        }

        return true
    }
}
