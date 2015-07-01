/**
 * This Source Code is licensed under the MIT license. If a copy of the
 * MIT-license was not distributed with this file, You can obtain one at:
 * http://opensource.org/licenses/mit-license.html.
 *
 * @author: Hein Rutjes (IjzerenHein)
 * @license MIT
 * @copyright Gloey Apps, 2014
 */

/**
 * @module
 */
define(function(require, exports, module) {
    'use strict';

    // import dependencies
    var Entity = require('famous/core/Entity');
    var Surface = require('famous/core/Surface');
    var Transform = require('famous/core/Transform');
    var Modifier = require('famous/core/Modifier');
    var View = require('famous/core/View');

    //
    // Pull to refresh states
    //
    var PullToRefreshState = {
        HIDDEN: 0,
        PULLING: 1,
        ACTIVE: 2,
        COMPLETED: 3,
        HIDDING: 4
    };

    /**
     * @class
     * @extends View
     * @param {Object} [options] Configuration options
     */
    function RefreshLoader(options) {
        View.apply(this, arguments);

        this._rotateOffset = 0;
        this._scale = 1;
        this.id = Entity.register(this); // register entity-id to capture size prior to rendering

        if (this.options.pullToRefresh && this.options.pullToRefreshBackgroundColor) {
            _createForeground.call(this, _translateBehind.call(this));
        }
        _createParticles.call(this, _translateBehind.call(this), this.options.particleCount);

        if (!this._pullToRefresh) {
            this._pullToRefresh = {
                state: PullToRefreshState.HIDDEN,
                prevState: PullToRefreshState.HIDDEN,
            };
        }

        this._eventOutput.on('click', function (event) {
            console.log(event);
        });
    }
    RefreshLoader.prototype = Object.create(View.prototype);
    RefreshLoader.prototype.constructor = RefreshLoader;
    RefreshLoader.PullToRefreshState = PullToRefreshState;

    // default options
    RefreshLoader.DEFAULT_OPTIONS = {
        direction: 1,               // 0 = horizontal, 1 = vertical
        color: '#AAAAAA',
        particleCount: 10,
        particleSize: 6,
        rotateVelocity: 0.09,
        hideVelocity: 0.05,
        quickHideVelocity: 0.2,
        pullToRefresh: false,
        pullToRefreshBackgroundColor: 'white',
        pullToRefreshDirection: 1,
        pullToRefreshFooter: false,
        pullToRefreshFactor: 1.5 // pull 1.5x the size to activate refresh
    };

    /**
     * Helper function for giving all surfaces the correct z-index.
     */
    function _translateBehind() {
        if (this._zNode) {
            this._zNode = this._zNode.add(new Modifier({
                transform: Transform.behind
            }));
        }
        else {
            this._zNode = this.add(new Modifier({
                transform: Transform.behind
            }));
        }
        return this._zNode;
    }

    /**
     * Creates the particles
     */
    function _createParticles(node, count) {
        this._particles = [];
        var options = {
            size: [this.options.particleSize, this.options.particleSize],
            properties: {
                backgroundColor: this.options.color,
                borderRadius: '50%'
            }
        };
        for (var i = 0; i < count; i++) {
            var particle = {
                surface: new Surface(options),
                mod: new Modifier({})
            };
            this._particles.push(particle);
            node.add(particle.mod).add(particle.surface);
        }
    }

    /**
     * Creates the foreground behind which the particles can hide in case of pull to refresh.
     */
    function _createForeground(node) {
        this._foreground = {
            surface: new Surface({
                size: this.options.size,
                properties: {
                    backgroundColor: this.options.pullToRefreshBackgroundColor
                }
            }),
            mod: new Modifier({})
        };
        node.add(this._foreground.mod).add(this._foreground.surface);
    }

     /**
     * Positions/rotates partciles.
     */
    var devicePixelRatio = window.devicePixelRatio || 1;
    function _positionParticles(renderSize) {
        var shapeSize = this.options.size[this.options.pullToRefreshDirection] / 2;
        var visiblePerc = Math.min(Math.max(renderSize[this.options.pullToRefreshDirection] / (this.options.size[this.options.pullToRefreshDirection] * 2), 0), 1);
        switch (this._pullToRefreshStatus) {
            case 0:
            case 1:
                this._rotateOffset = 0;
                this._scale = 1;
                break;
            case 2:
                visiblePerc = 1;
                this._rotateOffset += this.options.rotateVelocity;
                break;
            case 3:
                visiblePerc = 1;
                this._rotateOffset += this.options.rotateVelocity;
                this._scale -= this.options.hideVelocity;
                this._scale = Math.max(0, this._scale);
                break;
            case 4:
                visiblePerc = 1;
                this._rotateOffset += this.options.rotateVelocity;
                this._scale -= this.options.quickHideVelocity;
                this._scale = Math.max(0, this._scale);
                break;
        }
        //console.log('visiblePerc: ' + visiblePerc + ', renderSize: ' + JSON.stringify(renderSize));
        var rTotal = visiblePerc * Math.PI * 2;
        for (var i = 0, cnt = this._particles.length; i < cnt; i++) {
            var mod = this._particles[i].mod;
            var r = (((i / cnt) * rTotal) - (Math.PI / 2)) + this._rotateOffset + (this.options.pullToRefreshFooter ? Math.PI : 0);
            var x = Math.cos(r) * (shapeSize / 2) * this._scale;
            var y = Math.sin(r) * (shapeSize / 2) * this._scale;
            if (this.options.pullToRefreshDirection) {
                x += (renderSize[0] / 2);
                y += shapeSize;
                y = Math.round(y * devicePixelRatio) / devicePixelRatio;
            }
            else {
                x += shapeSize;
                y += (renderSize[1] / 2);
                x = Math.round(x * devicePixelRatio) / devicePixelRatio;
            }
            mod.transformFrom(Transform.translate(x, y, 0));
            mod.opacityFrom(this._scale);
        }
    }

    /**
     * Positions the foreground in front of the particles.
     */
    function _positionForeground(renderSize) {
        if (this._pullToRefreshDirection) {
            this._foreground.mod.transformFrom(Transform.translate(0, renderSize[1], 0));
        }
        else {
            this._foreground.mod.transformFrom(Transform.translate(renderSize[0], 0, 0));
        }
    }

    /**
     * Helper function for setting the pull-to-refresh status.
     */
    function _setPullToRefreshState(state) {
        if (this._pullToRefresh.state !== state) {
            this._pullToRefresh.state = state;
            this.setPullToRefreshStatus(state);
        }
    }

    /**
     * Ensure that our commit is called passing along the size.
     * @private
     */
    RefreshLoader.prototype.render = function render() {
        return [this.id, this._node.render()];
    };

    /**
     * Position renderables based on size
     * @private
     */
    RefreshLoader.prototype.commit = function commit(context) {
        _positionParticles.call(this, context.size);
        if (this._foreground) {
            _positionForeground.call(this, context.size);
        }
        if ((this._pullToRefresh.state === PullToRefreshState.ACTIVE) &&
            (this._pullToRefresh.prevState !== PullToRefreshState.ACTIVE)) {
            this._eventOutput.emit('refresh', {
                target: this
            });
        }
        this._pullToRefresh.prevState = this._pullToRefresh.state;
        return {};
    };

    RefreshLoader.prototype.pull = function pull(pullOffset) {
        // Calculate offset
        var length = this.getSize()[this.options.direction];
        var pullLength = this.getPullToRefreshSize ? this.getPullToRefreshSize()[this.options.direction] : length;
        var prevHeight = (length === undefined) ? -1 : length;
        var offset = (prevHeight >= 0) ? (pullOffset - prevHeight) : prevHeight;

        // Determine current state
        var visiblePerc = Math.max(Math.min(offset / pullLength, 1), 0);
        switch (this._pullToRefresh.state) {
            case PullToRefreshState.HIDDEN:
                if (visiblePerc >= 1) {
                    _setPullToRefreshState.call(this, PullToRefreshState.ACTIVE);
                }
                else if (offset >= 0.2) {
                    _setPullToRefreshState.call(this, PullToRefreshState.PULLING);
                }
                break;
            case PullToRefreshState.PULLING:
                if (visiblePerc >= 1) {
                    _setPullToRefreshState.call(this, PullToRefreshState.ACTIVE);
                }
                else if (offset < 0.2) {
                    _setPullToRefreshState.call(this, PullToRefreshState.HIDDEN);
                }
                break;
            case PullToRefreshState.ACTIVE:
                // nothing to do, wait for completed
                break;
            case PullToRefreshState.COMPLETED:
                if (offset >= 0.2) {
                    _setPullToRefreshState.call(this, PullToRefreshState.HIDDING);
                }
                else {
                    _setPullToRefreshState.call(this, PullToRefreshState.HIDDEN);
                }
                break;
            case PullToRefreshState.HIDDING:
                if (offset < 0.2) {
                    _setPullToRefreshState.call(this, PullToRefreshState.HIDDEN);
                }
                break;
        }

        // Show pull to refresh node
        if (this._pullToRefresh.state !== PullToRefreshState.HIDDEN) {
            var size = this.getSize();
            size[this.options.direction] = Math.max(Math.min(offset, pullLength), 0);
            this.setSize(size);
        }
    }

    /**
     * Called by the flex ScrollView whenever the pull-to-refresh renderable is shown
     * or the state has changed.
     *
     * @param {Number} status Status, 0: hidden, 1: pulling, 2: active, 3: completed, 4: hidding
     */
    RefreshLoader.prototype.setPullToRefreshStatus = function(status) {
        this._pullToRefreshStatus = status;
    };

    /**
     * Called by the flex ScrollView to get the size on how far to pull before the
     * refresh is activated.
     *
     * @return {Size} Pull to refresh size
     */
    RefreshLoader.prototype.getPullToRefreshSize = function() {
        if (this.options.pullToRefreshDirection) {
            return [this.options.size[0], this.options.size[1] * this.options.pullToRefreshFactor];
        }
        else {
            return [this.options.size[1] * this.options.pullToRefreshFactor, this.options.size[1]];
        }
    };

    /**
     * Shows the pulls-to-refresh renderable indicating that a refresh is in progress.
     *
     * @param {Bool} [footer] set to true to show pull-to-refresh at the footer (default: false).
     * @return {RefreshLoader} this
     */
    RefreshLoader.prototype.showPullToRefresh = function(footer) {
        if (this._pullToRefresh) {
            _setPullToRefreshState.call(this, PullToRefreshState.ACTIVE);
        }
        return this;
    };

    /**
     * Hides the pull-to-refresh renderable in case it was visible.
     *
     * @param {Bool} [footer] set to true to hide the pull-to-refresh at the footer (default: false).
     * @return {RefreshLoader} this
     */
    RefreshLoader.prototype.hidePullToRefresh = function(footer) {
        if (this._pullToRefresh && (this._pullToRefresh.state === PullToRefreshState.ACTIVE)) {
            _setPullToRefreshState.call(this, PullToRefreshState.COMPLETED);
        }
        return this;
    };

    /**
     * Get the visible state of the pull-to-refresh renderable.
     *
     * @param {Bool} [footer] set to true to get the state of the pull-to-refresh footer (default: false).
     */
    RefreshLoader.prototype.isPullToRefreshVisible = function(footer) {
        return this._pullToRefresh ? (this._pullToRefresh.state === PullToRefreshState.ACTIVE) : false;
    };

    module.exports = RefreshLoader;
});
