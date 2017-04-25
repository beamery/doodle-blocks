/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2016 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Components for creating connections between blocks.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

goog.provide('Blockly.RenderedConnection');

goog.require('Blockly.Connection');


/**
 * Class for a connection between blocks that may be rendered on screen.
 * @param {!Blockly.Block} source The block establishing this connection.
 * @param {number} type The type of the connection.
 * @extends {Blockly.Connection}
 * @constructor
 */
Blockly.RenderedConnection = function(source, type) {
  Blockly.RenderedConnection.superClass_.constructor.call(this, source, type);
  this.offsetInBlock_ = new goog.math.Coordinate(0, 0);
};
goog.inherits(Blockly.RenderedConnection, Blockly.Connection);

/**
 * Returns the distance between this connection and another connection.
 * @param {!Blockly.Connection} otherConnection The other connection to measure
 *     the distance to.
 * @return {number} The distance between connections.
 */
Blockly.RenderedConnection.prototype.distanceFrom = function(otherConnection) {
  var xDiff = this.x - otherConnection.x;
  var yDiff = this.y - otherConnection.y;
  return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
};

/**
 * Move the block(s) belonging to the connection to a point where they don't
 * visually interfere with the specified connection.
 * @param {!Blockly.Connection} staticConnection The connection to move away
 *     from.
 * @private
 */
Blockly.RenderedConnection.prototype.bumpAwayFrom_ = function(staticConnection) {
  if (Blockly.dragMode != Blockly.DRAG_NONE) {
    // Don't move blocks around while the user is doing the same.
    return;
  }
  // Move the root block.
  var rootBlock = this.sourceBlock.getRootBlock();
  if (rootBlock.isInFlyout) {
    // Don't move blocks around in a flyout.
    return;
  }
  var reverse = false;
  if (!rootBlock.isMovable()) {
    // Can't bump an uneditable block away.
    // Check to see if the other block is movable.
    rootBlock = staticConnection.getSourceBlock().getRootBlock();
    if (!rootBlock.isMovable()) {
      return;
    }
    // Swap the connections and move the 'static' connection instead.
    staticConnection = this;
    reverse = true;
  }
  // Raise it to the top for extra visibility.
  var selected = Blockly.selected == rootBlock;
  selected || rootBlock.addSelect();
  var dx = (staticConnection.x + Blockly.SNAP_RADIUS) - this.x;
  var dy = (staticConnection.y + Blockly.SNAP_RADIUS) - this.y;
  if (reverse) {
    // When reversing a bump due to an uneditable block, bump up.
    dy = -dy;
  }
  if (rootBlock.RTL) {
    dx = -dx;
  }
  rootBlock.moveBy(dx, dy);
  selected || rootBlock.removeSelect();
};

/**
 * Change the connection's coordinates.
 * @param {number} x New absolute x coordinate.
 * @param {number} y New absolute y coordinate.
 */
Blockly.RenderedConnection.prototype.moveTo = function(x, y) {
  // Remove it from its old location in the database (if already present)
  if (this.inDB) {
    this.db.removeConnection(this);
  }
  this.x = x;
  this.y = y;
  // Insert it into its new location in the database.
  if (!this.hidden) {
    this.db.addConnection(this);
  }
};

/**
 * Change the connection's coordinates.
 * @param {number} dx Change to x coordinate.
 * @param {number} dy Change to y coordinate.
 */
Blockly.RenderedConnection.prototype.moveBy = function(dx, dy) {
  this.moveTo(this.x + dx, this.y + dy);
};

/**
 * Move this connection to the location given by its offset within the block and
 * the coordinate of the block's top left corner.
 * @param {!goog.math.Coordinate} blockTL The coordinate of the top left corner
 *     of the block.
 */
Blockly.RenderedConnection.prototype.moveToOffset = function(blockTL) {
  this.moveTo(blockTL.x + this.offsetInBlock_.x,
      blockTL.y + this.offsetInBlock_.y);
};

/**
 * Set the offset of this connection relative to the top left of its block.
 * @param {number} x The new relative x.
 * @param {number} y The new relative y.
 */
Blockly.RenderedConnection.prototype.setOffsetInBlock = function(x, y) {
  this.offsetInBlock_.x = x;
  this.offsetInBlock_.y = y;
};

/**
 * Move the blocks on either side of this connection right next to each other.
 * @private
 */
Blockly.RenderedConnection.prototype.tighten_ = function() {
  var dx = this.targetConnection.x - this.x;
  var dy = this.targetConnection.y - this.y;
  if (dx != 0 || dy != 0) {
    var block = this.targetBlock();
    var svgRoot = block.getSvgRoot();
    if (!svgRoot) {
      throw 'block is not rendered.';
    }
    var xy = Blockly.utils.getRelativeXY(svgRoot);
    block.getSvgRoot().setAttribute('transform',
        'translate(' + (xy.x - dx) + ',' + (xy.y - dy) + ')');
    block.moveConnections_(-dx, -dy);
  }
};

/**
 * Find the closest compatible connection to this connection.
 * @param {number} maxLimit The maximum radius to another connection.
 * @param {!goog.math.Coordinate} dxy Offset between this connection's location
 *     in the database and the current location (as a result of dragging).
 * @return {!{connection: ?Blockly.Connection, radius: number}} Contains two
 *     properties: 'connection' which is either another connection or null,
 *     and 'radius' which is the distance.
 */
Blockly.RenderedConnection.prototype.closest = function(maxLimit, dxy) {
  return this.dbOpposite.searchForClosest(this, maxLimit, dxy);
};

/**
 * Add highlighting around this connection.
 */
Blockly.RenderedConnection.prototype.highlight = function() {
  var steps;
  steps = 'm -20,0 h 5 h 5';
  var xy = this.sourceBlock.getRelativeToSurfaceXY();
  var x = this.x - xy.x;
  var y = this.y - xy.y;
  Blockly.Connection.highlightedPath_ = Blockly.utils.createSvgElement('path',
      {'class': 'blocklyHighlightedConnectionPath',
       'd': steps,
       transform: 'translate(' + x + ',' + y + ')' +
           (this.sourceBlock.RTL ? ' scale(-1 1)' : '')},
      this.sourceBlock.getSvgRoot());
};

/**
 * Unhide this connection, as well as all down-stream connections on any block
 * attached to this connection.  This happens when a block is expanded.
 * Also unhides down-stream comments.
 * @return {!Array.<!Blockly.Block>} List of blocks to render.
 */
Blockly.RenderedConnection.prototype.unhideAll = function() {
  this.setHidden(false);
  // All blocks that need unhiding must be unhidden before any rendering takes
  // place, since rendering requires knowing the dimensions of lower blocks.
  // Also, since rendering a block renders all its parents, we only need to
  // render the leaf nodes.
  var renderList = [];
  if (this.type != Blockly.INPUT_VALUE && this.type != Blockly.NEXT_STATEMENT) {
    // Only spider down.
    return renderList;
  }
  var block = this.targetBlock();
  if (block) {
    var connections;
    if (block.isCollapsed()) {
      // This block should only be partially revealed since it is collapsed.
      connections = [];
      block.outputConnection && connections.push(block.outputConnection);
      block.nextConnection && connections.push(block.nextConnection);
      block.previousConnection && connections.push(block.previousConnection);
    } else {
      // Show all connections of this block.
      connections = block.getConnections(true);
    }
    for (var i = 0; i < connections.length; i++) {
      renderList.push.apply(renderList, connections[i].unhideAll());
    }
    if (!renderList.length) {
      // Leaf block.
      renderList[0] = block;
    }
  }
  return renderList;
};

/**
 * Remove the highlighting around this connection.
 */
Blockly.RenderedConnection.prototype.unhighlight = function() {
  goog.dom.removeNode(Blockly.Connection.highlightedPath_);
  delete Blockly.Connection.highlightedPath_;
};

/**
 * Set whether this connections is hidden (not tracked in a database) or not.
 * @param {boolean} hidden True if connection is hidden.
 */
Blockly.RenderedConnection.prototype.setHidden = function(hidden) {
  this.hidden = hidden;
  if (hidden && this.inDB) {
    this.db.removeConnection(this);
  } else if (!hidden && !this.inDB) {
    this.db.addConnection(this);
  }
};

/**
 * Hide this connection, as well as all down-stream connections on any block
 * attached to this connection.  This happens when a block is collapsed.
 * Also hides down-stream comments.
 */
Blockly.RenderedConnection.prototype.hideAll = function() {
  this.setHidden(true);
  if (this.targetConnection) {
    var blocks = this.targetBlock().getDescendants();
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      // Hide all connections of all children.
      var connections = block.getConnections(true);
      for (var j = 0; j < connections.length; j++) {
        connections[j].setHidden(true);
      }
      // Close all bubbles of all children.
      var icons = block.getIcons();
      for (var j = 0; j < icons.length; j++) {
        icons[j].setVisible(false);
      }
    }
  }
};

/**
 * Check if the two connections can be dragged to connect to each other.
 * @param {!Blockly.Connection} candidate A nearby connection to check.
 * @param {number=} opt_maxRadius The maximum radius allowed for connections.
 * @return {boolean} True if the connection is allowed, false otherwise.
 */
Blockly.RenderedConnection.prototype.isConnectionAllowed = function(candidate,
    opt_maxRadius) {
  if (this.distanceFrom(candidate) > opt_maxRadius) {
    return false;
  }

  return Blockly.RenderedConnection.superClass_.isConnectionAllowed.call(this,
      candidate);
};

/**
 * Disconnect two blocks that are connected by this connection.
 * @param {Blockly.Block} parentBlock The superior block.
 * @param {Blockly.Block} childBlock The inferior block.
 * @protected
 */
Blockly.RenderedConnection.prototype.disconnectInternal = function(parentBlock,
    childBlock) {
  Blockly.RenderedConnection.superClass_.disconnectInternal.call(this,
      parentBlock, childBlock);
  // Rerender the parent so that it may reflow.
  if (parentBlock.rendered) {
    parentBlock.render();
  }
  if (childBlock.rendered) {
    childBlock.updateDisabled();
    childBlock.render();
  }
};

/**
 * Respawn the shadow block if there was one connected to the this connection.
 * Render/rerender blocks as needed.
 * @protected
 */
Blockly.RenderedConnection.prototype.respawnShadow = function() {
  var parentBlock = this.getSourceBlock();
  // Respawn the shadow block if there is one.
  var shadow = this.getShadowDom();
  if (parentBlock.workspace && shadow && Blockly.Events.recordUndo) {
    Blockly.RenderedConnection.superClass_.respawnShadow.call(this);
    var blockShadow = this.targetBlock();
    if (!blockShadow) {
      throw 'Couldn\'t respawn the shadow block that should exist here.';
    }
    blockShadow.initSvg();
    blockShadow.render(false);
    if (parentBlock.rendered) {
      parentBlock.render();
    }
  }
};

/**
 * Find all nearby compatible connections to this connection.
 * Type checking does not apply, since this function is used for bumping.
 * @param {number} maxLimit The maximum radius to another connection.
 * @return {!Array.<!Blockly.Connection>} List of connections.
 * @protected
 */
Blockly.RenderedConnection.prototype.neighbours = function(maxLimit) {
  return this.dbOpposite.getNeighbours(this, maxLimit);
};

/**
 * Connect two connections together.  This is the connection on the superior
 * block.  Rerender blocks as needed.
 * @param {!Blockly.Connection} childConnection Connection on inferior block.
 * @protected
 */
Blockly.RenderedConnection.prototype.connect = function(childConnection) {
  Blockly.RenderedConnection.superClass_.connect.call(this, childConnection);

  var parentConnection = this;
  var parentBlock = parentConnection.getSourceBlock();
  var childBlock = childConnection.getSourceBlock();

  if (parentBlock.rendered) {
    parentBlock.updateDisabled();
  }
  if (childBlock.rendered) {
    childBlock.updateDisabled();
  }
  if (parentBlock.rendered && childBlock.rendered) {
    if (parentConnection.type == Blockly.NEXT_STATEMENT ||
        parentConnection.type == Blockly.PREVIOUS_STATEMENT) {
      // Child block may need to square off its corners if it is in a stack.
      // Rendering a child will render its parent.
      childBlock.render();
    } else {
      // Child block does not change shape.  Rendering the parent node will
      // move its connected children into position.
      parentBlock.render();
    }
  }
};

/**
 * Function to be called when this connection's compatible types have changed.
 * @protected
 */
Blockly.RenderedConnection.prototype.onCheckChanged = function() {
  // The new value type may not be compatible with the existing connection.
  if (this.isConnected() && !this.checkType(this.targetConnection)) {
    var child = this.isSuperior() ? this.targetBlock() : this.sourceBlock;
    child.unplug();
    // Bump away.
    this.sourceBlock.bumpNeighbours();
  }
};
