(function() {
  var EventEmitter, Graph, clone, mergeResolveTheirsNaive, platform, resetGraph,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  clone = require('clone');

  platform = require('./Platform');

  Graph = (function(superClass) {
    extend(Graph, superClass);

    Graph.prototype.name = '';

    Graph.prototype.caseSensitive = false;

    Graph.prototype.properties = {};

    Graph.prototype.nodes = [];

    Graph.prototype.edges = [];

    Graph.prototype.initializers = [];

    Graph.prototype.exports = [];

    Graph.prototype.inports = {};

    Graph.prototype.outports = {};

    Graph.prototype.groups = [];

    function Graph(name1, options) {
      this.name = name1 != null ? name1 : '';
      if (options == null) {
        options = {};
      }
      this.properties = {};
      this.nodes = [];
      this.edges = [];
      this.initializers = [];
      this.exports = [];
      this.inports = {};
      this.outports = {};
      this.groups = [];
      this.transaction = {
        id: null,
        depth: 0
      };
      this.caseSensitive = options.caseSensitive || false;
    }

    Graph.prototype.getPortName = function(port) {
      if (this.caseSensitive) {
        return port;
      } else {
        return port.toLowerCase();
      }
    };

    Graph.prototype.startTransaction = function(id, metadata) {
      if (this.transaction.id) {
        console.warn(Error("Nested transactions not supported"));
      }
      this.transaction.id = id;
      this.transaction.depth = 1;
      return this.emit('startTransaction', id, metadata);
    };

    Graph.prototype.endTransaction = function(id, metadata) {
      if (!this.transaction.id) {
        throw Error("Attempted to end non-existing transaction");
      }
      this.transaction.id = null;
      this.transaction.depth = 0;
      return this.emit('endTransaction', id, metadata);
    };

    Graph.prototype.checkTransactionStart = function() {
      if (!this.transaction.id) {
        return this.startTransaction('implicit');
      } else if (this.transaction.id === 'implicit') {
        return this.transaction.depth += 1;
      }
    };

    Graph.prototype.checkTransactionEnd = function() {
      if (this.transaction.id === 'implicit') {
        this.transaction.depth -= 1;
      }
      if (this.transaction.depth === 0) {
        return this.endTransaction('implicit');
      }
    };

    Graph.prototype.setProperties = function(properties) {
      var before, item, val;
      this.checkTransactionStart();
      before = clone(this.properties);
      for (item in properties) {
        val = properties[item];
        this.properties[item] = val;
      }
      this.emit('changeProperties', this.properties, before);
      return this.checkTransactionEnd();
    };

    Graph.prototype.addExport = function(publicPort, nodeKey, portKey, metadata) {
      var exported;
      if (metadata == null) {
        metadata = {
          x: 0,
          y: 0
        };
      }
      platform.deprecated('fbp-graph.Graph exports is deprecated: please use specific inport or outport instead');
      if (!this.getNode(nodeKey)) {
        return;
      }
      this.checkTransactionStart();
      exported = {
        "public": this.getPortName(publicPort),
        process: nodeKey,
        port: this.getPortName(portKey),
        metadata: metadata
      };
      this.exports.push(exported);
      this.emit('addExport', exported);
      return this.checkTransactionEnd();
    };

    Graph.prototype.removeExport = function(publicPort) {
      var exported, found, i, idx, len, ref;
      platform.deprecated('fbp-graph.Graph exports is deprecated: please use specific inport or outport instead');
      publicPort = this.getPortName(publicPort);
      found = null;
      ref = this.exports;
      for (idx = i = 0, len = ref.length; i < len; idx = ++i) {
        exported = ref[idx];
        if (exported["public"] === publicPort) {
          found = exported;
        }
      }
      if (!found) {
        return;
      }
      this.checkTransactionStart();
      this.exports.splice(this.exports.indexOf(found), 1);
      this.emit('removeExport', found);
      return this.checkTransactionEnd();
    };

    Graph.prototype.addInport = function(publicPort, nodeKey, portKey, metadata) {
      if (!this.getNode(nodeKey)) {
        return;
      }
      publicPort = this.getPortName(publicPort);
      this.checkTransactionStart();
      this.inports[publicPort] = {
        process: nodeKey,
        port: this.getPortName(portKey),
        metadata: metadata
      };
      this.emit('addInport', publicPort, this.inports[publicPort]);
      return this.checkTransactionEnd();
    };

    Graph.prototype.removeInport = function(publicPort) {
      var port;
      publicPort = this.getPortName(publicPort);
      if (!this.inports[publicPort]) {
        return;
      }
      this.checkTransactionStart();
      port = this.inports[publicPort];
      this.setInportMetadata(publicPort, {});
      delete this.inports[publicPort];
      this.emit('removeInport', publicPort, port);
      return this.checkTransactionEnd();
    };

    Graph.prototype.renameInport = function(oldPort, newPort) {
      oldPort = this.getPortName(oldPort);
      newPort = this.getPortName(newPort);
      if (!this.inports[oldPort]) {
        return;
      }
      if (newPort === oldPort) {
        return;
      }
      this.checkTransactionStart();
      this.inports[newPort] = this.inports[oldPort];
      delete this.inports[oldPort];
      this.emit('renameInport', oldPort, newPort);
      return this.checkTransactionEnd();
    };

    Graph.prototype.setInportMetadata = function(publicPort, metadata) {
      var before, item, val;
      publicPort = this.getPortName(publicPort);
      if (!this.inports[publicPort]) {
        return;
      }
      this.checkTransactionStart();
      before = clone(this.inports[publicPort].metadata);
      if (!this.inports[publicPort].metadata) {
        this.inports[publicPort].metadata = {};
      }
      for (item in metadata) {
        val = metadata[item];
        if (val != null) {
          this.inports[publicPort].metadata[item] = val;
        } else {
          delete this.inports[publicPort].metadata[item];
        }
      }
      this.emit('changeInport', publicPort, this.inports[publicPort], before, metadata);
      return this.checkTransactionEnd();
    };

    Graph.prototype.addOutport = function(publicPort, nodeKey, portKey, metadata) {
      if (!this.getNode(nodeKey)) {
        return;
      }
      publicPort = this.getPortName(publicPort);
      this.checkTransactionStart();
      this.outports[publicPort] = {
        process: nodeKey,
        port: this.getPortName(portKey),
        metadata: metadata
      };
      this.emit('addOutport', publicPort, this.outports[publicPort]);
      return this.checkTransactionEnd();
    };

    Graph.prototype.removeOutport = function(publicPort) {
      var port;
      publicPort = this.getPortName(publicPort);
      if (!this.outports[publicPort]) {
        return;
      }
      this.checkTransactionStart();
      port = this.outports[publicPort];
      this.setOutportMetadata(publicPort, {});
      delete this.outports[publicPort];
      this.emit('removeOutport', publicPort, port);
      return this.checkTransactionEnd();
    };

    Graph.prototype.renameOutport = function(oldPort, newPort) {
      oldPort = this.getPortName(oldPort);
      newPort = this.getPortName(newPort);
      if (!this.outports[oldPort]) {
        return;
      }
      this.checkTransactionStart();
      this.outports[newPort] = this.outports[oldPort];
      delete this.outports[oldPort];
      this.emit('renameOutport', oldPort, newPort);
      return this.checkTransactionEnd();
    };

    Graph.prototype.setOutportMetadata = function(publicPort, metadata) {
      var before, item, val;
      publicPort = this.getPortName(publicPort);
      if (!this.outports[publicPort]) {
        return;
      }
      this.checkTransactionStart();
      before = clone(this.outports[publicPort].metadata);
      if (!this.outports[publicPort].metadata) {
        this.outports[publicPort].metadata = {};
      }
      for (item in metadata) {
        val = metadata[item];
        if (val != null) {
          this.outports[publicPort].metadata[item] = val;
        } else {
          delete this.outports[publicPort].metadata[item];
        }
      }
      this.emit('changeOutport', publicPort, this.outports[publicPort], before, metadata);
      return this.checkTransactionEnd();
    };

    Graph.prototype.addGroup = function(group, nodes, metadata) {
      var g;
      this.checkTransactionStart();
      g = {
        name: group,
        nodes: nodes,
        metadata: metadata
      };
      this.groups.push(g);
      this.emit('addGroup', g);
      return this.checkTransactionEnd();
    };

    Graph.prototype.renameGroup = function(oldName, newName) {
      var group, i, len, ref;
      this.checkTransactionStart();
      ref = this.groups;
      for (i = 0, len = ref.length; i < len; i++) {
        group = ref[i];
        if (!group) {
          continue;
        }
        if (group.name !== oldName) {
          continue;
        }
        group.name = newName;
        this.emit('renameGroup', oldName, newName);
      }
      return this.checkTransactionEnd();
    };

    Graph.prototype.removeGroup = function(groupName) {
      var group, i, len, ref;
      this.checkTransactionStart();
      ref = this.groups;
      for (i = 0, len = ref.length; i < len; i++) {
        group = ref[i];
        if (!group) {
          continue;
        }
        if (group.name !== groupName) {
          continue;
        }
        this.setGroupMetadata(group.name, {});
        this.groups.splice(this.groups.indexOf(group), 1);
        this.emit('removeGroup', group);
      }
      return this.checkTransactionEnd();
    };

    Graph.prototype.setGroupMetadata = function(groupName, metadata) {
      var before, group, i, item, len, ref, val;
      this.checkTransactionStart();
      ref = this.groups;
      for (i = 0, len = ref.length; i < len; i++) {
        group = ref[i];
        if (!group) {
          continue;
        }
        if (group.name !== groupName) {
          continue;
        }
        before = clone(group.metadata);
        for (item in metadata) {
          val = metadata[item];
          if (val != null) {
            group.metadata[item] = val;
          } else {
            delete group.metadata[item];
          }
        }
        this.emit('changeGroup', group, before, metadata);
      }
      return this.checkTransactionEnd();
    };

    Graph.prototype.addNode = function(id, component, metadata) {
      var node;
      this.checkTransactionStart();
      if (!metadata) {
        metadata = {};
      }
      node = {
        id: id,
        component: component,
        metadata: metadata
      };
      this.nodes.push(node);
      this.emit('addNode', node);
      this.checkTransactionEnd();
      return node;
    };

    Graph.prototype.removeNode = function(id) {
      var edge, exported, group, i, index, initializer, j, k, l, len, len1, len2, len3, len4, len5, len6, len7, len8, m, n, node, o, p, priv, pub, q, ref, ref1, ref2, ref3, ref4, ref5, toRemove;
      node = this.getNode(id);
      if (!node) {
        return;
      }
      this.checkTransactionStart();
      toRemove = [];
      ref = this.edges;
      for (i = 0, len = ref.length; i < len; i++) {
        edge = ref[i];
        if ((edge.from.node === node.id) || (edge.to.node === node.id)) {
          toRemove.push(edge);
        }
      }
      for (j = 0, len1 = toRemove.length; j < len1; j++) {
        edge = toRemove[j];
        this.removeEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
      }
      toRemove = [];
      ref1 = this.initializers;
      for (k = 0, len2 = ref1.length; k < len2; k++) {
        initializer = ref1[k];
        if (initializer.to.node === node.id) {
          toRemove.push(initializer);
        }
      }
      for (l = 0, len3 = toRemove.length; l < len3; l++) {
        initializer = toRemove[l];
        this.removeInitial(initializer.to.node, initializer.to.port);
      }
      toRemove = [];
      ref2 = this.exports;
      for (m = 0, len4 = ref2.length; m < len4; m++) {
        exported = ref2[m];
        if (this.getPortName(id) === exported.process) {
          toRemove.push(exported);
        }
      }
      for (n = 0, len5 = toRemove.length; n < len5; n++) {
        exported = toRemove[n];
        this.removeExport(exported["public"]);
      }
      toRemove = [];
      ref3 = this.inports;
      for (pub in ref3) {
        priv = ref3[pub];
        if (priv.process === id) {
          toRemove.push(pub);
        }
      }
      for (o = 0, len6 = toRemove.length; o < len6; o++) {
        pub = toRemove[o];
        this.removeInport(pub);
      }
      toRemove = [];
      ref4 = this.outports;
      for (pub in ref4) {
        priv = ref4[pub];
        if (priv.process === id) {
          toRemove.push(pub);
        }
      }
      for (p = 0, len7 = toRemove.length; p < len7; p++) {
        pub = toRemove[p];
        this.removeOutport(pub);
      }
      ref5 = this.groups;
      for (q = 0, len8 = ref5.length; q < len8; q++) {
        group = ref5[q];
        if (!group) {
          continue;
        }
        index = group.nodes.indexOf(id);
        if (index === -1) {
          continue;
        }
        group.nodes.splice(index, 1);
      }
      this.setNodeMetadata(id, {});
      if (-1 !== this.nodes.indexOf(node)) {
        this.nodes.splice(this.nodes.indexOf(node), 1);
      }
      this.emit('removeNode', node);
      return this.checkTransactionEnd();
    };

    Graph.prototype.findUniqueNodeName = function(name, num) {
      var i, len, node, ref, uniqueName;
      if (num) {
        uniqueName = name + "-" + num;
      } else {
        uniqueName = name;
        num = 1;
      }
      ref = this.nodes;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
        if (!node) {
          continue;
        }
        if (node.id === uniqueName) {
          return this.findUniqueNodeName(name, num + 1);
        }
      }
      return uniqueName;
    };

    Graph.prototype.getNode = function(id) {
      var i, len, node, ref;
      ref = this.nodes;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
        if (!node) {
          continue;
        }
        if (node.id === id) {
          return node;
        }
      }
      return null;
    };

    Graph.prototype.renameNode = function(oldId, newId) {
      var edge, exported, group, i, iip, index, j, k, l, len, len1, len2, len3, node, priv, pub, ref, ref1, ref2, ref3, ref4, ref5;
      this.checkTransactionStart();
      node = this.getNode(oldId);
      if (!node) {
        return;
      }
      node.id = newId;
      ref = this.edges;
      for (i = 0, len = ref.length; i < len; i++) {
        edge = ref[i];
        if (!edge) {
          continue;
        }
        if (edge.from.node === oldId) {
          edge.from.node = newId;
        }
        if (edge.to.node === oldId) {
          edge.to.node = newId;
        }
      }
      ref1 = this.initializers;
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        iip = ref1[j];
        if (!iip) {
          continue;
        }
        if (iip.to.node === oldId) {
          iip.to.node = newId;
        }
      }
      ref2 = this.inports;
      for (pub in ref2) {
        priv = ref2[pub];
        if (priv.process === oldId) {
          priv.process = newId;
        }
      }
      ref3 = this.outports;
      for (pub in ref3) {
        priv = ref3[pub];
        if (priv.process === oldId) {
          priv.process = newId;
        }
      }
      ref4 = this.exports;
      for (k = 0, len2 = ref4.length; k < len2; k++) {
        exported = ref4[k];
        if (exported.process === oldId) {
          exported.process = newId;
        }
      }
      ref5 = this.groups;
      for (l = 0, len3 = ref5.length; l < len3; l++) {
        group = ref5[l];
        if (!group) {
          continue;
        }
        index = group.nodes.indexOf(oldId);
        if (index === -1) {
          continue;
        }
        group.nodes[index] = newId;
      }
      this.emit('renameNode', oldId, newId);
      return this.checkTransactionEnd();
    };

    Graph.prototype.setNodeMetadata = function(id, metadata) {
      var before, item, node, val;
      node = this.getNode(id);
      if (!node) {
        return;
      }
      this.checkTransactionStart();
      before = clone(node.metadata);
      if (!node.metadata) {
        node.metadata = {};
      }
      for (item in metadata) {
        val = metadata[item];
        if (val != null) {
          node.metadata[item] = val;
        } else {
          delete node.metadata[item];
        }
      }
      this.emit('changeNode', node, before, metadata);
      return this.checkTransactionEnd();
    };

    Graph.prototype.addEdge = function(outNode, outPort, inNode, inPort, metadata) {
      var edge, i, len, ref;
      if (metadata == null) {
        metadata = {};
      }
      outPort = this.getPortName(outPort);
      inPort = this.getPortName(inPort);
      ref = this.edges;
      for (i = 0, len = ref.length; i < len; i++) {
        edge = ref[i];
        if (edge.from.node === outNode && edge.from.port === outPort && edge.to.node === inNode && edge.to.port === inPort) {
          return;
        }
      }
      if (!this.getNode(outNode)) {
        return;
      }
      if (!this.getNode(inNode)) {
        return;
      }
      this.checkTransactionStart();
      edge = {
        from: {
          node: outNode,
          port: outPort
        },
        to: {
          node: inNode,
          port: inPort
        },
        metadata: metadata
      };
      this.edges.push(edge);
      this.emit('addEdge', edge);
      this.checkTransactionEnd();
      return edge;
    };

    Graph.prototype.addEdgeIndex = function(outNode, outPort, outIndex, inNode, inPort, inIndex, metadata) {
      var edge;
      if (metadata == null) {
        metadata = {};
      }
      if (!this.getNode(outNode)) {
        return;
      }
      if (!this.getNode(inNode)) {
        return;
      }
      outPort = this.getPortName(outPort);
      inPort = this.getPortName(inPort);
      if (inIndex === null) {
        inIndex = void 0;
      }
      if (outIndex === null) {
        outIndex = void 0;
      }
      if (!metadata) {
        metadata = {};
      }
      this.checkTransactionStart();
      edge = {
        from: {
          node: outNode,
          port: outPort,
          index: outIndex
        },
        to: {
          node: inNode,
          port: inPort,
          index: inIndex
        },
        metadata: metadata
      };
      this.edges.push(edge);
      this.emit('addEdge', edge);
      this.checkTransactionEnd();
      return edge;
    };

    Graph.prototype.removeEdge = function(node, port, node2, port2) {
      var edge, i, index, j, k, len, len1, len2, ref, ref1, toKeep, toRemove;
      this.checkTransactionStart();
      port = this.getPortName(port);
      port2 = this.getPortName(port2);
      toRemove = [];
      toKeep = [];
      if (node2 && port2) {
        ref = this.edges;
        for (index = i = 0, len = ref.length; i < len; index = ++i) {
          edge = ref[index];
          if (edge.from.node === node && edge.from.port === port && edge.to.node === node2 && edge.to.port === port2) {
            this.setEdgeMetadata(edge.from.node, edge.from.port, edge.to.node, edge.to.port, {});
            toRemove.push(edge);
          } else {
            toKeep.push(edge);
          }
        }
      } else {
        ref1 = this.edges;
        for (index = j = 0, len1 = ref1.length; j < len1; index = ++j) {
          edge = ref1[index];
          if ((edge.from.node === node && edge.from.port === port) || (edge.to.node === node && edge.to.port === port)) {
            this.setEdgeMetadata(edge.from.node, edge.from.port, edge.to.node, edge.to.port, {});
            toRemove.push(edge);
          } else {
            toKeep.push(edge);
          }
        }
      }
      this.edges = toKeep;
      for (k = 0, len2 = toRemove.length; k < len2; k++) {
        edge = toRemove[k];
        this.emit('removeEdge', edge);
      }
      return this.checkTransactionEnd();
    };

    Graph.prototype.getEdge = function(node, port, node2, port2) {
      var edge, i, index, len, ref;
      port = this.getPortName(port);
      port2 = this.getPortName(port2);
      ref = this.edges;
      for (index = i = 0, len = ref.length; i < len; index = ++i) {
        edge = ref[index];
        if (!edge) {
          continue;
        }
        if (edge.from.node === node && edge.from.port === port) {
          if (edge.to.node === node2 && edge.to.port === port2) {
            return edge;
          }
        }
      }
      return null;
    };

    Graph.prototype.getConnectedNodes = function(node) {
      var edge, i, index, len, nodes, ref;
      nodes = {};
      ref = this.edges;
      for (index = i = 0, len = ref.length; i < len; index = ++i) {
        edge = ref[index];
        if (!edge) {
          continue;
        }
        if (edge.from.node === node) {
          if (!nodes[edge.from.port]) {
            nodes[edge.from.port] = {
              port: edge.from.port,
              connectedNodes: [edge.to.node]
            };
          } else {
            nodes[edge.from.port].connectedNodes.push(edge.to.node);
          }
        } else if (edge.to.node === node) {
          if (!nodes[edge.to.port]) {
            nodes[edge.to.port] = {
              port: edge.to.port,
              connectedNodes: [edge.from.node]
            };
          } else {
            nodes[edge.to.port].connectedNodes.push(edge.from.node);
          }
        }
      }
      return Object.values(nodes);
    };

    Graph.prototype.setEdgeMetadata = function(node, port, node2, port2, metadata) {
      var before, edge, item, val;
      edge = this.getEdge(node, port, node2, port2);
      if (!edge) {
        return;
      }
      this.checkTransactionStart();
      before = clone(edge.metadata);
      if (!edge.metadata) {
        edge.metadata = {};
      }
      for (item in metadata) {
        val = metadata[item];
        if (val != null) {
          edge.metadata[item] = val;
        } else {
          delete edge.metadata[item];
        }
      }
      this.emit('changeEdge', edge, before, metadata);
      return this.checkTransactionEnd();
    };

    Graph.prototype.addInitial = function(data, node, port, metadata) {
      var initializer;
      if (!this.getNode(node)) {
        return;
      }
      port = this.getPortName(port);
      this.checkTransactionStart();
      initializer = {
        from: {
          data: data
        },
        to: {
          node: node,
          port: port
        },
        metadata: metadata
      };
      this.initializers.push(initializer);
      this.emit('addInitial', initializer);
      this.checkTransactionEnd();
      return initializer;
    };

    Graph.prototype.addInitialIndex = function(data, node, port, index, metadata) {
      var initializer;
      if (!this.getNode(node)) {
        return;
      }
      if (index === null) {
        index = void 0;
      }
      port = this.getPortName(port);
      this.checkTransactionStart();
      initializer = {
        from: {
          data: data
        },
        to: {
          node: node,
          port: port,
          index: index
        },
        metadata: metadata
      };
      this.initializers.push(initializer);
      this.emit('addInitial', initializer);
      this.checkTransactionEnd();
      return initializer;
    };

    Graph.prototype.addGraphInitial = function(data, node, metadata) {
      var inport;
      inport = this.inports[node];
      if (!inport) {
        return;
      }
      return this.addInitial(data, inport.process, inport.port, metadata);
    };

    Graph.prototype.addGraphInitialIndex = function(data, node, index, metadata) {
      var inport;
      inport = this.inports[node];
      if (!inport) {
        return;
      }
      return this.addInitialIndex(data, inport.process, inport.port, index, metadata);
    };

    Graph.prototype.removeInitial = function(node, port) {
      var edge, i, index, j, len, len1, ref, toKeep, toRemove;
      port = this.getPortName(port);
      this.checkTransactionStart();
      toRemove = [];
      toKeep = [];
      ref = this.initializers;
      for (index = i = 0, len = ref.length; i < len; index = ++i) {
        edge = ref[index];
        if (edge.to.node === node && edge.to.port === port) {
          toRemove.push(edge);
        } else {
          toKeep.push(edge);
        }
      }
      this.initializers = toKeep;
      for (j = 0, len1 = toRemove.length; j < len1; j++) {
        edge = toRemove[j];
        this.emit('removeInitial', edge);
      }
      return this.checkTransactionEnd();
    };

    Graph.prototype.getInitials = function(node) {
      var edge, i, index, initials, len, ref;
      initials = {};
      ref = this.initializers;
      for (index = i = 0, len = ref.length; i < len; index = ++i) {
        edge = ref[index];
        if (edge.to.node === node) {
          if (!initials[edge.to.port]) {
            initials[edge.to.port] = [];
          }
          initials[edge.to.port].push(edge.from.data);
        }
      }
      return initials;
    };

    Graph.prototype.removeGraphInitial = function(node) {
      var inport;
      inport = this.inports[node];
      if (!inport) {
        return;
      }
      return this.removeInitial(inport.process, inport.port);
    };

    Graph.prototype.toDOT = function() {
      var cleanID, cleanPort, data, dot, edge, i, id, initializer, j, k, len, len1, len2, node, ref, ref1, ref2;
      cleanID = function(id) {
        return id.replace(/\s*/g, "");
      };
      cleanPort = function(port) {
        return port.replace(/\./g, "");
      };
      dot = "digraph {\n";
      ref = this.nodes;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
        dot += "    " + (cleanID(node.id)) + " [label=" + node.id + " shape=box]\n";
      }
      ref1 = this.initializers;
      for (id = j = 0, len1 = ref1.length; j < len1; id = ++j) {
        initializer = ref1[id];
        if (typeof initializer.from.data === 'function') {
          data = 'Function';
        } else {
          data = initializer.from.data;
        }
        dot += "    data" + id + " [label=\"'" + data + "'\" shape=plaintext]\n";
        dot += "    data" + id + " -> " + (cleanID(initializer.to.node)) + "[headlabel=" + (cleanPort(initializer.to.port)) + " labelfontcolor=blue labelfontsize=8.0]\n";
      }
      ref2 = this.edges;
      for (k = 0, len2 = ref2.length; k < len2; k++) {
        edge = ref2[k];
        dot += "    " + (cleanID(edge.from.node)) + " -> " + (cleanID(edge.to.node)) + "[taillabel=" + (cleanPort(edge.from.port)) + " headlabel=" + (cleanPort(edge.to.port)) + " labelfontcolor=blue labelfontsize=8.0]\n";
      }
      dot += "}";
      return dot;
    };

    Graph.prototype.toYUML = function() {
      var edge, i, initializer, j, len, len1, ref, ref1, yuml;
      yuml = [];
      ref = this.initializers;
      for (i = 0, len = ref.length; i < len; i++) {
        initializer = ref[i];
        yuml.push("(start)[" + initializer.to.port + "]->(" + initializer.to.node + ")");
      }
      ref1 = this.edges;
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        edge = ref1[j];
        yuml.push("(" + edge.from.node + ")[" + edge.from.port + "]->(" + edge.to.node + ")");
      }
      return yuml.join(",");
    };

    Graph.prototype.toJSON = function() {
      var connection, edge, exported, group, groupData, i, initializer, j, json, k, l, len, len1, len2, len3, len4, m, node, priv, property, pub, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, value;
      json = {
        caseSensitive: this.caseSensitive,
        properties: {},
        inports: {},
        outports: {},
        groups: [],
        processes: {},
        connections: []
      };
      if (this.name) {
        json.properties.name = this.name;
      }
      ref = this.properties;
      for (property in ref) {
        value = ref[property];
        json.properties[property] = value;
      }
      ref1 = this.inports;
      for (pub in ref1) {
        priv = ref1[pub];
        json.inports[pub] = priv;
      }
      ref2 = this.outports;
      for (pub in ref2) {
        priv = ref2[pub];
        json.outports[pub] = priv;
      }
      ref3 = this.exports;
      for (i = 0, len = ref3.length; i < len; i++) {
        exported = ref3[i];
        if (!json.exports) {
          json.exports = [];
        }
        json.exports.push(exported);
      }
      ref4 = this.groups;
      for (j = 0, len1 = ref4.length; j < len1; j++) {
        group = ref4[j];
        groupData = {
          name: group.name,
          nodes: group.nodes
        };
        if (Object.keys(group.metadata).length) {
          groupData.metadata = group.metadata;
        }
        json.groups.push(groupData);
      }
      ref5 = this.nodes;
      for (k = 0, len2 = ref5.length; k < len2; k++) {
        node = ref5[k];
        json.processes[node.id] = {
          component: node.component
        };
        if (node.metadata) {
          json.processes[node.id].metadata = node.metadata;
        }
      }
      ref6 = this.edges;
      for (l = 0, len3 = ref6.length; l < len3; l++) {
        edge = ref6[l];
        connection = {
          src: {
            process: edge.from.node,
            port: edge.from.port,
            index: edge.from.index
          },
          tgt: {
            process: edge.to.node,
            port: edge.to.port,
            index: edge.to.index
          }
        };
        if (Object.keys(edge.metadata).length) {
          connection.metadata = edge.metadata;
        }
        json.connections.push(connection);
      }
      ref7 = this.initializers;
      for (m = 0, len4 = ref7.length; m < len4; m++) {
        initializer = ref7[m];
        json.connections.push({
          data: initializer.from.data,
          tgt: {
            process: initializer.to.node,
            port: initializer.to.port,
            index: initializer.to.index
          }
        });
      }
      return json;
    };

    Graph.prototype.save = function(file, callback) {
      var json;
      if (platform.isBrowser()) {
        return callback(new Error("Saving graphs not supported on browser"));
      }
      json = JSON.stringify(this.toJSON(), null, 4);
      return require('fs').writeFile(file + ".json", json, "utf-8", function(err, data) {
        if (err) {
          return callback(err);
        }
        return callback(null, file);
      });
    };

    return Graph;

  })(EventEmitter);

  exports.Graph = Graph;

  exports.createGraph = function(name, options) {
    return new Graph(name, options);
  };

  exports.loadJSON = function(definition, callback, metadata) {
    var caseSensitive, conn, def, exported, graph, group, i, id, j, k, len, len1, len2, portId, priv, processId, properties, property, pub, ref, ref1, ref2, ref3, ref4, ref5, ref6, split, value;
    if (metadata == null) {
      metadata = {};
    }
    if (typeof definition === 'string') {
      definition = JSON.parse(definition);
    }
    if (!definition.properties) {
      definition.properties = {};
    }
    if (!definition.processes) {
      definition.processes = {};
    }
    if (!definition.connections) {
      definition.connections = [];
    }
    caseSensitive = definition.caseSensitive || false;
    graph = new Graph(definition.properties.name, {
      caseSensitive: caseSensitive
    });
    graph.startTransaction('loadJSON', metadata);
    properties = {};
    ref = definition.properties;
    for (property in ref) {
      value = ref[property];
      if (property === 'name') {
        continue;
      }
      properties[property] = value;
    }
    graph.setProperties(properties);
    ref1 = definition.processes;
    for (id in ref1) {
      def = ref1[id];
      if (!def.metadata) {
        def.metadata = {};
      }
      graph.addNode(id, def.component, def.metadata);
    }
    ref2 = definition.connections;
    for (i = 0, len = ref2.length; i < len; i++) {
      conn = ref2[i];
      metadata = conn.metadata ? conn.metadata : {};
      if (conn.data !== void 0) {
        if (typeof conn.tgt.index === 'number') {
          graph.addInitialIndex(conn.data, conn.tgt.process, graph.getPortName(conn.tgt.port), conn.tgt.index, metadata);
        } else {
          graph.addInitial(conn.data, conn.tgt.process, graph.getPortName(conn.tgt.port), metadata);
        }
        continue;
      }
      if (typeof conn.src.index === 'number' || typeof conn.tgt.index === 'number') {
        graph.addEdgeIndex(conn.src.process, graph.getPortName(conn.src.port), conn.src.index, conn.tgt.process, graph.getPortName(conn.tgt.port), conn.tgt.index, metadata);
        continue;
      }
      graph.addEdge(conn.src.process, graph.getPortName(conn.src.port), conn.tgt.process, graph.getPortName(conn.tgt.port), metadata);
    }
    if (definition.exports && definition.exports.length) {
      ref3 = definition.exports;
      for (j = 0, len1 = ref3.length; j < len1; j++) {
        exported = ref3[j];
        if (exported["private"]) {
          split = exported["private"].split('.');
          if (split.length !== 2) {
            continue;
          }
          processId = split[0];
          portId = split[1];
          for (id in definition.processes) {
            if (graph.getPortName(id) === graph.getPortName(processId)) {
              processId = id;
            }
          }
        } else {
          processId = exported.process;
          portId = graph.getPortName(exported.port);
        }
        graph.addExport(exported["public"], processId, portId, exported.metadata);
      }
    }
    if (definition.inports) {
      ref4 = definition.inports;
      for (pub in ref4) {
        priv = ref4[pub];
        graph.addInport(pub, priv.process, graph.getPortName(priv.port), priv.metadata);
      }
    }
    if (definition.outports) {
      ref5 = definition.outports;
      for (pub in ref5) {
        priv = ref5[pub];
        graph.addOutport(pub, priv.process, graph.getPortName(priv.port), priv.metadata);
      }
    }
    if (definition.groups) {
      ref6 = definition.groups;
      for (k = 0, len2 = ref6.length; k < len2; k++) {
        group = ref6[k];
        graph.addGroup(group.name, group.nodes, group.metadata || {});
      }
    }
    graph.endTransaction('loadJSON');
    if (callback) {
      callback(null, graph);
    }
    return graph;
  };

  exports.loadFBP = function(fbpData, callback, metadata, caseSensitive) {
    var definition, e, error;
    if (metadata == null) {
      metadata = {};
    }
    if (caseSensitive == null) {
      caseSensitive = false;
    }
    try {
      definition = require('fbp').parse(fbpData, {
        caseSensitive: caseSensitive
      });
    } catch (error) {
      e = error;
      return callback(e);
    }
    return exports.loadJSON(definition, callback, metadata);
  };

  exports.loadHTTP = function(url, callback) {
    var req;
    req = new XMLHttpRequest;
    req.onreadystatechange = function() {
      if (req.readyState !== 4) {
        return;
      }
      if (req.status !== 200) {
        return callback(new Error("Failed to load " + url + ": HTTP " + req.status));
      }
      return callback(null, req.responseText);
    };
    req.open('GET', url, true);
    return req.send();
  };

  exports.loadFile = function(file, callback, metadata, caseSensitive) {
    if (metadata == null) {
      metadata = {};
    }
    if (caseSensitive == null) {
      caseSensitive = false;
    }
    if (platform.isBrowser()) {
      exports.loadHTTP(file, function(err, data) {
        var definition;
        if (err) {
          return callback(err);
        }
        if (file.split('.').pop() === 'fbp') {
          return exports.loadFBP(data, callback, metadata);
        }
        definition = JSON.parse(data);
        return exports.loadJSON(definition, callback, metadata);
      });
      return;
    }
    return require('fs').readFile(file, "utf-8", function(err, data) {
      var definition;
      if (err) {
        return callback(err);
      }
      if (file.split('.').pop() === 'fbp') {
        return exports.loadFBP(data, callback, {}, caseSensitive);
      }
      definition = JSON.parse(data);
      return exports.loadJSON(definition, callback, {});
    });
  };

  resetGraph = function(graph) {
    var edge, exp, group, i, iip, j, k, l, len, len1, len2, len3, len4, m, node, port, ref, ref1, ref2, ref3, ref4, ref5, ref6, results, v;
    ref = (clone(graph.groups)).reverse();
    for (i = 0, len = ref.length; i < len; i++) {
      group = ref[i];
      if (group != null) {
        graph.removeGroup(group.name);
      }
    }
    ref1 = clone(graph.outports);
    for (port in ref1) {
      v = ref1[port];
      graph.removeOutport(port);
    }
    ref2 = clone(graph.inports);
    for (port in ref2) {
      v = ref2[port];
      graph.removeInport(port);
    }
    ref3 = clone(graph.exports.reverse());
    for (j = 0, len1 = ref3.length; j < len1; j++) {
      exp = ref3[j];
      graph.removeExport(exp["public"]);
    }
    graph.setProperties({});
    ref4 = (clone(graph.initializers)).reverse();
    for (k = 0, len2 = ref4.length; k < len2; k++) {
      iip = ref4[k];
      graph.removeInitial(iip.to.node, iip.to.port);
    }
    ref5 = (clone(graph.edges)).reverse();
    for (l = 0, len3 = ref5.length; l < len3; l++) {
      edge = ref5[l];
      graph.removeEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
    }
    ref6 = (clone(graph.nodes)).reverse();
    results = [];
    for (m = 0, len4 = ref6.length; m < len4; m++) {
      node = ref6[m];
      results.push(graph.removeNode(node.id));
    }
    return results;
  };

  mergeResolveTheirsNaive = function(base, to) {
    var edge, exp, group, i, iip, j, k, l, len, len1, len2, len3, len4, m, node, priv, pub, ref, ref1, ref2, ref3, ref4, ref5, ref6, results;
    resetGraph(base);
    ref = to.nodes;
    for (i = 0, len = ref.length; i < len; i++) {
      node = ref[i];
      base.addNode(node.id, node.component, node.metadata);
    }
    ref1 = to.edges;
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      edge = ref1[j];
      base.addEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port, edge.metadata);
    }
    ref2 = to.initializers;
    for (k = 0, len2 = ref2.length; k < len2; k++) {
      iip = ref2[k];
      base.addInitial(iip.from.data, iip.to.node, iip.to.port, iip.metadata);
    }
    ref3 = to.exports;
    for (l = 0, len3 = ref3.length; l < len3; l++) {
      exp = ref3[l];
      base.addExport(exp["public"], exp.node, exp.port, exp.metadata);
    }
    base.setProperties(to.properties);
    ref4 = to.inports;
    for (pub in ref4) {
      priv = ref4[pub];
      base.addInport(pub, priv.process, priv.port, priv.metadata);
    }
    ref5 = to.outports;
    for (pub in ref5) {
      priv = ref5[pub];
      base.addOutport(pub, priv.process, priv.port, priv.metadata);
    }
    ref6 = to.groups;
    results = [];
    for (m = 0, len4 = ref6.length; m < len4; m++) {
      group = ref6[m];
      results.push(base.addGroup(group.name, group.nodes, group.metadata));
    }
    return results;
  };

  exports.equivalent = function(a, b, options) {
    var A, B;
    if (options == null) {
      options = {};
    }
    A = JSON.stringify(a);
    B = JSON.stringify(b);
    return A === B;
  };

  exports.mergeResolveTheirs = mergeResolveTheirsNaive;

}).call(this);
