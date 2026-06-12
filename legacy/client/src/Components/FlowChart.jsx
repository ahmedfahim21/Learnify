
import React from 'react';
import Tree from 'react-d3-tree';
import '../App.css'

function FlowChart(flowchart) {

 
 
  
  return (
    <div id="treeWrapper" style={{ width: '100%', height: '400px' }}>
      <Tree
        data={flowchart.hierarchicalData} // Use orgChart for demo purposes, replace with your hierarchical data
        // orientation="vertical"
        
        rootNodeClassName=" text-center text-left"
        depthFactor={300}
        separation={{ siblings: 1, nonSiblings: 1 }}
       
       translate={{ x: 100, y: 160 }}
      />
    </div>
  );
}

export default FlowChart;
