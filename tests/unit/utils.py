def strip_node_shape(node):
    # Drop display-only fields so the comparison checks structure + codes only.
    node.pop("nodeSvgShape", None)
    node.pop("range", None)
    if "meta" in node:
        node["meta"].pop("unbounded", None)
    for child in node["children"]:
        strip_node_shape(child)
    return node
