export type CommentTreeRecord = {
  id: string;
  parentId: string | null;
};

export type CommentTreeNode<T extends CommentTreeRecord> = T & {
  replies: CommentTreeNode<T>[];
};

export function buildCommentTree<T extends CommentTreeRecord>(
  comments: T[],
): CommentTreeNode<T>[] {
  const nodes = new Map<string, CommentTreeNode<T>>();

  for (const comment of comments) {
    nodes.set(comment.id, {
      ...comment,
      replies: [],
    });
  }

  const roots: CommentTreeNode<T>[] = [];

  for (const comment of comments) {
    const node = nodes.get(comment.id);

    if (!node) {
      continue;
    }

    if (comment.parentId) {
      const parent = nodes.get(comment.parentId);

      if (parent) {
        parent.replies.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  return roots;
}

export function findCommentNode<T extends CommentTreeRecord>(
  nodes: CommentTreeNode<T>[],
  commentId: string,
): CommentTreeNode<T> | null {
  for (const node of nodes) {
    if (node.id === commentId) {
      return node;
    }

    const found = findCommentNode(node.replies, commentId);

    if (found) {
      return found;
    }
  }

  return null;
}

export function buildCommentPath<T extends CommentTreeRecord>(
  nodes: CommentTreeNode<T>[],
  commentId: string,
): CommentTreeNode<T>[] {
  const path: CommentTreeNode<T>[] = [];

  function walk(branch: CommentTreeNode<T>[]): boolean {
    for (const node of branch) {
      path.push(node);

      if (node.id === commentId) {
        return true;
      }

      if (walk(node.replies)) {
        return true;
      }

      path.pop();
    }

    return false;
  }

  return walk(nodes) ? path : [];
}
