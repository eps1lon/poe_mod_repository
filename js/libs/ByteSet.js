(function (__undefined) {
    'use strict';
    
    var Class = require('./Inheritance');
    
    var ByteSet = Class.extend({
        init: function (names) {
            this.value = 0;
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
                console.error("`" + name + "` already set in", this.names);
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
        enable: function (name) {
            if (!this.exists(name)) {
                console.warn("`" + name + "` doesnt exist in", this.names);
            } else {
                this.value |= this.valueOf(name);
            }
            
            return this.value;
        },
        disable: function (name) {
            if (!this.exists(name)) {
                console.warn("`" + name + "` doesnt exist in", this.names);
            } else {
                this.value &= ~this.valueOf(name);
            }
            return this.value;
        },
        clone: function () {
            var new_byte_set = new ByteSet(this.names);
            new_byte_set.value = this.value;
            
            return new_byte_set;
        },
        reset: function () {
            this.value = 0;
        }
    });
    
    // turn of everything blacklisted (byte xor (byte & blacklist) = byte & !blacklist)
    ByteSet.byteBlacklisted = function (byte, blacklist) {
        return byte & ~blacklist;
    };
    
    module.exports = ByteSet;
}).call(this);