/*
File objective: Utility functions for processing ComfyUI workflow nodes and calculating execution order
Auth: Used by generation service - no direct user auth required
Special notes:
- Ports workflow node sorting logic from comfyui_monitor.py
- Performs topological sort to determine execution order
- Extracts node titles from _meta.title or falls back to class_type
*/

import { ComfyUIWorkflow } from "@shared/templates/comfyui-workflow";

export interface WorkflowNode {
  nodeId: string;
  classType: string;
  nodeTitle: string;
  dependencies: string[];
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  totalNodes: number;
  currentNodeIndex: number;
  nodeOrder: string[];
}

/**
 * Extract and sort workflow nodes by execution order
 * Ported from comfyui_monitor.py get_sorted_workflow_nodes()
 */
export function getSortedWorkflowNodes(workflow: ComfyUIWorkflow): WorkflowNode[] {
  try {
    const nodes: WorkflowNode[] = [];
    const nodeDependencies: Record<string, string[]> = {};
    
    // First pass: collect all nodes and their input dependencies
    for (const [nodeId, nodeData] of Object.entries(workflow)) {
      if (typeof nodeData === 'object' && nodeData !== null && 'class_type' in nodeData) {
        const inputs = nodeData.inputs || {};
        const dependencies: string[] = [];
        
        // Find input dependencies (nodes that this node depends on)
        for (const [, inputValue] of Object.entries(inputs)) {
          if (Array.isArray(inputValue) && inputValue.length >= 2) {
            // Format: [node_id, output_slot] - this node depends on node_id
            const depNodeId = String(inputValue[0]);
            if (depNodeId in workflow) {
              dependencies.push(depNodeId);
            }
          }
        }
        
        const nodeInfo: WorkflowNode = {
          nodeId,
          classType: nodeData.class_type,
          nodeTitle: nodeData._meta?.title || nodeData.class_type,
          dependencies
        };
        
        nodes.push(nodeInfo);
        nodeDependencies[nodeId] = dependencies;
      }
    }
    
    // Topological sort to get execution order
    const sortedNodes: WorkflowNode[] = [];
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    
    // Define visitNode function
    const visitNode = (nodeId: string): void => {
      if (tempVisited.has(nodeId)) {
        // Circular dependency - use current order
        return;
      }
      if (visited.has(nodeId)) {
        return;
      }
      
      tempVisited.add(nodeId);
      
      // Visit dependencies first
      for (const depId of nodeDependencies[nodeId] || []) {
        if (depId in nodeDependencies) { // Ensure dependency exists
          visitNode(depId);
        }
      }
      
      tempVisited.delete(nodeId);
      visited.add(nodeId);
      
      // Find the node info and add to sorted list
      const nodeInfo = nodes.find(node => node.nodeId === nodeId);
      if (nodeInfo) {
        sortedNodes.push(nodeInfo);
      }
    };
    
    // Start with nodes that have no dependencies or are entry points
    const nodeIds = Object.keys(nodeDependencies).sort(); // Sort for consistency
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        visitNode(nodeId);
      }
    }
    
    console.log(`Sorted workflow with ${sortedNodes.length} nodes: ${sortedNodes.map(n => n.nodeId).join(' → ')}`);
    return sortedNodes;
    
  } catch (error) {
    console.error(`Failed to sort workflow nodes: ${error}`);
    
    // Return unsorted nodes as fallback
    const fallbackNodes: WorkflowNode[] = [];
    for (const [nodeId, nodeData] of Object.entries(workflow)) {
      if (typeof nodeData === 'object' && nodeData !== null && 'class_type' in nodeData) {
        fallbackNodes.push({
          nodeId,
          classType: nodeData.class_type,
          nodeTitle: nodeData._meta?.title || nodeData.class_type,
          dependencies: []
        });
      }
    }
    return fallbackNodes;
  }
}

/**
 * Create workflow data structure for storage and frontend consumption
 */
export function createWorkflowData(workflow: ComfyUIWorkflow): WorkflowData {
  const nodes = getSortedWorkflowNodes(workflow);
  
  return {
    nodes,
    totalNodes: nodes.length,
    currentNodeIndex: 0, // Start at first node
    nodeOrder: nodes.map(node => node.nodeId)
  };
}