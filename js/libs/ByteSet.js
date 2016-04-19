(function (__undefined) {
    'use strict';
    
    var Class = require('./Inheritance');
    
    var ByteSet = Class.extend({
        init: function (names) {
            this.value = 0;
            
            if (Array.isArray(names) === false) {
                console.error('parameter `name` has to be an array but is', names);
            }
            this.bits = names;
        },
        valueOf: function (name) {
            var index = this.bits.indexOf(name);
            
            if (index === -1) {
                return null;
            }
            return Math.pow(2, index);
        },
        exists: function (name) {
            return this.valueOf(name) !== null;
        },
        add: function (name) {
            if (!this.exists(name)) {
                this.bits.push(name);
            } else {
                console.error("`" + name + "` already set in", this.bits);
            }
        },
        getBits: function () {
            return this.bits;
        },
        isSet: function (name) {
            if (!name) {
                var bits_set = {};
                var that = this;
                
                this.bits.forEach(function (name) {
                    bits_set[name] = that.isSet(name);
                });
                
                return bits_set;
            } else {
                if (!this.exists(name)) {
                    return null;
                }
                return !!(this.value & this.valueOf(name));
            }
        },
        anySet: function () {
            return this.to_i() > 0;
        },
        enable: function (name) {
            if (!this.exists(name)) {
                //console.error("`" + name + "` doesnt exist in", this.bits);
            } else {
                this.value |= this.valueOf(name);
            }
            
            return this.value;
        },
        disable: function (name) {
            if (!this.exists(name)) {
                //console.error("`" + name + "` doesnt exist in", this.bits);
            } else {
                this.value &= ~this.valueOf(name);
            }
            return this.value;
        },
        clone: function () {
            var new_byte_set = new ByteSet(this.bits.slice());
            new_byte_set.value = this.value;
            
            return new_byte_set;
        },
        reset: function () {
            this.value = 0;
        },
        to_i: function () {
            return this.value;
        },
        /**
         * applies a callback to each bit with its value (true/false)
         * returns an object with each bitName => bitValue pair for which
         * the callback returns true
         * 
         * @param {type} filter_cb
         * @returns {unresolved}
         */
        filterBits: function (filter_cb) {
            var filtered = {};
            var unfiltered = this.isSet();
            
            Object.keys(unfiltered).forEach(function (name) {
                if (filter_cb(unfiltered[name], name, unfiltered) === true) {
                    filtered[name] = unfiltered[name];
                }
            });
            
            return filtered;
        }
    });
    
    // returns new ByteSet with everything disable from blacklist
    ByteSet.byteBlacklisted = function (byte_set, blacklist) {
        var new_byte_set = byte_set.clone();
        if (blacklist === __undefined) {
            blacklist = [];
        }
        
        blacklist.forEach(function (name) {
            new_byte_set.disable(name);
        });
        
        return new_byte_set;
    };
    
    module.exports = ByteSet;
}).call(this);