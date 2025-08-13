#!/usr/bin/env python3
"""
Test script for ComfyUI monitor workflow sorting functionality
"""

import json
import sys
import os

# Simplified test without importing the full module
# Just test the sorting algorithm logic

def get_sorted_workflow_nodes(workflow):
    """Extracted and simplified workflow sorting logic for testing"""
    try:
        nodes = []
        node_dependencies = {}
        
        # First pass: collect all nodes and their input dependencies
        for node_id, node_data in workflow.items():
            if isinstance(node_data, dict) and "class_type" in node_data:
                inputs = node_data.get("inputs", {})
                dependencies = []
                
                # Find input dependencies (nodes that this node depends on)
                for input_key, input_value in inputs.items():
                    if isinstance(input_value, list) and len(input_value) >= 2:
                        # Format: [node_id, output_slot] - this node depends on node_id
                        dep_node_id = str(input_value[0])
                        if dep_node_id in workflow:
                            dependencies.append(dep_node_id)
                
                node_info = {
                    "nodeId": node_id,
                    "classType": node_data["class_type"],
                    "nodeTitle": node_data.get("_meta", {}).get("title", node_data["class_type"]),
                    "dependencies": dependencies
                }
                nodes.append(node_info)
                node_dependencies[node_id] = dependencies
        
        # Topological sort to get execution order
        sorted_nodes = []
        visited = set()
        temp_visited = set()
        
        def visit_node(node_id):
            if node_id in temp_visited:
                # Circular dependency - use current order
                return
            if node_id in visited:
                return
            
            temp_visited.add(node_id)
            
            # Visit dependencies first
            for dep_id in node_dependencies.get(node_id, []):
                if dep_id in node_dependencies:  # Ensure dependency exists
                    visit_node(dep_id)
            
            temp_visited.remove(node_id)
            visited.add(node_id)
            
            # Find the node info and add to sorted list
            for node in nodes:
                if node["nodeId"] == node_id:
                    sorted_nodes.append(node)
                    break
        
        # Start with nodes that have no dependencies or are entry points
        node_ids = list(node_dependencies.keys())
        for node_id in sorted(node_ids):  # Sort for consistency
            if node_id not in visited:
                visit_node(node_id)
        
        print(f"Sorted workflow with {len(sorted_nodes)} nodes: {[n['nodeId'] for n in sorted_nodes]}")
        return sorted_nodes
        
    except Exception as e:
        print(f"Failed to sort workflow nodes: {e}")
        # Return unsorted nodes as fallback
        fallback_nodes = []
        for node_id, node_data in workflow.items():
            if isinstance(node_data, dict) and "class_type" in node_data:
                fallback_nodes.append({
                    "nodeId": node_id,
                    "classType": node_data["class_type"],
                    "nodeTitle": node_data.get("_meta", {}).get("title", node_data["class_type"]),
                    "dependencies": []
                })
        return fallback_nodes

# Mock workflow data for testing
MOCK_WORKFLOW = {
    "1": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "text": "test prompt",
            "clip": ["2", 0]
        },
        "_meta": {
            "title": "Positive Prompt"
        }
    },
    "2": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {
            "ckpt_name": "model.safetensors"
        },
        "_meta": {
            "title": "Load Checkpoint"
        }
    },
    "3": {
        "class_type": "KSampler",
        "inputs": {
            "seed": 42,
            "steps": 20,
            "model": ["2", 0],
            "positive": ["1", 0],
            "negative": ["4", 0]
        },
        "_meta": {
            "title": "K-Sampler"
        }
    },
    "4": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "text": "negative prompt",
            "clip": ["2", 0]
        },
        "_meta": {
            "title": "Negative Prompt"
        }
    },
    "5": {
        "class_type": "VAEDecode",
        "inputs": {
            "samples": ["3", 0],
            "vae": ["2", 2]
        },
        "_meta": {
            "title": "VAE Decoder"
        }
    }
}

def test_workflow_sorting():
    """Test the workflow sorting algorithm"""
    print("🧪 Testing ComfyUI workflow sorting...")
    
    # Test workflow sorting
    sorted_nodes = get_sorted_workflow_nodes(MOCK_WORKFLOW)
    
    print(f"📋 Original workflow nodes: {list(MOCK_WORKFLOW.keys())}")
    print(f"📋 Sorted workflow nodes: {[node['nodeId'] for node in sorted_nodes]}")
    
    # Expected order: 2 (Load Checkpoint) -> 1,4 (Text Encoders) -> 3 (K-Sampler) -> 5 (VAE Decode)
    expected_order = ["2", "1", "4", "3", "5"]
    actual_order = [node['nodeId'] for node in sorted_nodes]
    
    print(f"📋 Expected order: {expected_order}")
    print(f"📋 Actual order: {actual_order}")
    
    # Verify dependencies are respected
    node_positions = {node_id: i for i, node_id in enumerate(actual_order)}
    
    success = True
    for node in sorted_nodes:
        node_id = node['nodeId']
        dependencies = node['dependencies']
        node_pos = node_positions[node_id]
        
        for dep_id in dependencies:
            if dep_id in node_positions:
                dep_pos = node_positions[dep_id]
                if dep_pos >= node_pos:
                    print(f"❌ Dependency violation: Node {node_id} (pos {node_pos}) depends on {dep_id} (pos {dep_pos})")
                    success = False
                else:
                    print(f"✅ Dependency OK: Node {node_id} (pos {node_pos}) correctly depends on {dep_id} (pos {dep_pos})")
    
    # Check that all nodes have correct titles
    for node in sorted_nodes:
        print(f"📝 Node {node['nodeId']}: {node['classType']} -> '{node['nodeTitle']}'")
    
    if success:
        print("✅ Workflow sorting test PASSED!")
    else:
        print("❌ Workflow sorting test FAILED!")
    
    return success

def test_example_scenario():
    """Test the specific scenario mentioned in requirements: 1 -> 4 -> 3 -> 11"""
    print("\n🎯 Testing specific scenario: 1 -> 4 -> 3 -> 11")
    
    # Simulate workflow order and progress filtering
    workflow_order = ["1", "4", "3", "11"]
    current_node_index = 2  # Currently at node 3
    
    def should_show_progress(node_id, workflow_order, current_index):
        """Simulate the frontend progress filtering logic"""
        try:
            node_index = workflow_order.index(node_id)
            return node_index >= current_index
        except ValueError:
            return True  # Show if not in workflow
    
    # Test scenarios
    test_cases = [
        ("1", False, "Node 1 is past (index 0 < 2)"),
        ("4", False, "Node 4 is past (index 1 < 2)"), 
        ("3", True, "Node 3 is current (index 2 >= 2)"),
        ("11", True, "Node 11 is future (index 3 >= 2)"),
        ("unknown", True, "Unknown node should show")
    ]
    
    all_passed = True
    for node_id, expected, description in test_cases:
        result = should_show_progress(node_id, workflow_order, current_node_index)
        status = "✅" if result == expected else "❌"
        print(f"{status} {description}: {result}")
        if result != expected:
            all_passed = False
    
    if all_passed:
        print("✅ Progress filtering test PASSED!")
    else:
        print("❌ Progress filtering test FAILED!")
    
    return all_passed

if __name__ == "__main__":
    print("🚀 Running ComfyUI workflow tests...\n")
    
    test1_passed = test_workflow_sorting()
    test2_passed = test_example_scenario()
    
    print(f"\n📊 Test Summary:")
    print(f"   Workflow Sorting: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"   Progress Filtering: {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed:
        print("🎉 All tests PASSED!")
        sys.exit(0)
    else:
        print("💥 Some tests FAILED!")
        sys.exit(1)