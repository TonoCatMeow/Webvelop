/* eslint-disable */
/*!
 * Webvelop runtime - runs the interactions, behaviors, state and React
 * components of websites made with Webvelop.
 * This file is copied, as is, into every exported website (js/webvelop-runtime.js).
 * It has no dependency (React is only needed if the website uses React components).
 */
(function (global) {
  'use strict';
  if (global.Webvelop && global.Webvelop.__isRuntime) return;

  var doc = global.document;
  var hasOwn = Object.prototype.hasOwnProperty;

  // ---------------------------------------------------------------------------
  // Registries (extensible: Webvelop.registerAction/Condition/Trigger/Behavior)
  // ---------------------------------------------------------------------------
  var actions = {};
  var conditions = {};
  var triggers = {};
  var behaviors = {};
  var codeFunctions = {};
  var customActions = {};
  var reactFactories = {};
  var reactComponentsCache = {};
  var readyCallbacks = [];
  var siteScripts = [];
  var pageScripts = [];

  var siteConfig = { name: '', pages: [], variables: [], globalEvents: [], components: {}, customActions: [] };
  var pageConfig = { id: '', name: '', slug: '', events: [], elements: {} };
  var mode = 'site';
  var started = false;

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  var toArray = function (list) {
    return Array.prototype.slice.call(list || []);
  };
  var escapeHtml = function (text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  var textToHtml = function (text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  };
  var wait = function (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Math.max(0, ms || 0));
    });
  };
  var toNumber = function (value) {
    var number = parseFloat(value);
    return isNaN(number) ? 0 : number;
  };
  var reportError = function (error, where) {
    var message = (error && error.message) || String(error);
    if (global.console) console.error('[Webvelop] ' + (where ? where + ': ' : '') + message, error);
    if (mode === 'preview' && global.parent && global.parent !== global) {
      try {
        global.parent.postMessage({ type: 'webvelop:error', message: message, where: where || '' }, '*');
      } catch (e) {}
    }
  };

  // ---------------------------------------------------------------------------
  // State (website variables)
  // ---------------------------------------------------------------------------
  var stateValues = {};
  var stateListeners = {};
  var anyStateListeners = [];
  var persistedVariables = {};
  var storagePrefix = 'webvelop:';

  var parseInitialValue = function (variable) {
    var raw = variable.initialValue;
    switch (variable.type) {
      case 'number':
        return toNumber(raw);
      case 'boolean':
        return raw === true || raw === 'true';
      case 'json':
        try {
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          reportError(e, 'Initial value of variable ' + variable.name);
          return null;
        }
      default:
        return raw == null ? '' : String(raw);
    }
  };

  var notifyState = function (name, value, oldValue) {
    toArray(stateListeners[name]).forEach(function (listener) {
      try {
        listener(value, oldValue, name);
      } catch (e) {
        reportError(e, 'Variable listener');
      }
    });
    toArray(anyStateListeners).forEach(function (listener) {
      try {
        listener(name, value, oldValue);
      } catch (e) {
        reportError(e, 'Variable listener');
      }
    });
  };

  var state = {
    get: function (name) {
      return stateValues[name];
    },
    set: function (name, value) {
      var oldValue = stateValues[name];
      if (oldValue === value) return;
      stateValues[name] = value;
      if (persistedVariables[name]) {
        try {
          global.localStorage.setItem(storagePrefix + siteConfig.name + ':' + name, JSON.stringify(value));
        } catch (e) {}
      }
      notifyState(name, value, oldValue);
    },
    subscribe: function (name, listener) {
      if (typeof name === 'function') {
        var anyListener = name;
        anyStateListeners.push(anyListener);
        return function () {
          anyStateListeners = anyStateListeners.filter(function (l) {
            return l !== anyListener;
          });
        };
      }
      (stateListeners[name] = stateListeners[name] || []).push(listener);
      return function () {
        stateListeners[name] = (stateListeners[name] || []).filter(function (l) {
          return l !== listener;
        });
      };
    },
    all: function () {
      var copy = {};
      Object.keys(stateValues).forEach(function (key) {
        copy[key] = stateValues[key];
      });
      return copy;
    },
  };

  var initializeState = function () {
    (siteConfig.variables || []).forEach(function (variable) {
      var value = parseInitialValue(variable);
      if (variable.persist) {
        persistedVariables[variable.name] = true;
        try {
          var stored = global.localStorage.getItem(storagePrefix + siteConfig.name + ':' + variable.name);
          if (stored !== null) value = JSON.parse(stored);
        } catch (e) {}
      }
      stateValues[variable.name] = value;
    });
  };

  /** Replace {{state.x}}, {{page.name}} and {{site.name}} in a text. */
  var interpolate = function (text) {
    if (typeof text !== 'string' || text.indexOf('{{') === -1) return text;
    return text.replace(/\{\{\s*([a-zA-Z_$][\w$]*)\.([\w$.]+)\s*\}\}/g, function (match, scope, path) {
      var value;
      if (scope === 'state') {
        var parts = path.split('.');
        value = stateValues[parts[0]];
        for (var i = 1; i < parts.length && value != null; i++) value = value[parts[i]];
      } else if (scope === 'page') value = pageConfig[path];
      else if (scope === 'site') value = siteConfig[path];
      else return match;
      if (value == null) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  };

  // ---------------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------------
  var findTargets = function (target, scope, self) {
    if (!target || target === '$self') return self ? [self] : [];
    if (target === '$page') return [doc.body];
    if (target === '$parent') return self && self.parentElement ? [self.parentElement] : [];
    if (target.nodeType) return [target];
    var selector = '.wv-' + target;
    if (scope && scope !== doc) {
      var inScope = toArray(scope.querySelectorAll(selector));
      if (scope.matches && scope.matches(selector)) inScope.unshift(scope);
      if (inScope.length) return inScope;
    }
    return toArray(doc.querySelectorAll(selector));
  };

  var isHidden = function (element) {
    if (element.classList.contains('wv-hidden')) return true;
    if (element.classList.contains('wv-shown')) return false;
    return global.getComputedStyle(element).display === 'none';
  };
  var show = function (element) {
    element.classList.remove('wv-hidden');
    element.classList.add('wv-shown');
  };
  var hide = function (element) {
    element.classList.remove('wv-shown');
    element.classList.add('wv-hidden');
  };
  var toggle = function (element) {
    if (isHidden(element)) show(element);
    else hide(element);
  };

  var getElementsByName = function (nameOrId) {
    var id = (pageConfig.elements && pageConfig.elements[nameOrId]) || nameOrId;
    return findTargets(id, doc, null);
  };

  var getTextNode = function (element) {
    return element.querySelector(':scope > .wv-label') || element;
  };
  var setElementText = function (element, text, template) {
    var node = getTextNode(element);
    if (template !== undefined) {
      if (template.indexOf('{{') !== -1) node.setAttribute('data-wv-text', template);
      else node.removeAttribute('data-wv-text');
    }
    node.innerHTML = textToHtml(text);
  };

  var refreshBindings = function (root) {
    toArray((root || doc).querySelectorAll('[data-wv-text]')).forEach(function (node) {
      node.innerHTML = textToHtml(interpolate(node.getAttribute('data-wv-text')));
    });
    toArray((root || doc).querySelectorAll('[data-wv-visible-if]')).forEach(function (node) {
      var fn = codeFunctions[node.getAttribute('data-wv-visible-if')];
      if (!fn) return;
      var visible = false;
      try {
        visible = !!fn(state.all(), Webvelop);
      } catch (e) {
        reportError(e, 'Visibility condition');
      }
      if (visible) node.classList.remove('wv-hidden');
      else node.classList.add('wv-hidden');
    });
  };

  // ---------------------------------------------------------------------------
  // Element handles: control the elements of the page with JavaScript.
  // Webvelop.$('Element name') returns a handle working on all the DOM
  // elements of this element (several when it is inside a repeated component).
  // ---------------------------------------------------------------------------
  var animationNames = ['fade-in', 'fade-out', 'fade-up', 'fade-down', 'zoom-in', 'bounce', 'shake', 'pulse', 'spin', 'wobble'];

  function ElementHandle(nodes, reference) {
    this.nodes = toArray(nodes).filter(Boolean);
    this.reference = reference || '';
  }
  ElementHandle.prototype = {
    /** The first DOM element (or null). */
    get dom() {
      return this.nodes[0] || null;
    },
    get exists() {
      return this.nodes.length > 0;
    },
    get count() {
      return this.nodes.length;
    },
    each: function (callback) {
      this.nodes.forEach(function (node, index) {
        callback(new ElementHandle([node]), index);
      });
      return this;
    },
    _forEach: function (callback) {
      if (!this.nodes.length && this.reference) {
        console.warn('[Webvelop] No element found for "' + this.reference + '".');
      }
      this.nodes.forEach(callback);
      return this;
    },
    // Content
    text: function (value) {
      if (value === undefined) return this.dom ? getTextNode(this.dom).textContent : '';
      var template = String(value);
      var text = interpolate(template);
      return this._forEach(function (node) {
        setElementText(node, text, template);
      });
    },
    html: function (value) {
      if (value === undefined) return this.dom ? this.dom.innerHTML : '';
      return this._forEach(function (node) {
        node.innerHTML = String(value);
      });
    },
    value: function (value) {
      var fieldOf = function (node) {
        return node.matches('input, textarea, select') ? node : node.querySelector('input, textarea, select');
      };
      if (value === undefined) {
        var field = this.dom ? fieldOf(this.dom) : null;
        if (!field) return '';
        return field.type === 'checkbox' ? field.checked : field.value;
      }
      return this._forEach(function (node) {
        var field = fieldOf(node);
        if (!field) return;
        if (field.type === 'checkbox') field.checked = !!value && value !== 'false';
        else field.value = String(value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    attr: function (name, value) {
      if (value === undefined) return this.dom ? this.dom.getAttribute(name) : null;
      return this._forEach(function (node) {
        if (value === null) node.removeAttribute(name);
        else node.setAttribute(name, String(value));
      });
    },
    // Visibility
    show: function () {
      return this._forEach(show);
    },
    hide: function () {
      return this._forEach(hide);
    },
    toggle: function (visible) {
      return this._forEach(function (node) {
        if (visible === undefined) toggle(node);
        else if (visible) show(node);
        else hide(node);
      });
    },
    isVisible: function () {
      return !!this.dom && !isHidden(this.dom);
    },
    // Classes and styles
    addClass: function (className) {
      return this._forEach(function (node) {
        node.classList.add(className);
      });
    },
    removeClass: function (className) {
      return this._forEach(function (node) {
        node.classList.remove(className);
      });
    },
    toggleClass: function (className, force) {
      return this._forEach(function (node) {
        if (force === undefined) node.classList.toggle(className);
        else node.classList.toggle(className, !!force);
      });
    },
    hasClass: function (className) {
      return !!this.dom && this.dom.classList.contains(className);
    },
    css: function (property, value) {
      if (property && typeof property === 'object') {
        var styles = property;
        return this._forEach(function (node) {
          Object.keys(styles).forEach(function (key) {
            if (key.indexOf('--') === 0) node.style.setProperty(key, styles[key]);
            else node.style[key] = styles[key];
          });
        });
      }
      if (value === undefined) return this.dom ? global.getComputedStyle(this.dom)[property] : '';
      return this._forEach(function (node) {
        if (property.indexOf('--') === 0) node.style.setProperty(property, value);
        else node.style[property] = value;
      });
    },
    // Size and position
    rect: function () {
      if (!this.dom) return { x: 0, y: 0, width: 0, height: 0 };
      var r = this.dom.getBoundingClientRect();
      return { x: r.left + global.scrollX, y: r.top + global.scrollY, width: r.width, height: r.height };
    },
    size: function (width, height) {
      if (width === undefined) {
        var r = this.rect();
        return { width: r.width, height: r.height };
      }
      var toCss = function (value) {
        return typeof value === 'number' ? value + 'px' : value;
      };
      return this._forEach(function (node) {
        if (width !== null) node.style.width = toCss(width);
        if (height !== undefined && height !== null) node.style.height = toCss(height);
      });
    },
    /** Move the element by an offset (in pixels) from its place in the layout. */
    moveTo: function (x, y) {
      return this._forEach(function (node) {
        if (global.getComputedStyle(node).position === 'static') node.style.position = 'relative';
        node.style.left = x + 'px';
        node.style.top = y + 'px';
      });
    },
    scrollIntoView: function (smooth) {
      if (this.dom) this.dom.scrollIntoView({ behavior: smooth === false ? 'auto' : 'smooth', block: 'start' });
      return this;
    },
    // Events
    on: function (eventName, handler) {
      return this._forEach(function (node) {
        var listener = function (event) {
          handler.call(node, event, new ElementHandle([node]));
        };
        node.__wvListeners = node.__wvListeners || [];
        node.__wvListeners.push({ eventName: eventName, handler: handler, listener: listener });
        node.addEventListener(eventName, listener);
      });
    },
    off: function (eventName, handler) {
      return this._forEach(function (node) {
        node.__wvListeners = (node.__wvListeners || []).filter(function (entry) {
          var matches = entry.eventName === eventName && (!handler || entry.handler === handler);
          if (matches) node.removeEventListener(eventName, entry.listener);
          return !matches;
        });
      });
    },
    onClick: function (handler) {
      return this.on('click', handler);
    },
    click: function () {
      return this._forEach(function (node) {
        node.click();
      });
    },
    focus: function () {
      if (this.dom) {
        var field = this.dom.matches('input, textarea, select, button, a') ? this.dom : this.dom.querySelector('input, textarea, select, button, a');
        (field || this.dom).focus();
      }
      return this;
    },
    enable: function (enabled) {
      var disabled = enabled === false;
      return this._forEach(function (node) {
        var fields = node.matches('input, textarea, select, button') ? [node] : toArray(node.querySelectorAll('input, textarea, select, button'));
        fields.forEach(function (field) {
          field.disabled = disabled;
        });
      });
    },
    disable: function () {
      return this.enable(false);
    },
    // Animations
    animate: function (name, duration) {
      if (animationNames.indexOf(name) === -1) console.warn('[Webvelop] Unknown animation "' + name + '". Available: ' + animationNames.join(', '));
      var promises = this.nodes.map(function (node) {
        if (name !== 'fade-out' && isHidden(node)) show(node);
        return playAnimation(node, name, duration || 600);
      });
      return Promise.all(promises);
    },
    // Widgets (behaviors)
    behavior: function (name) {
      return this.dom && this.dom.__webvelop ? this.dom.__webvelop[name] || null : null;
    },
    openPopup: function () {
      var api = this.behavior('modal');
      if (api) api.open();
      return this;
    },
    closePopup: function () {
      var api = this.behavior('modal');
      if (api) api.close();
      return this;
    },
    // Tree
    find: function (nameOrId) {
      var id = (pageConfig.elements && pageConfig.elements[nameOrId]) || nameOrId;
      var found = [];
      this.nodes.forEach(function (node) {
        toArray(node.querySelectorAll('.wv-' + id)).forEach(function (child) {
          found.push(child);
        });
      });
      return new ElementHandle(found, nameOrId);
    },
    parent: function () {
      var parents = [];
      this.nodes.forEach(function (node) {
        var parent = node.parentElement ? node.parentElement.closest('[class*="wv-"]') : null;
        if (parent && parents.indexOf(parent) === -1) parents.push(parent);
      });
      return new ElementHandle(parents);
    },
    remove: function () {
      return this._forEach(function (node) {
        node.remove();
      });
    },
  };

  var getHandle = function (target) {
    if (target instanceof ElementHandle) return target;
    if (target && target.nodeType) return new ElementHandle([target]);
    if (Array.isArray(target)) return new ElementHandle(target);
    return new ElementHandle(getElementsByName(String(target)), String(target));
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  var findPage = function (reference) {
    var pages = siteConfig.pages || [];
    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];
      if (page.id === reference || page.slug === reference || page.name === reference || page.file === reference)
        return page;
    }
    return null;
  };
  var goToPage = function (reference, hash) {
    var page = findPage(reference);
    if (!page) {
      reportError(new Error('Unknown page "' + reference + '"'), 'Navigation');
      return;
    }
    if (mode === 'preview' && global.parent !== global) {
      global.parent.postMessage({ type: 'webvelop:navigate', pageId: page.id, hash: hash || '' }, '*');
      return;
    }
    global.location.href = page.file + (hash || '');
  };

  // ---------------------------------------------------------------------------
  // Running interactions
  // ---------------------------------------------------------------------------
  var makeContext = function (base) {
    var context = {
      element: base.element || null,
      event: base.event || null,
      scope: base.scope || doc,
      state: state,
      Webvelop: Webvelop,
    };
    context.targets = function (target) {
      return findTargets(target, context.scope, context.element);
    };
    return context;
  };

  var evaluateCondition = function (condition, context) {
    var implementation = conditions[condition.type];
    if (!implementation) {
      reportError(new Error('Unknown condition "' + condition.type + '"'), 'Interactions');
      return false;
    }
    var result = implementation(condition.params || {}, context, condition);
    return Promise.resolve(result).then(function (value) {
      return condition.negate ? !value : !!value;
    });
  };

  var runAction = function (action, context) {
    var implementation = actions[action.type];
    if (!implementation && action.type.indexOf('custom:') === 0) {
      implementation = customActions[action.type.substring(7)];
    }
    if (!implementation) {
      reportError(new Error('Unknown action "' + action.type + '"'), 'Interactions');
      return Promise.resolve();
    }
    try {
      return Promise.resolve(implementation(action.params || {}, context, action));
    } catch (e) {
      return Promise.reject(e);
    }
  };

  var runInstructions = function (list, context) {
    var index = 0;
    var next = function () {
      while (index < list.length && list[index].disabled) index++;
      if (index >= list.length) return Promise.resolve();
      var action = list[index++];
      return runAction(action, context)
        .catch(function (error) {
          reportError(error, 'Action "' + action.type + '"');
        })
        .then(next);
    };
    return next();
  };

  var runEvent = function (event, base) {
    var context = makeContext(base);
    var list = event.conditions || [];
    var index = 0;
    var checkNext = function () {
      if (index >= list.length) return Promise.resolve(true);
      return evaluateCondition(list[index++], context).then(function (result) {
        return result ? checkNext() : false;
      });
    };
    return checkNext()
      .then(function (ok) {
        return runInstructions(ok ? event.actions || [] : event.elseActions || [], context);
      })
      .catch(function (error) {
        reportError(error, 'Interaction "' + (event.name || event.trigger.type) + '"');
      });
  };

  var bindEvent = function (event, scope) {
    if (event.disabled || !event.trigger) return;
    var trigger = triggers[event.trigger.type];
    if (!trigger) {
      reportError(new Error('Unknown trigger "' + event.trigger.type + '"'), 'Interactions');
      return;
    }
    var target = event.trigger.target;
    var elements = target && target !== '$page' ? findTargets(target, scope, null) : [];
    try {
      trigger({
        event: event,
        params: event.trigger.params || {},
        elements: elements,
        scope: scope,
        run: function (element, domEvent) {
          return runEvent(event, { element: element, event: domEvent, scope: scope });
        },
      });
    } catch (e) {
      reportError(e, 'Trigger "' + event.trigger.type + '"');
    }
  };

  // ---------------------------------------------------------------------------
  // Built-in triggers
  // ---------------------------------------------------------------------------
  var domTrigger = function (domEventName, options) {
    return function (setup) {
      setup.elements.forEach(function (element) {
        element.addEventListener(domEventName, function (domEvent) {
          if (options && options.prevent && setup.params.preventDefault !== false) domEvent.preventDefault();
          setup.run(element, domEvent);
        });
      });
    };
  };
  triggers.click = domTrigger('click');
  triggers.dblclick = domTrigger('dblclick');
  triggers.mouseenter = domTrigger('mouseenter');
  triggers.mouseleave = domTrigger('mouseleave');
  triggers.input = domTrigger('input');
  triggers.change = domTrigger('change');
  triggers.focus = domTrigger('focus');
  triggers.blur = domTrigger('blur');
  triggers.submit = domTrigger('submit', { prevent: true });
  triggers.inView = function (setup) {
    if (!global.IntersectionObserver) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (setup.params.once !== false) observer.unobserve(entry.target);
        setup.run(entry.target, null);
      });
    }, { threshold: 0.2 });
    setup.elements.forEach(function (element) {
      observer.observe(element);
    });
  };
  triggers.outOfView = function (setup) {
    if (!global.IntersectionObserver) return;
    var seen = [];
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) seen.push(entry.target);
        else if (seen.indexOf(entry.target) !== -1) setup.run(entry.target, null);
      });
    });
    setup.elements.forEach(function (element) {
      observer.observe(element);
    });
  };
  triggers.pageLoad = function (setup) {
    readyCallbacks.push(function () {
      setup.run(doc.body, null);
    });
  };
  triggers.scroll = function (setup) {
    var distance = toNumber(setup.params.distance);
    var direction = setup.params.direction || 'down';
    var wasPast = global.scrollY > distance;
    global.addEventListener('scroll', function () {
      var isPast = global.scrollY > distance;
      if (isPast !== wasPast) {
        if ((direction === 'down' && isPast) || (direction === 'up' && !isPast)) setup.run(doc.body, null);
        wasPast = isPast;
      }
    }, { passive: true });
    if (direction === 'down' && wasPast) readyCallbacks.push(function () { setup.run(doc.body, null); });
  };
  triggers.keydown = function (setup) {
    var key = String(setup.params.key || '').toLowerCase();
    doc.addEventListener('keydown', function (domEvent) {
      if (!key || String(domEvent.key).toLowerCase() === key) setup.run(doc.body, domEvent);
    });
  };
  triggers.timer = function (setup) {
    var delay = Math.max(0, toNumber(setup.params.delay) * 1000);
    readyCallbacks.push(function () {
      if (setup.params.repeat) setInterval(function () { setup.run(doc.body, null); }, Math.max(delay, 50));
      else setTimeout(function () { setup.run(doc.body, null); }, delay);
    });
  };
  triggers.variableChanged = function (setup) {
    state.subscribe(setup.params.variable, function () {
      setup.run(doc.body, null);
    });
  };
  var getBreakpoint = function () {
    var width = global.innerWidth;
    if (width <= 767) return 'mobile';
    if (width <= 991) return 'tablet';
    return 'desktop';
  };
  triggers.breakpointChanged = function (setup) {
    var current = getBreakpoint();
    global.addEventListener('resize', function () {
      var breakpoint = getBreakpoint();
      if (breakpoint !== current) {
        current = breakpoint;
        if (breakpoint === setup.params.breakpoint) setup.run(doc.body, null);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Built-in conditions
  // ---------------------------------------------------------------------------
  var compare = function (left, operator, right) {
    var leftNumber = parseFloat(left);
    var rightNumber = parseFloat(right);
    var numeric = !isNaN(leftNumber) && !isNaN(rightNumber) && String(right).trim() !== '';
    switch (operator) {
      case '==':
        return numeric ? leftNumber === rightNumber : String(left) === String(right);
      case '!=':
        return numeric ? leftNumber !== rightNumber : String(left) !== String(right);
      case '<':
        return leftNumber < rightNumber;
      case '<=':
        return leftNumber <= rightNumber;
      case '>':
        return leftNumber > rightNumber;
      case '>=':
        return leftNumber >= rightNumber;
      case 'contains':
        return String(left).toLowerCase().indexOf(String(right).toLowerCase()) !== -1;
      case 'empty':
        return left == null || String(left).trim() === '';
      case 'notEmpty':
        return !(left == null || String(left).trim() === '');
      default:
        return false;
    }
  };
  var getFieldValue = function (element) {
    var field = element.matches('input, textarea, select') ? element : element.querySelector('input, textarea, select');
    if (!field) return '';
    if (field.type === 'checkbox') return field.checked;
    return field.value;
  };
  var getForm = function (element) {
    if (!element) return null;
    return element.tagName === 'FORM' ? element : element.closest('form') || element.querySelector('form');
  };
  conditions.formIsValid = function (params, context) {
    return context.targets(params.target).every(function (element) {
      var form = getForm(element);
      return form ? form.checkValidity() : true;
    });
  };
  conditions.inputValue = function (params, context) {
    var elements = context.targets(params.target);
    return elements.length > 0 && elements.every(function (element) {
      return compare(getFieldValue(element), params.operator, interpolate(params.value));
    });
  };
  conditions.isChecked = function (params, context) {
    var elements = context.targets(params.target);
    return elements.length > 0 && elements.every(function (element) {
      return getFieldValue(element) === true;
    });
  };
  conditions.isVisible = function (params, context) {
    var elements = context.targets(params.target);
    return elements.length > 0 && elements.every(function (element) {
      return !isHidden(element);
    });
  };
  conditions.hasClass = function (params, context) {
    var elements = context.targets(params.target);
    return elements.length > 0 && elements.every(function (element) {
      return element.classList.contains(params.className);
    });
  };
  conditions.variableCompare = function (params) {
    return compare(state.get(params.variable), params.operator, interpolate(params.value));
  };
  conditions.screenSize = function (params) {
    return getBreakpoint() === params.breakpoint;
  };
  conditions.currentPage = function (params) {
    var page = findPage(params.page);
    return !!page && page.id === pageConfig.id;
  };
  /** The elements given to the code of a JavaScript action/condition (like the objects of a code event). */
  var getCodeElements = function (params, context) {
    var elements = { self: getHandle(context.element ? [context.element] : []) };
    (params.elements || []).forEach(function (entry) {
      if (entry && entry.id && entry.as) elements[entry.as] = new ElementHandle(context.targets(entry.id), entry.as);
    });
    return elements;
  };
  conditions.javascript = function (params, context, condition) {
    var fn = codeFunctions[condition.id];
    if (!fn) return false;
    return fn(context.element, context.event, state, Webvelop, context, getCodeElements(params, context));
  };

  // ---------------------------------------------------------------------------
  // Built-in actions
  // ---------------------------------------------------------------------------
  var each = function (params, context, callback) {
    context.targets(params.target).forEach(callback);
  };
  actions.show = function (params, context) {
    each(params, context, show);
  };
  actions.hide = function (params, context) {
    each(params, context, hide);
  };
  actions.toggleVisibility = function (params, context) {
    each(params, context, toggle);
  };
  actions.addClass = function (params, context) {
    each(params, context, function (element) {
      element.classList.add(params.className);
    });
  };
  actions.removeClass = function (params, context) {
    each(params, context, function (element) {
      element.classList.remove(params.className);
    });
  };
  actions.toggleClass = function (params, context) {
    each(params, context, function (element) {
      element.classList.toggle(params.className);
    });
  };
  actions.setStyle = function (params, context) {
    var value = interpolate(String(params.value));
    each(params, context, function (element) {
      element.style[params.property] = value;
    });
  };
  var playAnimation = function (element, name, duration) {
    return new Promise(function (resolve) {
      var className = 'wv-anim-' + name;
      element.style.animationDuration = duration + 'ms';
      element.classList.remove(className);
      // Force a reflow so that the animation can be replayed.
      void element.offsetWidth;
      element.classList.add('wv-anim-run', className);
      setTimeout(function () {
        element.classList.remove('wv-anim-run', className);
        element.style.animationDuration = '';
        if (name === 'fade-out') hide(element);
        resolve();
      }, duration);
    });
  };
  actions.animate = function (params, context) {
    var duration = toNumber(params.duration) || 600;
    var promises = context.targets(params.target).map(function (element) {
      if (params.animation !== 'fade-out' && isHidden(element)) show(element);
      return playAnimation(element, params.animation, duration);
    });
    if (params.wait) return Promise.all(promises);
  };
  actions.setText = function (params, context) {
    var template = String(params.text == null ? '' : params.text);
    var text = interpolate(template);
    each(params, context, function (element) {
      setElementText(element, text, template);
    });
  };
  actions.setAttribute = function (params, context) {
    var value = interpolate(String(params.value));
    each(params, context, function (element) {
      element.setAttribute(params.name, value);
    });
  };
  actions.setInputValue = function (params, context) {
    var value = interpolate(String(params.value));
    each(params, context, function (element) {
      var field = element.matches('input, textarea, select') ? element : element.querySelector('input, textarea, select');
      if (!field) return;
      if (field.type === 'checkbox') field.checked = value === 'true';
      else field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  actions.resetForm = function (params, context) {
    each(params, context, function (element) {
      var form = getForm(element);
      if (form) {
        form.reset();
        form.classList.remove('wv-validated');
      }
    });
  };
  actions.reportValidity = function (params, context) {
    each(params, context, function (element) {
      var form = getForm(element);
      if (!form) return;
      form.classList.add('wv-validated');
      var firstInvalid = form.querySelector(':invalid');
      if (firstInvalid && firstInvalid.focus) firstInvalid.focus();
      if (form.reportValidity) form.reportValidity();
    });
  };
  actions.sendForm = function (params, context) {
    var forms = context.targets(params.target).map(getForm).filter(Boolean);
    return Promise.all(
      forms.map(function (form) {
        var data = {};
        new FormData(form).forEach(function (value, key) {
          data[key] = value;
        });
        return fetch(interpolate(params.url), {
          method: params.method || 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        })
          .then(function (response) {
            if (params.resultVariable) state.set(params.resultVariable, response.ok ? 'success' : 'error');
          })
          .catch(function (error) {
            if (params.resultVariable) state.set(params.resultVariable, 'error');
            reportError(error, 'Sending the form');
          });
      })
    );
  };
  actions.goToPage = function (params) {
    goToPage(params.page);
  };
  actions.openUrl = function (params) {
    var url = interpolate(params.url);
    if (params.newTab) global.open(url, '_blank', 'noopener');
    else global.location.href = url;
  };
  actions.scrollTo = function (params, context) {
    var element = context.targets(params.target)[0];
    if (!element) return;
    var top = element.getBoundingClientRect().top + global.scrollY - toNumber(params.offset);
    global.scrollTo({ top: top, behavior: params.smooth === false ? 'auto' : 'smooth' });
  };
  actions.scrollToTop = function (params) {
    global.scrollTo({ top: 0, behavior: params.smooth === false ? 'auto' : 'smooth' });
  };
  var withBehavior = function (params, context, name, callback) {
    // An element without the behavior targets its closest ancestor having it
    // (a "Close" button inside a popup closes the popup).
    var elements = context.targets(params.target).map(function (element) {
      if (element.__webvelop && element.__webvelop[name]) return element;
      return (element.closest && element.closest('[data-wv-behavior-' + name + ']')) || element;
    });
    elements.forEach(function (element) {
      var api = element.__webvelop && element.__webvelop[name];
      if (api) callback(api, element);
      else reportError(new Error('The element does not have the "' + name + '" behavior'), 'Interactions');
    });
  };
  actions.openModal = function (params, context) {
    withBehavior(params, context, 'modal', function (api) {
      api.open();
    });
  };
  actions.closeModal = function (params, context) {
    withBehavior(params, context, 'modal', function (api) {
      api.close();
    });
  };
  actions.activateTab = function (params, context) {
    withBehavior(params, context, 'tabs', function (api) {
      api.activate(toNumber(params.index) - 1);
    });
  };
  actions.carouselNext = function (params, context) {
    withBehavior(params, context, 'carousel', function (api) {
      api.next();
    });
  };
  actions.carouselPrevious = function (params, context) {
    withBehavior(params, context, 'carousel', function (api) {
      api.previous();
    });
  };
  actions.carouselGoTo = function (params, context) {
    withBehavior(params, context, 'carousel', function (api) {
      api.goTo(toNumber(params.index) - 1);
    });
  };
  actions.toggleDropdown = function (params, context) {
    withBehavior(params, context, 'dropdown', function (api) {
      api.toggle();
    });
  };
  var parseValue = function (raw, variableName) {
    var text = interpolate(String(raw == null ? '' : raw));
    var current = state.get(variableName);
    if (typeof current === 'number') return toNumber(text);
    if (typeof current === 'boolean') return text === 'true';
    if (current !== null && typeof current === 'object') {
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }
    return text;
  };
  actions.setVariable = function (params) {
    state.set(params.variable, parseValue(params.value, params.variable));
  };
  actions.addToVariable = function (params) {
    state.set(params.variable, toNumber(state.get(params.variable)) + toNumber(params.amount));
  };
  actions.toggleVariable = function (params) {
    state.set(params.variable, !state.get(params.variable));
  };
  actions.setVariableFromInput = function (params, context) {
    var element = context.targets(params.target)[0];
    if (element) state.set(params.variable, getFieldValue(element));
  };
  actions.wait = function (params) {
    return wait(toNumber(params.duration) * 1000);
  };
  actions.copyToClipboard = function (params) {
    var text = interpolate(String(params.text));
    if (global.navigator.clipboard) return global.navigator.clipboard.writeText(text).catch(function () {});
  };
  actions.log = function (params) {
    console.log(interpolate(String(params.message)));
  };
  actions.javascript = function (params, context, action) {
    var fn = codeFunctions[action.id];
    if (!fn) return;
    return fn(context.element, context.event, state, Webvelop, context, getCodeElements(params, context));
  };

  // ---------------------------------------------------------------------------
  // Behaviors
  // ---------------------------------------------------------------------------
  var setApi = function (element, name, api) {
    element.__webvelop = element.__webvelop || {};
    element.__webvelop[name] = api;
    element.setAttribute('data-wv-behavior-' + name, '');
  };
  var elementChildren = function (element) {
    return toArray(element.children).filter(function (child) {
      return !child.classList.contains('wv-ui');
    });
  };

  behaviors.tabs = function (element, config) {
    var parts = elementChildren(element);
    var buttons = parts[0] ? elementChildren(parts[0]) : [];
    var panels = parts[1] ? elementChildren(parts[1]) : [];
    if (parts[0]) parts[0].setAttribute('role', 'tablist');
    var activate = function (index) {
      index = Math.max(0, Math.min(index, Math.max(buttons.length, panels.length) - 1));
      buttons.forEach(function (button, i) {
        button.classList.toggle('is-active', i === index);
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      panels.forEach(function (panel, i) {
        panel.setAttribute('role', 'tabpanel');
        if (i === index) {
          show(panel);
          panel.classList.add('wv-anim-run', 'wv-anim-fade-in');
        } else hide(panel);
      });
    };
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        activate(index);
      });
    });
    activate(toNumber(config.initialIndex));
    setApi(element, 'tabs', { activate: activate });
  };

  behaviors.accordion = function (element, config) {
    var items = elementChildren(element);
    var setOpen = function (item, open) {
      var parts = elementChildren(item);
      item.classList.toggle('is-active', open);
      if (parts[0]) {
        parts[0].classList.toggle('is-active', open);
        parts[0].setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (parts[1]) {
        if (open) {
          show(parts[1]);
          parts[1].classList.add('wv-anim-run', 'wv-anim-fade-down');
        } else hide(parts[1]);
      }
    };
    items.forEach(function (item, index) {
      var header = elementChildren(item)[0];
      setOpen(item, !!config.firstOpen && index === 0);
      if (!header) return;
      header.style.cursor = 'pointer';
      header.addEventListener('click', function () {
        var willOpen = !item.classList.contains('is-active');
        if (willOpen && !config.allowMultiple)
          items.forEach(function (other) {
            if (other !== item) setOpen(other, false);
          });
        setOpen(item, willOpen);
      });
    });
    setApi(element, 'accordion', {
      open: function (index) {
        if (items[index]) setOpen(items[index], true);
      },
      close: function (index) {
        if (items[index]) setOpen(items[index], false);
      },
    });
  };

  behaviors.carousel = function (element, config) {
    var slides = elementChildren(element);
    if (!slides.length) return;
    element.classList.add('wv-carousel');
    var viewport = doc.createElement('div');
    viewport.className = 'wv-carousel-viewport wv-ui';
    var track = doc.createElement('div');
    track.className = 'wv-carousel-track';
    viewport.appendChild(track);
    slides.forEach(function (slide) {
      slide.classList.add('wv-carousel-slide');
      track.appendChild(slide);
    });
    element.appendChild(viewport);
    var current = 0;
    var dots = [];
    var goTo = function (index) {
      if (config.loop !== false) index = (index + slides.length) % slides.length;
      else index = Math.max(0, Math.min(index, slides.length - 1));
      current = index;
      track.style.transform = 'translateX(' + -index * 100 + '%)';
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === index);
        slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
      });
    };
    if (config.showArrows !== false && slides.length > 1) {
      ['previous', 'next'].forEach(function (direction) {
        var button = doc.createElement('button');
        button.type = 'button';
        button.className = 'wv-ui wv-carousel-arrow wv-carousel-' + direction;
        button.setAttribute('aria-label', direction === 'next' ? 'Next slide' : 'Previous slide');
        button.innerHTML = direction === 'next' ? '&#8250;' : '&#8249;';
        button.addEventListener('click', function () {
          goTo(current + (direction === 'next' ? 1 : -1));
          restartAutoplay();
        });
        element.appendChild(button);
      });
    }
    if (config.showDots !== false && slides.length > 1) {
      var dotsContainer = doc.createElement('div');
      dotsContainer.className = 'wv-ui wv-carousel-dots';
      slides.forEach(function (slide, index) {
        var dot = doc.createElement('button');
        dot.type = 'button';
        dot.className = 'wv-carousel-dot';
        dot.setAttribute('aria-label', 'Slide ' + (index + 1));
        dot.addEventListener('click', function () {
          goTo(index);
          restartAutoplay();
        });
        dots.push(dot);
        dotsContainer.appendChild(dot);
      });
      element.appendChild(dotsContainer);
    }
    var timer = null;
    var paused = false;
    var restartAutoplay = function () {
      if (timer) clearInterval(timer);
      var delay = toNumber(config.autoplay) * 1000;
      if (delay > 0 && slides.length > 1)
        timer = setInterval(function () {
          if (!paused) goTo(current + 1);
        }, delay);
    };
    element.addEventListener('mouseenter', function () {
      paused = true;
    });
    element.addEventListener('mouseleave', function () {
      paused = false;
    });
    if (config.swipe !== false) {
      var startX = null;
      viewport.addEventListener('pointerdown', function (e) {
        startX = e.clientX;
      });
      viewport.addEventListener('pointerup', function (e) {
        if (startX === null) return;
        var delta = e.clientX - startX;
        startX = null;
        if (Math.abs(delta) > 40) {
          goTo(current + (delta < 0 ? 1 : -1));
          restartAutoplay();
        }
      });
    }
    goTo(0);
    restartAutoplay();
    setApi(element, 'carousel', {
      next: function () {
        goTo(current + 1);
      },
      previous: function () {
        goTo(current - 1);
      },
      goTo: goTo,
    });
  };

  var openModals = [];
  behaviors.modal = function (element, config) {
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.classList.add('wv-modal');
    var previousFocus = null;
    var api = {
      open: function () {
        if (!isHidden(element)) return;
        previousFocus = doc.activeElement;
        show(element);
        element.classList.add('wv-anim-run', 'wv-anim-fade-in');
        openModals.push(element);
        if (config.lockScroll !== false) doc.documentElement.classList.add('wv-scroll-locked');
        var focusable = element.querySelector('button, a[href], input, textarea, select, [tabindex]');
        if (focusable) setTimeout(function () { focusable.focus(); }, 30);
      },
      close: function () {
        if (isHidden(element)) return;
        hide(element);
        element.classList.remove('wv-anim-run', 'wv-anim-fade-in');
        openModals = openModals.filter(function (modal) {
          return modal !== element;
        });
        if (!openModals.length) doc.documentElement.classList.remove('wv-scroll-locked');
        if (previousFocus && previousFocus.focus) previousFocus.focus();
      },
    };
    api.toggle = function () {
      if (isHidden(element)) api.open();
      else api.close();
    };
    if (config.closeOnBackdrop !== false)
      element.addEventListener('click', function (e) {
        if (e.target === element) api.close();
      });
    if (config.closeOnEscape !== false)
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && openModals[openModals.length - 1] === element) api.close();
      });
    setApi(element, 'modal', api);
  };

  behaviors.dropdown = function (element, config) {
    var parts = elementChildren(element);
    var trigger = parts[0];
    var menu = parts[1];
    if (!trigger || !menu) return;
    var isOpen = false;
    var setOpen = function (open) {
      isOpen = open;
      if (open) {
        show(menu);
        menu.classList.add('wv-anim-run', 'wv-anim-fade-down');
      } else hide(menu);
      element.classList.toggle('is-active', open);
      trigger.classList.toggle('is-active', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    setOpen(false);
    if (config.openOn === 'hover') {
      element.addEventListener('mouseenter', function () {
        setOpen(true);
      });
      element.addEventListener('mouseleave', function () {
        setOpen(false);
      });
    }
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(!isOpen);
    });
    doc.addEventListener('click', function (e) {
      if (isOpen && !element.contains(e.target)) setOpen(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (isOpen && e.key === 'Escape') setOpen(false);
    });
    setApi(element, 'dropdown', {
      open: function () {
        setOpen(true);
      },
      close: function () {
        setOpen(false);
      },
      toggle: function () {
        setOpen(!isOpen);
      },
    });
  };

  var lightboxOverlay = null;
  behaviors.lightbox = function (element) {
    var images = toArray(element.querySelectorAll('img'));
    var index = 0;
    var ensureOverlay = function () {
      if (lightboxOverlay) return lightboxOverlay;
      var overlay = doc.createElement('div');
      overlay.className = 'wv-lightbox wv-hidden';
      overlay.innerHTML =
        '<img class="wv-lightbox-image" alt="">' +
        '<div class="wv-lightbox-caption"></div>' +
        '<button type="button" class="wv-lightbox-close" aria-label="Close">&#215;</button>' +
        '<button type="button" class="wv-lightbox-prev" aria-label="Previous">&#8249;</button>' +
        '<button type="button" class="wv-lightbox-next" aria-label="Next">&#8250;</button>';
      doc.body.appendChild(overlay);
      lightboxOverlay = overlay;
      return overlay;
    };
    var display = function (newIndex) {
      var overlay = ensureOverlay();
      index = (newIndex + images.length) % images.length;
      overlay.querySelector('.wv-lightbox-image').src = images[index].currentSrc || images[index].src;
      overlay.querySelector('.wv-lightbox-caption').textContent = images[index].alt || '';
      overlay.__current = { images: images, display: display, index: index };
    };
    var open = function (newIndex) {
      var overlay = ensureOverlay();
      display(newIndex);
      overlay.classList.remove('wv-hidden');
      overlay.classList.add('wv-anim-run', 'wv-anim-fade-in');
      doc.documentElement.classList.add('wv-scroll-locked');
      if (!overlay.__bound) {
        overlay.__bound = true;
        var close = function () {
          overlay.classList.add('wv-hidden');
          doc.documentElement.classList.remove('wv-scroll-locked');
        };
        var step = function (delta) {
          var current = overlay.__current;
          if (current) current.display(current.index + delta);
        };
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay || e.target.classList.contains('wv-lightbox-close')) close();
          if (e.target.classList.contains('wv-lightbox-prev')) step(-1);
          if (e.target.classList.contains('wv-lightbox-next')) step(1);
        });
        doc.addEventListener('keydown', function (e) {
          if (overlay.classList.contains('wv-hidden')) return;
          if (e.key === 'Escape') close();
          if (e.key === 'ArrowLeft') step(-1);
          if (e.key === 'ArrowRight') step(1);
        });
      }
    };
    images.forEach(function (image, i) {
      image.style.cursor = 'zoom-in';
      image.addEventListener('click', function (e) {
        e.preventDefault();
        open(i);
      });
    });
    setApi(element, 'lightbox', { open: open });
  };

  behaviors.stickyHeader = function (element, config) {
    if (global.getComputedStyle(element).position === 'static') {
      element.style.position = 'sticky';
      element.style.top = '0';
      element.style.zIndex = element.style.zIndex || '50';
    }
    var offset = toNumber(config.offset);
    var update = function () {
      element.classList.toggle('is-active', global.scrollY > offset);
    };
    global.addEventListener('scroll', update, { passive: true });
    update();
  };

  behaviors.counter = function (element, config) {
    var node = getTextNode(element);
    var original = node.textContent;
    var match = original.match(/-?[\d,.]+/);
    if (!match) return;
    var target = parseFloat(match[0].replace(/,/g, ''));
    var decimals = (match[0].split('.')[1] || '').length;
    var duration = toNumber(config.duration) || 1500;
    var render = function (value) {
      node.textContent = original.replace(match[0], value.toFixed(decimals));
    };
    render(0);
    var start = function () {
      var startTime = null;
      var frame = function (time) {
        if (startTime === null) startTime = time;
        var progress = Math.min(1, (time - startTime) / duration);
        render(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) global.requestAnimationFrame(frame);
      };
      global.requestAnimationFrame(frame);
    };
    if (!global.IntersectionObserver) return start();
    var observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        start();
      }
    });
    observer.observe(element);
  };

  var initBehaviors = function (root) {
    toArray((root || doc).querySelectorAll('[data-wv-behaviors]')).forEach(function (element) {
      var list;
      try {
        list = JSON.parse(element.getAttribute('data-wv-behaviors'));
      } catch (e) {
        return reportError(e, 'Behaviors');
      }
      list.forEach(function (behavior) {
        var implementation = behaviors[behavior.type];
        if (!implementation) return reportError(new Error('Unknown behavior "' + behavior.type + '"'), 'Behaviors');
        try {
          implementation(element, behavior.config || {});
        } catch (e) {
          reportError(e, 'Behavior "' + behavior.type + '"');
        }
      });
    });
  };

  var initEntranceAnimations = function () {
    var elements = toArray(doc.querySelectorAll('[data-wv-anim]'));
    if (!elements.length) return;
    if (!global.IntersectionObserver) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        entry.target.classList.remove('wv-anim-pending');
        entry.target.classList.add('wv-anim-run', 'wv-anim-' + entry.target.getAttribute('data-wv-anim'));
      });
    }, { threshold: 0.15 });
    elements.forEach(function (element) {
      element.classList.add('wv-anim-pending');
      observer.observe(element);
    });
  };

  // ---------------------------------------------------------------------------
  // React components
  // ---------------------------------------------------------------------------
  var getReactComponent = function (name) {
    if (reactComponentsCache[name]) return reactComponentsCache[name];
    var factory = reactFactories[name];
    if (!factory || !global.React) return null;
    var component = null;
    try {
      component = factory(global.React, Webvelop);
    } catch (e) {
      reportError(e, 'React component "' + name + '"');
    }
    if (component) reactComponentsCache[name] = component;
    return component;
  };

  var makeErrorBoundary = function (React) {
    if (makeErrorBoundary.cached) return makeErrorBoundary.cached;
    function WebvelopErrorBoundary(props) {
      React.Component.call(this, props);
      this.state = { error: null };
    }
    WebvelopErrorBoundary.prototype = Object.create(React.Component.prototype);
    WebvelopErrorBoundary.prototype.constructor = WebvelopErrorBoundary;
    WebvelopErrorBoundary.getDerivedStateFromError = function (error) {
      return { error: error };
    };
    WebvelopErrorBoundary.prototype.componentDidCatch = function (error) {
      reportError(error, 'React component "' + this.props.name + '"');
    };
    WebvelopErrorBoundary.prototype.render = function () {
      if (this.state.error)
        return React.createElement('div', { className: 'wv-react-error' }, 'Error in ' + this.props.name + ': ' + this.state.error.message);
      return this.props.children;
    };
    makeErrorBoundary.cached = WebvelopErrorBoundary;
    return WebvelopErrorBoundary;
  };

  var mountedRoots = [];
  var mountReactComponents = function (root) {
    var placeholders = toArray((root || doc).querySelectorAll('[data-wv-react]'));
    mountedRoots = mountedRoots.filter(function (mounted) {
      if (mounted.element.isConnected) return true;
      try {
        mounted.root.unmount();
      } catch (e) {}
      return false;
    });
    if (!placeholders.length) return;
    var React = global.React;
    var ReactDOM = global.ReactDOM;
    if (!React || !ReactDOM) {
      placeholders.forEach(function (placeholder) {
        placeholder.innerHTML = '<div class="wv-react-error">React is not loaded.</div>';
      });
      return;
    }
    var ErrorBoundary = makeErrorBoundary(React);
    placeholders.forEach(function (placeholder) {
      if (placeholder.__wvMounted) return;
      var name = placeholder.getAttribute('data-wv-react');
      var component = getReactComponent(name);
      if (!component) {
        placeholder.innerHTML = '<div class="wv-react-error">Unknown React component "' + escapeHtml(name) + '"</div>';
        return;
      }
      var props = {};
      try {
        props = JSON.parse(placeholder.getAttribute('data-wv-props') || '{}');
      } catch (e) {}
      var reactRoot = ReactDOM.createRoot ? ReactDOM.createRoot(placeholder) : null;
      var tree = React.createElement(ErrorBoundary, { name: name }, React.createElement(component, props));
      if (reactRoot) reactRoot.render(tree);
      else ReactDOM.render(tree, placeholder);
      placeholder.__wvMounted = true;
      mountedRoots.push({ element: placeholder, root: reactRoot || { unmount: function () { ReactDOM.unmountComponentAtNode(placeholder); } } });
    });
  };

  /** React hook giving the value of a website variable and a function to change it. */
  var useVariable = function (name) {
    var React = global.React;
    var pair = React.useState(state.get(name));
    var value = pair[0];
    var setValue = pair[1];
    React.useEffect(
      function () {
        setValue(state.get(name));
        return state.subscribe(name, function (newValue) {
          setValue(newValue);
        });
      },
      [name]
    );
    var update = React.useCallback(
      function (newValue) {
        state.set(name, typeof newValue === 'function' ? newValue(state.get(name)) : newValue);
      },
      [name]
    );
    return [value, update];
  };

  // ---------------------------------------------------------------------------
  // Preview helpers
  // ---------------------------------------------------------------------------
  var setUpPreviewMode = function () {
    var post = function (message) {
      try {
        global.parent.postMessage(message, '*');
      } catch (e) {}
    };
    ['log', 'info', 'warn', 'error'].forEach(function (level) {
      var original = console[level];
      console[level] = function () {
        var args = toArray(arguments).map(function (arg) {
          if (arg instanceof Error) return arg.message;
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        });
        post({ type: 'webvelop:console', level: level, message: args.join(' ') });
        if (original) original.apply(console, arguments);
      };
    });
    global.addEventListener('error', function (e) {
      post({ type: 'webvelop:error', message: e.message, where: 'Script' });
    });
    global.addEventListener('unhandledrejection', function (e) {
      post({ type: 'webvelop:error', message: (e.reason && e.reason.message) || String(e.reason), where: 'Promise' });
    });
    // Links to other pages are handled by the editor preview.
    doc.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href]');
      if (!link) return;
      var pageId = link.getAttribute('data-wv-page');
      var href = link.getAttribute('href') || '';
      if (pageId) {
        e.preventDefault();
        var hashIndex = href.indexOf('#');
        goToPage(pageId, hashIndex !== -1 ? href.substring(hashIndex) : '');
      } else if (href.charAt(0) === '#') {
        e.preventDefault();
        var anchor = href.length > 1 ? doc.getElementById(href.substring(1)) : null;
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
        else if (href === '#') global.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (link.target !== '_blank') {
        e.preventDefault();
        post({ type: 'webvelop:external-link', url: link.href });
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------------
  var bindAllEvents = function () {
    (siteConfig.globalEvents || []).forEach(function (event) {
      bindEvent(event, doc);
    });
    (pageConfig.events || []).forEach(function (event) {
      bindEvent(event, doc);
    });
    var components = siteConfig.components || {};
    Object.keys(components).forEach(function (componentId) {
      var events = components[componentId].events || [];
      if (!events.length) return;
      toArray(doc.querySelectorAll('[data-wv-component="' + componentId + '"]')).forEach(function (instanceRoot) {
        events.forEach(function (event) {
          bindEvent(event, instanceRoot);
        });
      });
    });
  };

  var runScripts = function (scripts, kind) {
    scripts.forEach(function (script) {
      try {
        script.fn(Webvelop, state);
      } catch (e) {
        reportError(e, kind + ' "' + script.name + '"');
      }
    });
  };

  var start = function (options) {
    if (started) return;
    started = true;
    mode = (options && options.mode) || mode;
    if (mode === 'preview') setUpPreviewMode();
    doc.documentElement.classList.add('wv-js');
    initializeState();
    state.subscribe(function () {
      refreshBindings();
    });
    if (mode === 'editor') {
      refreshBindings();
      mountReactComponents();
      return;
    }
    refreshBindings();
    initBehaviors();
    bindAllEvents();
    initEntranceAnimations();
    mountReactComponents();
    runScripts(siteScripts, 'Script');
    runScripts(pageScripts, 'Page script');
    readyCallbacks.forEach(function (callback) {
      try {
        callback();
      } catch (e) {
        reportError(e, 'Startup');
      }
    });
    readyCallbacks = [];
  };

  var Webvelop = {
    __isRuntime: true,
    version: '1.0.0',
    state: state,
    get site() {
      return siteConfig;
    },
    get page() {
      return pageConfig;
    },
    get mode() {
      return mode;
    },
    // Configuration (called by the generated site.js / page scripts)
    configureSite: function (config) {
      siteConfig = config;
    },
    configurePage: function (config) {
      pageConfig = config;
    },
    registerCode: function (id, fn) {
      codeFunctions[id] = fn;
    },
    defineCustomAction: function (name, paramTypes, fn) {
      customActions[name] = function (params, context) {
        var resolved = {};
        Object.keys(params).forEach(function (key) {
          resolved[key] = paramTypes[key] === 'element' ? context.targets(params[key]) : interpolate(params[key]);
        });
        return fn(resolved, context);
      };
    },
    addSiteScript: function (name, fn) {
      siteScripts.push({ name: name, fn: fn });
    },
    addPageScript: function (name, fn) {
      pageScripts.push({ name: name, fn: fn });
    },
    registerReactComponent: function (name, factory) {
      reactFactories[name] = factory;
      delete reactComponentsCache[name];
    },
    // Extension points
    registerAction: function (type, fn) {
      actions[type] = fn;
    },
    registerCondition: function (type, fn) {
      conditions[type] = fn;
    },
    registerTrigger: function (type, fn) {
      triggers[type] = fn;
    },
    registerBehavior: function (type, fn) {
      behaviors[type] = fn;
    },
    // Helpers usable from scripts and React components
    /** Control an element of the page: Webvelop.$('Element name').text('Hello').show(). */
    $: function (target) {
      return getHandle(target);
    },
    ElementHandle: ElementHandle,
    element: function (nameOrId) {
      return getElementsByName(nameOrId)[0] || null;
    },
    elements: function (nameOrId) {
      return getElementsByName(nameOrId);
    },
    show: function (target) {
      findTargets(typeof target === 'string' ? (pageConfig.elements || {})[target] || target : target).forEach(show);
    },
    hide: function (target) {
      findTargets(typeof target === 'string' ? (pageConfig.elements || {})[target] || target : target).forEach(hide);
    },
    toggle: function (target) {
      findTargets(typeof target === 'string' ? (pageConfig.elements || {})[target] || target : target).forEach(toggle);
    },
    goToPage: goToPage,
    runAction: function (type, params, element) {
      return runAction({ type: type, params: params || {} }, makeContext({ element: element || null }));
    },
    interpolate: interpolate,
    onReady: function (callback) {
      if (started && mode !== 'editor') callback();
      else readyCallbacks.push(callback);
    },
    useVariable: useVariable,
    getBreakpoint: getBreakpoint,
    reportError: reportError,
    // Used by the editor canvas
    mountReactComponents: mountReactComponents,
    refreshBindings: refreshBindings,
    resetReactComponents: function () {
      reactComponentsCache = {};
    },
    start: start,
  };

  global.Webvelop = Webvelop;
})(typeof window !== 'undefined' ? window : this);
