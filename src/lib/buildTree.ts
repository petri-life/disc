import type { ThreadComment } from '../api/types'

export interface CommentNode extends ThreadComment {
  children: CommentNode[]
}

export function buildTree(comments: ThreadComment[]): CommentNode[] {
  const map = new Map<number, CommentNode>()
  const roots: CommentNode[] = []

  for (const c of comments) {
    map.set(c.comment_id, { ...c, children: [] })
  }

  for (const c of comments) {
    const node = map.get(c.comment_id)!
    if (c.parent_comment_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(c.parent_comment_id)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  }

  const sortByScore = (a: CommentNode, b: CommentNode) =>
    (b.sim_score + b.upvotes) - (a.sim_score + a.upvotes)

  roots.sort(sortByScore)
  for (const node of map.values()) {
    node.children.sort(sortByScore)
  }

  return roots
}
