// ==========================================================================
// Project:   SproutCore - JavaScript Application Framework
// Copyright: ©2006-2011 Strobe Inc. and contributors.
//            Portions ©2008-2011 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

require("sproutcore-views/system/render_buffer");

// Global hash of shared templates. This will automatically be populated
// by the build tools so that you can store your Handlebars templates in
// separate files that get loaded into JavaScript at buildtime.
SC.TEMPLATES = SC.Object.create();

SC.View = SC.Object.extend(
/** @scope SC.View.prototype */ {

  concatenatedProperties: ['classNames', 'classNameBindings'],

  /** walk like a duck */
  isView: YES,

  // ..........................................................
  // TEMPLATE SUPPORT
  //

  /**
    The name of the template to lookup if no template is provided.

    SC.View will look for a template with this name in this view's
    +templates+ object. By default, this will be a global object
    shared in SC.TEMPLATES.

    @type String
  */
  templateName: null,

  /**
    The hash in which to look for +templateName+. Defaults to SC.TEMPLATES.

    @type SC.Object
  */
  templates: SC.TEMPLATES,

  /**
    The template used to render the view. This should be a function that
    accepts an optional context parameter and returns a string of HTML that
    will be inserted into the DOM relative to its parent view.

    In general, you should set the +templateName+ property instead of setting
    the template yourself.

    @field
    @type Function
  */
  template: function(key, value) {
    if (value !== undefined) {
      return value;
    }

    var templateName = this.get('templateName'),
        template = this.get('templates').get(templateName);

    // If there is no template but a templateName has been specified,
    // alert the developer.
    if (!template && templateName) {
      throw new SC.Error('%@ - Unable to find template "%@".'.fmt(this, templateName));
    }

    // return the template, or undefined if no template was found
    return template;
  }.property('templateName').cacheable(),

  /**
    The object from which templates should access properties.

    This object will be passed to the template function each time the render
    method is called, but it is up to the individual function to decide what
    to do with it.

    By default, this will be the view itself.

    @property {Object}
  */
  templateContext: function(key, value) {
    if (value !== undefined) {
      return value;
    }

    return this;
  }.property().cacheable(),

  /**
    If the view is currently inserted into the DOM of a parent view, this
    property will point to the parent of the view.

    @type SC.View
  */
  parentView: null,

  /**
    If false, the view will appear hidden in DOM.

    @type Boolean
  */
  isVisible: true,

  /**
    Array of child views.  You should never edit this array directly unless
    you are implementing createChildViews().  Most of the time, you should
    use the accessor methods such as appendChild(), insertBefore() and
    removeChild().

    @property {Array}
  */
  childViews: [],

  /**
    Called on your view when it should push strings of HTML into a
    SC.RenderBuffer.

    By default, SC.View will look for a function in the `template`
    property and invoke it with the value of `templateContext`. By default,
    `templateContext` will be the view itself.

    @param {SC.RenderBuffer} buffer the render buffer
  */
  render: function(buffer) {
    var template = this.get('template');

    if (!template) { return; }

    var context = this.get('templateContext'),
        options = {
          data: {
            view: this,
            isRenderData: true
          }
        };

    // The template should take care of rendering child views.
    this._didRenderChildViews = YES;

    var output = template(context, options);
    buffer.push(output);
  },

  /** @property
    Iterates over the view's `classNameBindings` array, inserts the value
    of the specified property into the `classNames` array, then creates an
    observer to update the view's element if the bound property ever changes
    in the future.
  */
  _applyClassNameBindings: function() {
    var classBindings = this.get('classNameBindings'),
        classNames = this.get('classNames'),
        dasherizedClass;

    if (!classBindings) { return; }

    // Loop through all of the configured bindings. These will be either
    // property names ('isUrgent') or property paths relative to the view
    // ('content.isUrgent')
    classBindings.forEach(function(property) {

      // Variable in which the old class value is saved. The observer function
      // closes over this variable, so it knows which string to remove when
      // the property changes.
      var oldClass;

      // Set up an observer on the context. If the property changes, toggle the
      // class name.
      var observer = function() {

        // Get the current value of the property
        newClass = this._classStringForProperty(property);
        elem = this.$();

        // If we had previously added a class to the element, remove it.
        if (oldClass) {
          elem.removeClass(oldClass);
        }

        // If necessary, add a new class. Make sure we keep track of it so
        // it can be removed in the future.
        if (newClass) {
          elem.addClass(newClass);
          oldClass = newClass;
        } else {
          oldClass = null;
        }
      };

      this.addObserver(property, observer);

      // Get the class name for the property at its current value
      dasherizedClass = this._classStringForProperty(property);

      if (dasherizedClass) {
        // Ensure that it gets into the classNames array
        // so it is displayed when we render.
        classNames.push(dasherizedClass);

        // Save a reference to the class name so we can remove it
        // if the observer fires. Remember that this variable has
        // been closed over by the observer.
        oldClass = dasherizedClass;
      }
    }, this);
  },

  /** @private
    Given a property name, returns a dasherized version of that
    property name if the property evaluates to a non-falsy value.

    For example, if the view has property `isUrgent` that evaluates to true,
    passing `isUrgent` to this method will return `"is-urgent"`.
  */
  _classStringForProperty: function(property) {
    var split = property.split(':'), className = split[1];
    property = split[0];

    var val = this.getPath(property);

    // If value is a Boolean and true, return the dasherized property
    // name.
    if (val === YES) {
      if (className) { return className; }

      // Normalize property path to be suitable for use
      // as a class name. For exaple, content.foo.barBaz
      // becomes bar-baz.
      return SC.String.dasherize(property.split('.').get('lastObject'));

    // If the value is not NO, undefined, or null, return the current
    // value of the property.
    } else if (val !== NO && val !== undefined && val !== null) {
      return val;

    // Nothing to display. Return null so that the old class is removed
    // but no new class is added.
    } else {
      return null;
    }
  },

  // ..........................................................
  // ELEMENT SUPPORT
  //

  /**
    Returns the current DOM element for the view.

    @property {DOMElement} the element
  */
  element: function(key, value) {
    // If the value of element is being set, just return it. SproutCore
    // will cache it for further `get` calls.
    if (value !== undefined) { return value; }

    var parent = this.get('parentView');
    if (parent) { parent = parent.get('element'); }
    if (parent) { return this.findElementInParentElement(parent); }
  }.property('parentView').cacheable(),

  /**
    Returns a jQuery object for this view's element. If you pass in a selector
    string, this method will return a jQuery object, using the current element
    as its buffer.

    For example, calling `view.$('li')` will return a jQuery object containing
    all of the `li` elements inside the DOM element of this view.

    @param {String} [selector] a jQuery-compatible selector string
    @returns {SC.CoreQuery} the CoreQuery object for the DOM node
  */
  $: function(sel) {
    var elem = this.get('element') ;

    if (!elem) {
      return SC.$();
    } else if (sel === undefined) {
      return SC.$(elem);
    } else {
      return SC.$(sel, elem);
    }
  },

  mutateChildViews: function(callback) {
    var childViews = this.get('childViews');
    var idx = childViews.get('length');
    var view;

    while(--idx >= 0) {
      view = childViews[idx];
      callback.call(this, view);
    }

    return this;
  },

  forEachChildView: function(callback) {
    var childViews = this.get('childViews');
    var len = childViews.get('length');
    var view;

    for(var idx=0; idx<len; idx++) {
      view = childViews[idx];
      callback.call(this, view);
    }

    return this;
  },

  /**
    Appends the view's element to the specified parent element.

    If the view does not have an HTML representation yet, `createElement()`
    will be called automatically.

    @param {String|DOMElement|jQuery} A selector, element, HTML string, or jQuery object
    @returns {SC.View} receiver
  */
  appendTo: function(target) {
    var elem = this.get('element');
    if (!elem) { this.createElement(); }

    this.$().appendTo(target);
    return this;
  },

  /**
    Appends the view's element to the document body. If the view does
    not have an HTML representation yet, `createElement()` will be called
    automatically.

    @returns {SC.View} receiver
  */
  append: function() {
    return this.appendTo(document.body);
  },

  /**
    Removes the view's element from the element to which it is attached.

    @returns {SC.View} receiver
  */
  remove: function() {
    // What we should really do here is wait until the end of the run loop
    // to determine if the element has been re-appended to a different element.
    // In the interim, we will just re-render if that happens. It is more
    // important than elements get garbage collected.
    this.destroyElement();
  },

  /**
    The ID to use when trying to locate the layer in the DOM.  If you do not
    set the layerId explicitly, then the view's GUID will be used instead.
    This ID must be set at the time the view is created.

    @property {String}
    @readOnly
  */
  elementId: function(key, value) {
    if (value) { return value; }
    return SC.guidFor(this) ;
  }.property().cacheable(),

  /**
    Attempts to discover the layer in the parent layer.  The default
    implementation looks for an element with an ID of layerId (or the view's
    guid if layerId is null).  You can override this method to provide your
    own form of lookup.  For example, if you want to discover your layer using
    a CSS class name instead of an ID.

    @param {DOMElement} parentLayer the parent's DOM layer
    @returns {DOMElement} the discovered layer
  */
  findElementInParentElement: function(parentElem) {
    var id = "#" + this.get('elementId');
    return jQuery(id)[0] || jQuery(id, parentElem)[0] ;
  },

  /**
    Creates a new renderBuffer with the passed tagName.  You can override this
    method to provide further customization to the buffer if needed.  Normally you
    will not need to call or override this method.

    @returns {SC.RenderBuffer}
  */
  renderBuffer: function(tagName) {
    return SC.RenderBuffer(tagName) ;
  },

  /**
    Creates a DOM representation of the view and all of its
    child views by recursively calling the `render()` method.

    After the element has been created, `didCreateElement` will
    be called on this view and all of its child views.

    @returns {SC.View} receiver
  */
  createElement: function() {
    if (this.get('element')) { return this ; } // nothing to do

    var buffer = this.renderBuffer(this.get('tagName')) ;

    // now prepare the content like normal.
    this.renderToBuffer(buffer) ;
    this.set('element', buffer.element());

    // now notify the view and its child views..
    this._notifyDidCreateElement() ;

    return this ;
  },

  didCreateElement: function() {},

  /** @private -
    Invokes the receivers didCreateLayer() method if it exists and then
    invokes the same on all child views.
  */
  _notifyDidCreateElement: function() {
    this.didCreateElement();

    this.forEachChildView(function(view) {
      view._notifyDidCreateElement();
    });
  },

  /**
    Destroys any existing layer along with the layer for any child views as
    well.  If the view does not currently have a layer, then this method will
    do nothing.

    If you implement willDestroyLayer() on your view or if any mixins
    implement willDestroLayerMixin(), then this method will be invoked on your
    view before your layer is destroyed to give you a chance to clean up any
    event handlers, etc.

    If you write a willDestroyLayer() handler, you can assume that your
    didCreateLayer() handler was called earlier for the same layer.

    Normally you will not call or override this method yourself, but you may
    want to implement the above callbacks when it is run.

    @returns {SC.View} receiver
  */
  destroyElement: function() {
    var elem = this.get('element') ;
    if (elem) {
      // Notify the view and its child views that the element is about to be
      // destroyed.
      this._notifyWillDestroyElement() ;

      // Remove this DOM element from its parent.
      SC.$(elem).remove();
      this.set('element', null);
    }
    return this ;
  },

  willDestroyElement: function() { },

  /** @private -
    Invokes the `willDestroyElement` callback on the view and child views.
  */
  _notifyWillDestroyElement: function() {
    this.willDestroyElement();

    this.forEachChildView(function(view) {
      view._notifyWillDestroyElement();
    });
  },

  /** @private
    If this view's element changes, we need to invalidate the caches of our
    child views so that we do not retain references to DOM elements that are no
    longer needed.

    @observes element
  */
  _sccv_elementDidChange: function() {
    this.forEachChildView(function(view) {
      view.notifyPropertyChange('element');
    });
  }.observes('element'),

  parentViewDidChange: function() { },

  /**
    @private

    Renders to a buffer.
    Rendering only happens for the initial rendering. Further updates happen in updateLayer,
    and are not done to buffers, but to elements.
    Note: You should not generally override nor directly call this method. This method is only
    called by createLayer to set up the layer initially, and by renderChildViews, to write to
    a buffer.

    @param {SC.RenderBuffer} buffer the render buffer.
  */
  renderToBuffer: function(buffer) {
    var mixins, idx, len;

    this.beginPropertyChanges();
    this.set('elementNeedsUpdate', NO);

    this.applyAttributesToBuffer(buffer);
    this.render(buffer);

    // If we've made it this far and renderChildViews() was never called,
    // render any child views now.
    if (!this._didRenderChildViews) { this.renderChildViews(buffer); }

    // Reset the flag so that if the element is recreated we re-render the child views
    this._didRenderChildViews = NO;

    this.endPropertyChanges();
  },

  applyAttributesToBuffer: function(buffer) {
    // Creates observers for all registered class name bindings,
    // then adds them to the classNames array.
    this._applyClassNameBindings();

    buffer.addClass(this.get('classNames').join(' '));
    buffer.id(this.get('elementId'));
    buffer.attr('role', this.get('ariaRole'));

    if (!this.get('isVisible')) {
      buffer.style('display', 'none');
    }
  },

  /**
    Your render method should invoke this method to render any child views,
    especially if this is the first time the view will be rendered.  This will
    walk down the childView chain, rendering all of the children in a nested
    way.

    @param {SC.RenderBuffer} buffer the buffer
    @param {Boolean} firstName true if the layer is being created
    @returns {SC.RenderBuffer} the render buffer
    @test in render
  */
  renderChildViews: function(buffer) {
    this.forEachChildView(function(view) {
      buffer = buffer.begin(view.get('tagName'));
      view.renderToBuffer(buffer);
      buffer = buffer.end();
    });

    this._didRenderChildViews = YES;

    return buffer;
  },

  // ..........................................................
  // STANDARD RENDER PROPERTIES
  //

  /**
    Tag name for the view's outer element.  The tag name is only used when
    a layer is first created.  If you change the tagName for an element, you
    must destroy and recreate the view layer.

    @property {String}
  */
  tagName: 'div',

  /**
    The WAI-ARIA role of the control represented by this view. For example, a
    button may have a role of type 'button', or a pane may have a role of
    type 'alertdialog'. This property is used by assistive software to help
    visually challenged users navigate rich web applications.

    The full list of valid WAI-ARIA roles is available at:
    http://www.w3.org/TR/wai-aria/roles#roles_categorization

    @property {String}
  */
  ariaRole: null,

  /**
    Standard CSS class names to apply to the view's outer element.  This
    property automatically inherits any class names defined by the view's
    superclasses as well.

    @property {Array}
  */
  classNames: ['sc-view'],

  /**
    A list of properties of the view to apply as class names. If the property
    is a string value, the value of that string will be applied as a class
    name.

        // Applies the 'high' class to the view element
        SC.View.create({
          classNameBindings: ['priority']
          priority: 'high'
        });

    If the value of the property is a Boolean, the name of that property is
    added as a dasherized class name.

        // Applies the 'is-urgent' class to the view element
        SC.View.create({
          classNameBindings: ['isUrgent']
          isUrgent: true
        });

    If you would prefer to use a custom value instead of the dasherized
    property name, you can pass a binding like this:

        // Applies the 'urgent' class to the view element
        SC.View.create({
          classNameBindings: ['isUrgent:urgent']
          isUrgent: true
        });

    This list of properties is inherited from the view's superclasses as well.

    @type Array
  */

  classNameBindings: [],

  // .......................................................
  // CORE DISPLAY METHODS
  //

  /** @private
    Setup a view, but do not finish waking it up.
    - configure childViews
    - Determine the view's theme
    - Fetch a render delegate from the theme, if necessary
    - register the view with the global views hash, which is used for event
      dispatch
  */
  init: function() {
    var parentView = this.get('parentView');

    sc_super();

    // Register the view for event handling. This hash is used by
    // SC.RootResponder to dispatch incoming events.
    SC.View.views[this.get('elementId')] = this;

    // setup child views.  be sure to clone the child views array first
    this.childViews = this.get('childViews').slice();
    this.classNameBindings = this.get('classNameBindings').slice();
    this.classNames = this.get('classNames').slice();

    this.createChildViews(); // setup child Views
  },

  /**
    Removes the child view from the parent view.

    @param {SC.View} view
    @returns {SC.View} receiver
  */
  removeChild: function(view) {
    // update parent node
    view.set('parentView', null) ;

    // remove view from childViews array.
    var childViews = this.get('childViews');
    childViews.removeObject(view);

    return this ;
  },

  /**
    Removes all children from the parentView.

    @returns {SC.View} receiver
  */
  removeAllChildren: function() {
    return this.mutateChildViews(function(view) {
      this.removeChild(view);
    });
  },

  /**
    Removes the view from its parentView, if one is found.  Otherwise
    does nothing.

    @returns {SC.View} receiver
  */
  removeFromParent: function() {
    var parent = this.get('parentView') ;
    if (parent) { parent.removeChild(this) ; }
    return this ;
  },

  /**
    You must call this method on a view to destroy the view (and all of its
    child views). This will remove the view from any parent node, then make
    sure that the DOM element managed by the view can be released by the
    memory manager.
  */
  destroy: function() {
    if (this.get('isDestroyed')) { return this; } // nothing to do

    // destroy the element -- this will avoid each child view destroying
    // the element over and over again...
    this.destroyElement() ;

    // first destroy any children.
    this.mutateChildViews(function(view) {
      view.destroy();
    });

    // next remove view from global hash
    delete SC.View.views[this.get('elementId')] ;

    // remove from parent if found
    if (this.get('parentView')) { this.removeFromParent(); }

    //Do generic destroy. It takes care of mixins and sets isDestroyed to YES.
    sc_super();
    return this; // done with cleanup
  },

  /**
    This method is called when your view is first created to setup any  child
    views that are already defined on your class.  If any are found, it will
    instantiate them for you.

    The default implementation of this method simply steps through your
    childViews array, which is expects to either be empty or to contain View
    designs that can be instantiated

    Alternatively, you can implement this method yourself in your own
    subclasses to look for views defined on specific properties and then build
     a childViews array yourself.

    Note that when you implement this method yourself, you should never
    instantiate views directly.  Instead, you should use
    this.createChildView() method instead.  This method can be much faster in
    a production environment than creating views yourself.

    @returns {SC.View} receiver
  */
  createChildViews: function() {
    var childViews = this.get('childViews'),
        len        = childViews.length,
        idx, key, views, view ;

    this.beginPropertyChanges() ;

    // swap the array
    for (idx=0; idx<len; ++idx) {
      key = view = childViews[idx];
      if (key) {

        // is this is a key name, lookup view class
        if (typeof key === SC.T_STRING) {
          view = this[key];
        } else {
          key = null ;
        }

        if (!view) {
          //@if (debug)
          SC.Logger.error ("No view with name "+key+" has been found in "+this.toString());
          //@endif
          // skip this one.
          continue;
        }

        // createChildView creates the view if necessary, but also sets
        // important properties, such as parentView
        view = this.createChildView(view) ;
        if (key) { this[key] = view ; } // save on key name if passed
      }
      childViews[idx] = view;
    }

    this.endPropertyChanges() ;
    return this ;
  },

  /**
    Instantiates a view to be added to the childViews array during view
    initialization. You generally will not call this method directly unless
    you are overriding createChildViews(). Note that this method will
    automatically configure the correct settings on the new view instance to
    act as a child of the parent.

    @param {Class} viewClass
    @param {Hash} attrs optional attributes to add
    @returns {SC.View} new instance
    @test in createChildViews
  */
  createChildView: function(view, attrs) {
    if (!view.isClass) {
      attrs = view;
    } else {
      // attrs should always exist...
      if (!attrs) { attrs = {} ; }
      // clone the hash that was given so we dont pollute it if it's being reused
      else { attrs = SC.clone(attrs); }
    }

    SC.set(attrs, 'parentView', this) ;

    // Now add this to the attributes and create.
    if (view.isClass) { view = view.create(attrs); }

    return view ;
  },

  /** @private
   When the view's `isVisible` property changes, toggle the visibility element
   of the actual DOM element.
  */
  _isVisibleDidChange: function() {
    this.$().toggle(this.get('isVisible'));
  }.observes('isVisible')
});

// Create a global view hash.
SC.View.views = {};
