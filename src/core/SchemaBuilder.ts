import { deepClone } from '../helper/deepClone'
import type { BuilderDocumentSchema, BuilderNode, NodeType } from '../types/NodeTypes'
import { HistoryManager } from './HistoryManager'
import { NodeSpec } from 'foldui'

type NodeField = keyof typeof NodeSpec.fields

type AddInput =
    | string
    | {
          type: string
          [key: string]: any
      }

export class SchemaBuilder {
    private history: HistoryManager<BuilderDocumentSchema>

    constructor() {
        const root = this.createNode({ type: 'fragment' })

        const schema: BuilderDocumentSchema = {
            rootId: root.id,
            nodes: { [root.id]: root },
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

            const result: any = {}

            for (const key of Object.keys(NodeSpec.fields) as NodeField[]) {
                if (key === 'children') continue
                result[key] = (node as any)[key]
            }

            result.children = node.children.map(build)

            return result
        }

        return build(rootId)
    }

    public add(input: AddInput) {
        const config = this.normalizeAddInput(input)
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

    private normalizeAddInput(input: AddInput) {
        if (typeof input === 'string') {
            return { type: input }
        }

        return input
    }

    public updateField(nodeId: string, field: NodeField, value: any) {
        if (!(field in NodeSpec.fields)) {
            throw new Error(`Invalid field "${field}"`)
        }

        const node = this.schema.nodes[nodeId]
        if (!node) throw new Error('Node not found')

        const next = deepClone(this.schema)
        ;(next.nodes[nodeId] as any)[field] = value

        this.history.push(next)
    }

    public patchField(nodeId: string, field: NodeField, patch: Record<string, any>) {
        if (!(field in NodeSpec.fields)) {
            throw new Error(`Invalid field "${field}"`)
        }

        const node = this.schema.nodes[nodeId]
        if (!node) throw new Error('Node not found')

        const next = deepClone(this.schema)

        ;(next.nodes[nodeId] as any)[field] = {
            ...(next.nodes[nodeId] as any)[field],
            ...patch,
        }

        this.history.push(next)
    }

    public patchPath(nodeId: string, path: string | (string | number)[], value: any) {
        const node = this.schema.nodes[nodeId]
        if (!node) throw new Error('Node not found')

        const normalizedPath = Array.isArray(path) ? path : path.split('.')

        const next = deepClone(this.schema)

        next.nodes[nodeId] = this.setDeepImmutable(next.nodes[nodeId], normalizedPath, value)

        this.history.push(next)
    }

    private setDeepImmutable(obj: any, path: (string | number)[], value: any): any {
        if (path.length === 0) return obj

        const [key, ...rest] = path

        const clone = Array.isArray(obj) ? [...obj] : { ...obj }

        if (rest.length === 0) {
            clone[key] = value
        } else {
            const currentChild = obj && obj[key] !== undefined ? obj[key] : {}
            clone[key] = this.setDeepImmutable(currentChild, rest, value)
        }

        return clone
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

    private createNode(config: { type: string; [key: string]: any }): BuilderNode {
        const node: any = {
            id: crypto.randomUUID(),
            parent: null,
            children: [],
        }

        for (const key in NodeSpec.defaults) {
            node[key] = deepClone((NodeSpec.defaults as any)[key])
        }

        for (const key in config) {
            node[key] = config[key]
        }

        return node
    }

    private attach(node: BuilderNode, parentId: string, index: number | undefined, schema: BuilderDocumentSchema) {
        const parent = schema.nodes[parentId]
        if (!parent) throw new Error('Parent not found')

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
}
