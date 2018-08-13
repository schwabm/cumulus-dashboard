'use strict';
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import dagre from 'dagre-d3v4';
import * as d3 from 'd3';

// dagre-d3v4 expects d3 to be attached to the window
window.d3 = d3;

var ExecutionStatusGraph = React.createClass({
  propTypes: {
    executionStatus: PropTypes.object
  },

  componentWillMount: function () {
    const {
      executionStatus: {
        executionHistory,
        stateMachine
      }
    } = this.props;

    const workflow = JSON.parse(stateMachine.definition);

    var events = getExecutionEvents(executionHistory);
    var graph = workflowToGraph(workflow);
    addEventsToGraph(events, graph);
    this.g = draw(graph);
  },

  componentDidMount: function () {
    var render = new dagre.render();
    var svg = d3.select('svg');
    render(svg, this.g);
    var height = d3.select('svg g').node().getBBox().height;
    svg.style('height', height + 10);
    svg.style('padding-right', 150);
  },

  componentWillUnmount: function () {
    this.g = null;
  },

  render: function () {
    return (
      <svg></svg>
    );
  }
});

exports.ExecutionStatusGraph = connect(state => ({}))(ExecutionStatusGraph);

function select (arr, predOrProp) {
  var predicate = predOrProp;
  if (typeof predOrProp === 'string') {
    predicate = function hasTruthyProp (item) {
      return item[predOrProp];
    };
  }
  var result = [];
  var i;
  for (i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) result.push(arr[i]);
  }
  return result;
}

function setEdge (g, a, b) {
  g.setEdge(a, b);
}

function setNode (g, id, node) {
  g.setNode(id, node);
}

function setParent (g, child, parent) {
  g.setParent(child, parent);
}

function draw (graph) {
  var g = new dagre.graphlib.Graph({ compound: true })
    .setGraph({})
    .setDefaultEdgeLabel(function () { return {}; });

  var nodes = Object.values(graph);

  var i;
  for (i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    setNode(g, node.id, {label: node.id, class: [node.type, node.status].join(' ')});
    if (node.parent) {
      setParent(g, node.id, node.parent.id);
    }

    var j;
    var k;
    for (j = 0; j < node.edges.length; j++) {
      var target = graph[node.edges[j]];
      if (node.isGroup) {
        var ends = select(nodes, function isGroupStart (tnode) {
          return tnode.parent && tnode.parent.id === node.id && tnode.isEnd;
        });
        for (k = 0; k < ends.length; k++) {
          setEdge(g, ends[k].id, target.id);
        }
      } else if (target.isGroup) {
        var starts = select(nodes, function isGroupStart (tnode) {
          return tnode.parent && tnode.parent.id === target.id && tnode.isStart;
        });
        for (k = 0; k < starts.length; k++) {
          setEdge(g, node.id, starts[k].id);
        }
      } else {
        setEdge(g, node.id, node.edges[j]);
      }
    }
  }

  g.nodes().forEach(function (v) {
    var n = g.node(v);
    // Round the corners of the nodes
    if (n.class === 'terminus') {
      n.height = n.width = 40;
    }
  });

  return g;
}

function workflowToGraph (workflow, parent) {
  var graph = {};
  var i;
  var j;
  var clause;

  var props = Object.keys(workflow.States);

  if (!parent) {
    graph.start = {
      id: 'start',
      def: {},
      parent: null,
      type: 'terminus',
      isGroup: false,
      isStart: false,
      isEnd: false,
      edges: [workflow.StartAt]
    };

    graph.end = {
      id: 'end',
      def: {},
      parent: null,
      type: 'terminus',
      isGroup: false,
      isStart: false,
      isEnd: false,
      edges: []
    };
  }

  for (i = 0; i < props.length; i++) {
    var id = props[i];
    var def = workflow.States[id];
    var node = {
      id: id,
      def: def,
      parent: parent,
      type: def.Type,
      isGroup: def.Type === 'Parallel',
      isStart: id === workflow.StartAt,
      isEnd: !!def.End,
      edges: []
    };
    graph[id] = node;

    if (def.Next) {
      node.edges.push(def.Next);
    }

    if (def.Default) {
      node.edges.push(def.Default);
    }

    if (def.End) {
      if (!parent) {
        node.edges.push('end');
      }
    }

    if (def.Catch) {
      for (j = 0; j < def.Catch.length; j++) {
        clause = def.Catch[j];
        if (clause.Next) {
          node.edges.push(clause.Next);
        }
      }
    }

    if (def.Type === 'Choice') {
      for (j = 0; j < def.Choices.length; j++) {
        clause = def.Choices[j];
        if (clause.Next) {
          node.edges.push(clause.Next);
        }
      }
    } else if (def.Type === 'Parallel') {
      for (j = 0; j < def.Branches.length; j++) {
        var branch = def.Branches[j];
        Object.assign(graph, workflowToGraph(branch, node));
      }
    }
  }

  return graph;
}

function getEventDetails (event) {
  var result = Object.assign({}, event);
  var prop;

  if (event.type.endsWith('StateEntered')) {
    prop = 'stateEnteredEventDetails';
  } else if (event.type.endsWith('StateExited')) {
    prop = 'stateExitedEventDetails';
  } else if (event.type) {
    prop = event.type.charAt(0).toLowerCase() + event.type.slice(1) + 'EventDetails';
  }

  if (prop && event[prop]) {
    result = Object.assign(result, event[prop]);
    delete result[prop];
  }

  if (result.input) {
    try {
      result.input = JSON.parse(result.input);
    } catch (e) {
      console.log(e);
    }
  }

  if (result.output) {
    try {
      result.output = JSON.parse(result.output);
    } catch (e) {
      console.log(e);
    }
  }
  return result;
}

function getExecutionEvents (execution) {
  var result = [];
  for (var i = 0; i < execution.events.length; i++) {
    result.push(getEventDetails(execution.events[i]));
  }
  return result;
}

function cancelAllWorkflowEvents (graph) {
  var stateNames = Object.keys(graph);
  for (var i = 0; i < stateNames.length; i++) {
    var state = graph[stateNames[i]];
    if (state.status === 'InProgress') {
      state.status = 'Cancelled';
    }
  }
}

function findFailure (events, failedEvent) {
  var event = failedEvent;
  while (event && event.previousEventId) {
    if (event.type.endsWith('StateEntered')) {
      return event.name;
    }
    event = events[event.previousEventId - 1];
  }
  return null;
}

function addEventsToGraph (events, graph) {
  var result = [];
  var node;
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    if (event.type.endsWith('StateEntered')) {
      node = graph[event.name];
      node.status = 'InProgress';
      node.input = event.input;
    } else if (event.type.endsWith('StateExited')) {
      node = graph[event.name];
      node.status = 'Succeeded';
      node.output = event.output;
    } else if (event.type === 'ExecutionFailed') {
      var name = findFailure(events, event);
      if (name) {
        node = graph[name];
        node.status = 'Failed';
        node.output = event.output;
      }
    } else if (event.type === 'ExecutionAborted' || event.type === 'ExecutionTimedOut') {
      cancelAllWorkflowEvents(graph);
    }
  }
  return result;
}

exports.getEventDetails = getEventDetails;
