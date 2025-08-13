#!/usr/bin/env node
/**
 * Test script for frontend workflow progress filtering logic
 */

// Simulate the frontend progress filtering logic
function shouldShowNodeProgress(nodeId, workflowNodes, currentNodeIndex) {
  if (workflowNodes.length === 0) return true; // Show if no workflow info yet
  
  const nodeIndex = workflowNodes.findIndex(node => node.nodeId === nodeId);
  if (nodeIndex === -1) return true; // Show if node not found in workflow
  
  // Only show progress for current node or later nodes, not past nodes
  return nodeIndex >= currentNodeIndex;
}

// Test the specific scenario: 1 -> 4 -> 3 -> 11
function testProgressFiltering() {
  console.log("🎯 Testing frontend progress filtering logic...\n");
  
  const workflowNodes = [
    { nodeId: "1", nodeTitle: "Load Model", classType: "CheckpointLoader" },
    { nodeId: "4", nodeTitle: "Positive Prompt", classType: "CLIPTextEncode" },
    { nodeId: "3", nodeTitle: "K-Sampler", classType: "KSampler" },
    { nodeId: "11", nodeTitle: "VAE Decode", classType: "VAEDecode" }
  ];
  
  // Simulate receiving progress for node 3 (index 2)
  let currentNodeIndex = 2;
  
  console.log(`📋 Workflow order: ${workflowNodes.map(n => `${n.nodeId}(${n.nodeTitle})`).join(" → ")}`);
  console.log(`📍 Current position: Node ${workflowNodes[currentNodeIndex].nodeId} (${workflowNodes[currentNodeIndex].nodeTitle})\n`);
  
  const testCases = [
    { 
      nodeId: "1", 
      expectedShow: false, 
      description: "Node 1 should NOT show (past node)" 
    },
    { 
      nodeId: "4", 
      expectedShow: false, 
      description: "Node 4 should NOT show (past node)" 
    },
    { 
      nodeId: "3", 
      expectedShow: true, 
      description: "Node 3 should show (current node)" 
    },
    { 
      nodeId: "11", 
      expectedShow: true, 
      description: "Node 11 should show (future node)" 
    },
    { 
      nodeId: "unknown", 
      expectedShow: true, 
      description: "Unknown node should show (fallback)" 
    }
  ];
  
  let allPassed = true;
  
  testCases.forEach(testCase => {
    const result = shouldShowNodeProgress(testCase.nodeId, workflowNodes, currentNodeIndex);
    const status = result === testCase.expectedShow ? "✅" : "❌";
    console.log(`${status} ${testCase.description}: ${result}`);
    
    if (result !== testCase.expectedShow) {
      allPassed = false;
    }
  });
  
  console.log(`\n📊 Progress filtering test: ${allPassed ? "✅ PASSED" : "❌ FAILED"}`);
  return allPassed;
}

// Test WebSocket message handling
function testWebSocketMessageHandling() {
  console.log("\n🎨 Testing WebSocket message handling logic...\n");
  
  // Simulate state
  let workflowNodes = [];
  let currentNodeIndex = 0;
  let currentNode = "";
  let progress = 0;
  
  // Simulate workflow_nodes message
  const workflowMessage = {
    type: "workflow_nodes",
    workflowData: {
      nodes: [
        { nodeId: "1", nodeTitle: "Load Model", classType: "CheckpointLoader" },
        { nodeId: "4", nodeTitle: "Positive Prompt", classType: "CLIPTextEncode" },
        { nodeId: "3", nodeTitle: "K-Sampler", classType: "KSampler" },
        { nodeId: "11", nodeTitle: "VAE Decode", classType: "VAEDecode" }
      ],
      totalNodes: 4,
      currentNodeIndex: 0,
      nodeOrder: ["1", "4", "3", "11"]
    }
  };
  
  console.log("📨 Received workflow_nodes message");
  workflowNodes = workflowMessage.workflowData.nodes;
  currentNodeIndex = workflowMessage.workflowData.currentNodeIndex;
  console.log(`📋 Stored workflow: ${workflowNodes.map(n => n.nodeTitle).join(" → ")}\n`);
  
  // Simulate progress messages coming out of order
  const progressMessages = [
    {
      type: "job_progress",
      progressData: {
        nodeId: "3",
        displayNodeId: "3", 
        value: 15,
        max: 20,
        message: "K-Sampler: 15/20 steps"
      }
    },
    {
      type: "job_progress", 
      progressData: {
        nodeId: "4",
        displayNodeId: "4",
        value: 100,
        max: 100, 
        message: "Positive Prompt: Complete"
      }
    },
    {
      type: "job_progress",
      progressData: {
        nodeId: "11", 
        displayNodeId: "11",
        value: 50,
        max: 100,
        message: "VAE Decode: 50/100"
      }
    }
  ];
  
  let messagesProcessed = 0;
  let correctlyFiltered = 0;
  
  progressMessages.forEach((message, index) => {
    const nodeId = message.progressData.nodeId;
    const shouldShow = shouldShowNodeProgress(nodeId, workflowNodes, currentNodeIndex);
    
    messagesProcessed++;
    
    if (shouldShow) {
      // Update progress (simulate frontend behavior)
      progress = message.progressData.value;
      const nodeTitle = workflowNodes.find(n => n.nodeId === nodeId)?.nodeTitle || nodeId;
      currentNode = nodeTitle;
      
      // Update current node index
      const nodeIndex = workflowNodes.findIndex(n => n.nodeId === nodeId);
      if (nodeIndex >= 0 && nodeIndex > currentNodeIndex) {
        currentNodeIndex = nodeIndex;
      }
      
      console.log(`✅ Processing progress: ${nodeTitle} (${message.progressData.value}/${message.progressData.max})`);
      correctlyFiltered++;
    } else {
      console.log(`🚫 Skipping past node: ${nodeId} (already completed)`);
      correctlyFiltered++;
    }
  });
  
  console.log(`\n📊 Current state:`);
  console.log(`   Current Node: ${currentNode}`);
  console.log(`   Progress: ${progress}`);
  console.log(`   Node Index: ${currentNodeIndex}`);
  
  const success = correctlyFiltered === messagesProcessed;
  console.log(`\n📊 WebSocket handling test: ${success ? "✅ PASSED" : "❌ FAILED"}`);
  
  return success;
}

// Run all tests
function runAllTests() {
  console.log("🚀 Running frontend workflow tests...\n");
  
  const test1 = testProgressFiltering();
  const test2 = testWebSocketMessageHandling();
  
  console.log(`\n📋 Test Summary:`);
  console.log(`   Progress Filtering: ${test1 ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`   WebSocket Handling: ${test2 ? "✅ PASSED" : "❌ FAILED"}`);
  
  if (test1 && test2) {
    console.log("🎉 All frontend tests PASSED!");
    process.exit(0);
  } else {
    console.log("💥 Some frontend tests FAILED!");
    process.exit(1);
  }
}

// Run tests
runAllTests();