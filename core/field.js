/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2012 Google Inc.
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
 * @fileoverview Field.  Used for editable titles, variables, etc.
 * This is an abstract class that defines the UI on the block.  Actual
 * instances would be Blockly.FieldTextInput, Blockly.FieldDropdown, etc.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Field');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.math.Size');
goog.require('goog.style');
goog.require('goog.userAgent');


/**
 * Abstract class for an editable field.
 * @param {string} text The initial content of the field.
 * @param {Function=} opt_validator An optional function that is called
 *     to validate any constraints on what the user entered.  Takes the new
 *     text as an argument and returns either the accepted text, a replacement
 *     text, or null to abort the change.
 * @constructor
 */
Blockly.Field = function(text, opt_validator) {
  this.size_ = new goog.math.Size(
    Blockly.BlockSvg.FIELD_WIDTH,
    Blockly.BlockSvg.FIELD_HEIGHT);
  this.setValue(text);
  this.setValidator(opt_validator ? opt_validator : null);

  /**
   * Maximum characters of text to display before adding an ellipsis.
   * Same for strings and numbers.
   * @type {number}
   */
  this.maxDisplayLength = Blockly.BlockSvg.MAX_DISPLAY_LENGTH;
};

/**
 * Temporary cache of text widths.
 * @type {Object}
 * @private
 */
Blockly.Field.cacheWidths_ = null;

/**
 * Number of current references to cache.
 * @type {number}
 * @private
 */
Blockly.Field.cacheReference_ = 0;


/**
 * Name of field.  Unique within each block.
 * Static labels are usually unnamed.
 * @type {string|null}
 */
Blockly.Field.prototype.name = null;

/**
 * Visible text to display.
 * @type {?string}
 */
Blockly.Field.prototype.text = '';

/**
 * Block this field is attached to.  Starts as null, then in set in init.
 * @type {Blockly.Block}
 * @protected
 */
Blockly.Field.prototype.sourceBlock = null;

/**
 * Is the field visible, or hidden due to the block being collapsed?
 * @type {boolean}
 * @protected
 */
Blockly.Field.prototype.visible = true;

/**
 * Null, or an array of the field's argTypes (for styling).
 * @type {Array}
 * @private
 */
Blockly.Field.prototype.argType_ = null;

/**
 * Validation function called when user edits an editable field.
 * @type {Function}
 * @private
 */
Blockly.Field.prototype.validator_ = null;

/**
 * Non-breaking space.
 * @const
 */
Blockly.Field.NBSP = '\u00A0';

/**
 * Editable fields are saved by the XML renderer, non-editable fields are not.
 */
Blockly.Field.prototype.EDITABLE = true;

/**
 * Attach this field to a block.
 * @param {Blockly.Block} block The block containing this field.
 */
Blockly.Field.prototype.setSourceBlock = function(block) {
  goog.asserts.assert(!this.sourceBlock, 'Field already bound to a block.');
  this.sourceBlock = block;
};

/**
 * Install this field on a block.
 * @param {Blockly.Block=} opt_block
 */
Blockly.Field.prototype.init = function(opt_block) {
  if (this.fieldGroup_) {
    // Field has already been initialized once.
    return;
  }
  // Build the DOM.
  this.fieldGroup_ = Blockly.utils.createSvgElement('g', {}, null);
  if (!this.visible) {
    this.fieldGroup_.style.display = 'none';
  }
  // Add an attribute to cassify the type of field.
  var argTypes = this.getArgTypes();
  if (argTypes !== null) {
    if (this.sourceBlock.isShadow()) {
      this.sourceBlock.svgGroup.setAttribute('data-argument-type',
          argTypes);
    } else {
      // Fields without a shadow wrapper, like square dropdowns.
      this.fieldGroup_.setAttribute('data-argument-type', argTypes);
    }
  }
  // Adjust X to be flipped for RTL. Position is relative to horizontal start of source block.
  var size = this.getSize();
  var fieldX = (this.sourceBlock.RTL) ? -size.width / 2 : size.width / 2;
  /** @type {Element} */
  this.textElement_ = Blockly.utils.createSvgElement('text',
      {'class': 'blocklyText',
       'x': fieldX,
       'y': size.height / 2 + Blockly.BlockSvg.FIELD_TOP_PADDING,
       'dominant-baseline': 'middle',
       'text-anchor': 'middle'},
      this.fieldGroup_);

  this.updateEditable();
  this.sourceBlock.getSvgRoot().appendChild(this.fieldGroup_);
  this.mouseUpWrapper_ =
      Blockly.bindEventWithChecks(this.getClickTarget_(), 'mouseup', this,
      this.onMouseUp_);
  // Force a render.
  this.render();
  this.size_.width = 0;
};

/**
 * Dispose of all DOM objects belonging to this editable field.
 */
Blockly.Field.prototype.dispose = function() {
  if (this.mouseUpWrapper_) {
    Blockly.unbindEvent(this.mouseUpWrapper_);
    this.mouseUpWrapper_ = null;
  }
  this.sourceBlock = null;
  goog.dom.removeNode(this.fieldGroup_);
  this.fieldGroup_ = null;
  this.textElement_ = null;
  this.validator_ = null;
};

/**
 * Add or remove the UI indicating if this field is editable or not.
 */
Blockly.Field.prototype.updateEditable = function() {
  var group = this.fieldGroup_;
  if (!this.EDITABLE || !group) {
    return;
  }
  if (this.sourceBlock.isEditable()) {
    Blockly.utils.addClass(group, 'blocklyEditableText');
    Blockly.utils.removeClass(group, 'blocklyNonEditableText');
    this.fieldGroup_.style.cursor = this.CURSOR;
  } else {
    Blockly.utils.addClass(group, 'blocklyNonEditableText');
    Blockly.utils.removeClass(group, 'blocklyEditableText');
    this.fieldGroup_.style.cursor = '';
  }
};

/**
 * Check whether this field is currently editable.  Some fields are never
 * editable (e.g. text labels).  Those fields are not serialized to XML.  Other
 * fields may be editable, and therefore serialized, but may exist on
 * non-editable blocks.
 * @return {boolean} whether this field is editable and on an editable block
 */
Blockly.Field.prototype.isCurrentlyEditable = function() {
  return this.EDITABLE && !!this.sourceBlock && this.sourceBlock.isEditable();
};

/**
 * Gets whether this editable field is visible or not.
 * @return {boolean} True if visible.
 */
Blockly.Field.prototype.isVisible = function() {
  return this.visible;
};

/**
 * Sets whether this editable field is visible or not.
 * @param {boolean} visible True if visible.
 */
Blockly.Field.prototype.setVisible = function(visible) {
  if (this.visible == visible) {
    return;
  }
  this.visible = visible;
  var root = this.getSvgRoot();
  if (root) {
    root.style.display = visible ? 'block' : 'none';
    this.render();
  }
};

/**
 * Adds a string to the field's array of argTypes (used for styling).
 * @param {string} argType New argType.
 */
Blockly.Field.prototype.addArgType = function(argType) {
  if (this.argType_ == null) {
    this.argType_ = [];
  }
  this.argType_.push(argType);
};

/**
 * Gets the field's argTypes joined as a string, or returns null (used for styling).
 * @return {?string} argType string, or null.
 */
Blockly.Field.prototype.getArgTypes = function() {
  if (this.argType_ === null || this.argType_.length === 0) {
    return null;
  } else {
    return this.argType_.join(' ');
  }
};

/**
 * Sets a new validation function for editable fields.
 * @param {Function} handler New validation function, or null.
 */
Blockly.Field.prototype.setValidator = function(handler) {
  this.validator_ = handler;
};

/**
 * Gets the validation function for editable fields.
 * @return {Function} Validation function, or null.
 */
Blockly.Field.prototype.getValidator = function() {
  return this.validator_;
};

/**
 * Validates a change.  Does nothing.  Subclasses may override this.
 * @param {string} text The user's text.
 * @return {?string} No change needed.
 */
Blockly.Field.prototype.classValidator = function(text) {
  return text;
};

/**
 * Calls the validation function for this field, as well as all the validation
 * function for the field's class and its parents.
 * @param {string} text Proposed text.
 * @return {?string} Revised text, or null if invalid.
 */
Blockly.Field.prototype.callValidator = function(text) {
  var classResult = this.classValidator(text);
  if (classResult === null) {
    // Class validator rejects value.  Game over.
    return null;
  } else if (classResult !== undefined) {
    text = classResult;
  }
  var userValidator = this.getValidator();
  if (userValidator) {
    var userResult = userValidator.call(this, text);
    if (userResult === null) {
      // User validator rejects value.  Game over.
      return null;
    } else if (userResult !== undefined) {
      text = userResult;
    }
  }
  return text;
};

/**
 * Gets the group element for this editable field.
 * Used for measuring the size and for positioning.
 * @return {!Element} The group element.
 */
Blockly.Field.prototype.getSvgRoot = function() {
  return /** @type {!Element} */ (this.fieldGroup_);
};

/**
 * Draws the border with the correct width.
 * Saves the computed width in a property.
 * @protected
 */
Blockly.Field.prototype.render = function() {
  if (this.visible && this.textElement_) {
    // Replace the text.
    goog.dom.removeChildren(/** @type {!Element} */ (this.textElement_));
    var textNode = document.createTextNode(this.getDisplayText_());
    this.textElement_.appendChild(textNode);
    this.updateWidth();

    // Update text centering, based on newly calculated width.
    var centerTextX = (this.size_.width - this.arrowWidth_) / 2;
    if (this.sourceBlock.RTL) {
      centerTextX += this.arrowWidth_;
    }

    // In a text-editing shadow block's field,
    // if half the text length is not at least center of
    // visible field (FIELD_WIDTH), center it there instead,
    // unless there is a drop-down arrow.
    if (this.sourceBlock.isShadow() && !this.positionArrow) {
      var minOffset = Blockly.BlockSvg.FIELD_WIDTH / 2;
      if (this.sourceBlock.RTL) {
        // X position starts at the left edge of the block, in both RTL and LTR.
        // First offset by the width of the block to move to the right edge,
        // and then subtract to move to the same position as LTR.
        var minCenter = this.size_.width - minOffset;
        centerTextX = Math.min(minCenter, centerTextX);
      } else {
        // (width / 2) should exceed Blockly.BlockSvg.FIELD_WIDTH / 2
        // if the text is longer.
        centerTextX = Math.max(minOffset, centerTextX);
      }
    }

    // Apply new text element x position.
    this.textElement_.setAttribute('x', centerTextX);
  }

  // Update any drawn box to the correct width and height.
  if (this.box_) {
    this.box_.setAttribute('width', this.size_.width);
    this.box_.setAttribute('height', this.size_.height);
  }
};

/**
 * Updates thw width of the field. This calls getCachedWidth which won't cache
 * the approximated width on IE/Edge when `getComputedTextLength` fails. Once
 * it eventually does succeed, the result will be cached.
 **/
Blockly.Field.prototype.updateWidth = function() {
  var width = Blockly.Field.getCachedWidth(this.textElement_);
  // Calculate width of field
  width = Blockly.Field.getCachedWidth(this.textElement_);

  // Add padding to left and right of text.
  if (this.EDITABLE) {
    width += Blockly.BlockSvg.EDITABLE_FIELD_PADDING;
  }

  // Adjust width for drop-down arrows.
  this.arrowWidth_ = 0;
  if (this.positionArrow) {
    this.arrowWidth_ = this.positionArrow(width);
    width += this.arrowWidth_;
  }

  // Add padding to any drawn box.
  if (this.box_) {
    width += 2 * Blockly.BlockSvg.BOX_FIELD_PADDING;
  }

  // Set width of the field.
  this.size_.width = width;
};

/**
 * Gets the width of a text element, caching it in the process.
 * @param {Element} textElement An SVG 'text' element.
 * @return {number} Width of element.
 */
Blockly.Field.getCachedWidth = function(textElement) {
  var key = textElement.textContent + '\n' + textElement.className.baseVal;
  var width;

  // Return the cached width if it exists.
  if (Blockly.Field.cacheWidths_) {
    width = Blockly.Field.cacheWidths_[key];
    if (width) {
      return width;
    }
  }

  // Attempt to compute fetch the width of the SVG text element.
  try {
    width = textElement.getComputedTextLength();
  } catch (e) {
    // MSIE 11 and Edge are known to throw "Unexpected call to method or
    // property access." if the block is hidden. Instead, use an
    // approximation and do not cache the result. At some later point in time
    // when the block is inserted into the visible DOM, this method will be
    // called again and, at that point in time, will not throw an exception.
    return textElement.textContent.length * 8;
  }

  // Cache the computed width and return.
  if (Blockly.Field.cacheWidths_) {
    Blockly.Field.cacheWidths_[key] = width;
  }
  return width;
};

/**
 * Start caching field widths.  Every call to this function MUST also call
 * stopCache.  Caches must not survive between execution threads.
 */
Blockly.Field.startCache = function() {
  Blockly.Field.cacheReference_++;
  if (!Blockly.Field.cacheWidths_) {
    Blockly.Field.cacheWidths_ = {};
  }
};

/**
 * Stop caching field widths.  Unless caching was already on when the
 * corresponding call to startCache was made.
 */
Blockly.Field.stopCache = function() {
  Blockly.Field.cacheReference_--;
  if (!Blockly.Field.cacheReference_) {
    Blockly.Field.cacheWidths_ = null;
  }
};

/**
 * Returns the height and width of the field.
 * @return {!goog.math.Size} Height and width.
 */
Blockly.Field.prototype.getSize = function() {
  if (!this.size_.width) {
    this.render();
  }
  return this.size_;
};

/**
 * Returns the height and width of the field,
 * accounting for the workspace scaling.
 * @return {!goog.math.Size} Height and width.
 * @protected
 */
Blockly.Field.prototype.getScaledBBox = function() {
  var size = this.getSize();
  // Create new object, so as to not return an uneditable SVGRect in IE.
  return new goog.math.Size(size.width * this.sourceBlock.workspace.scale,
                            size.height * this.sourceBlock.workspace.scale);
};

/**
 * Get the text from this field as displayed on screen.  May differ from getText
 * due to ellipsis, and other formatting.
 * @return {string} Currently displayed text.
 * @private
 */
Blockly.Field.prototype.getDisplayText_ = function() {
  var text = this.text;
  if (!text) {
    // Prevent the field from disappearing if empty.
    return Blockly.Field.NBSP;
  }
  if (text.length > this.maxDisplayLength) {
    // Truncate displayed string and add an ellipsis ('...').
    text = text.substring(0, this.maxDisplayLength - 2) + '\u2026';
  }
  // Replace whitespace with non-breaking spaces so the text doesn't collapse.
  text = text.replace(/\s/g, Blockly.Field.NBSP);
  if (this.sourceBlock.RTL) {
    // The SVG is LTR, force text to be RTL.
    text += '\u200F';
  }
  return text;
};

/**
 * Get the text from this field.
 * @return {string} Current text.
 */
Blockly.Field.prototype.getText = function() {
  return /** @type {string} */ (this.text);
};

/**
 * Set the text in this field.  Trigger a rerender of the source block.
 * @param {*} newText New text.
 */
Blockly.Field.prototype.setText = function(newText) {
  if (newText === null) {
    // No change if null.
    return;
  }
  newText = String(newText);
  if (newText === this.text) {
    // No change.
    return;
  }
  this.text = newText;
  // Set width to 0 to force a rerender of this field.
  this.size_.width = 0;
  if (this.sourceBlock && this.sourceBlock.rendered) {
    this.sourceBlock.render();
    this.sourceBlock.bumpNeighbours();
  }
};

/**
 * Update the text node of this field to display the current text.
 * @protected
 */
Blockly.Field.prototype.updateTextNode = function() {
  if (!this.textElement_) {
    // Not rendered yet.
    return;
  }
  var text = this.text;
  if (text.length > this.maxDisplayLength) {
    // Truncate displayed string and add an ellipsis ('...').
    text = text.substring(0, this.maxDisplayLength - 2) + '\u2026';
    // Add special class for sizing font when truncated
    this.textElement_.setAttribute('class', 'blocklyText blocklyTextTruncated');
  } else {
    this.textElement_.setAttribute('class', 'blocklyText');
  }
  // Empty the text element.
  goog.dom.removeChildren(/** @type {!Element} */ (this.textElement_));
  // Replace whitespace with non-breaking spaces so the text doesn't collapse.
  text = text.replace(/\s/g, Blockly.Field.NBSP);
  if (this.sourceBlock.RTL && text) {
    // The SVG is LTR, force text to be RTL.
    text += '\u200F';
  }
  if (!text) {
    // Prevent the field from disappearing if empty.
    text = Blockly.Field.NBSP;
  }
  var textNode = document.createTextNode(text);
  this.textElement_.appendChild(textNode);

  // Cached width is obsolete.  Clear it.
  this.size_.width = 0;
};

/**
 * By default there is no difference between the human-readable text and
 * the language-neutral values.  Subclasses (such as dropdown) may define this.
 * @return {string} Current value.
 */
Blockly.Field.prototype.getValue = function() {
  return this.getText();
};

/**
 * By default there is no difference between the human-readable text and
 * the language-neutral values.  Subclasses (such as dropdown) may define this.
 * @param {string} newValue New value.
 */
Blockly.Field.prototype.setValue = function(newValue) {
  if (newValue === null) {
    // No change if null.
    return;
  }
  var oldValue = this.getValue();
  if (oldValue == newValue) {
    return;
  }
  if (this.sourceBlock && Blockly.Events.isEnabled()) {
    Blockly.Events.fire(new Blockly.Events.Change(
        this.sourceBlock, 'field', this.name, oldValue, newValue));
  }
  this.setText(newValue);
};

/**
 * Handle a mouse up event on an editable field.
 * @param {!Event} e Mouse up event.
 * @private
 */
Blockly.Field.prototype.onMouseUp_ = function(e) {
  if ((goog.userAgent.IPHONE || goog.userAgent.IPAD) &&
      !goog.userAgent.isVersionOrHigher('537.51.2') &&
      e.layerX !== 0 && e.layerY !== 0) {
    // Old iOS spawns a bogus event on the next touch after a 'prompt()' edit.
    // Unlike the real events, these have a layerX and layerY set.
    return;
  } else if (Blockly.utils.isRightButton(e)) {
    // Right-click.
    return;
  } else if (this.sourceBlock.workspace.isDragging()) {
    // Drag operation is concluding.  Don't open the editor.
    return;
  } else if (this.sourceBlock.isEditable()) {
    // Non-abstract sub-classes must define a showEditor method.
    this.showEditor();
    // The field is handling the touch, but we also want the blockSvg onMouseUp
    // handler to fire, so we will leave the touch identifier as it is.
    // The next onMouseUp is responsible for nulling it out.
  }
};

/**
 * Change the tooltip text for this field.
 * @param {string|!Element} newTip Text for tooltip or a parent element to
 *     link to for its tooltip.
 */
Blockly.Field.prototype.setTooltip = function(newTip) {
  // Non-abstract sub-classes may wish to implement this.  See FieldLabel.
};

/**
 * Select the element to bind the click handler to. When this element is
 * clicked on an editable field, the editor will open.
 *
 * <p>If the block has multiple fields, this is just the group containing the
 * field. If the block has only one field, we handle clicks over the whole
 * block.
 *
 * @return {!Element} Element to bind click handler to.
 * @private
 */
Blockly.Field.prototype.getClickTarget_ = function() {
  var nFields = 0;

  for (var i = 0, input; input = this.sourceBlock.inputList[i]; i++) {
    nFields += input.fieldRow.length;
  }

  if (nFields <= 1) {
    return this.sourceBlock.getSvgRoot();
  } else {
    return this.getSvgRoot();
  }
};

/**
 * Return the absolute coordinates of the top-left corner of this field.
 * The origin (0,0) is the top-left corner of the page body.
 * @return {!goog.math.Coordinate} Object with .x and .y properties.
 * @protected
 */
Blockly.Field.prototype.getAbsoluteXY = function() {
  return goog.style.getPageOffset(this.getClickTarget_());
};
