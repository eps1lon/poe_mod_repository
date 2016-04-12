(function (__undefined) {
    'use strict';
    
    var Class = require('./Inheritance');
    
    var ByteSet = Class.extend({
        init: function (names) {
            var that = this;
            this.bits = {};
            
            names.forEach(function (name, index) {
                that.bits[name] = Math.pow(2, index);
            });
        },
        exists: function (name) {
            return !!this.getBits()[name];
        },
        add: function (name) {
            var bit_values = this.getBits();
            if (!this.exists(name)) {
                this.bits[name] = Math.pow(2, Object.keys(bit_values).length);
            } else {
                console.error("`" + name + "` already set in", this.bits);
            }
        },
        getBits: function () {
            return this.bits;
        },
        isSet: function (byte, name) {
            if (!name) {
                var bits_set = {};
                for (name in this.getBits()) {
                    bits_set[name] = this.isSet(byte, name);
                }
                
                return bits_set;
            } else {
                if (!this.exists(name)) {
                    return null;
                }
                return !!(byte & this.getBits()[name]);
            }
        },
        enable: function (byte, name) {
            if (!this.exists(name)) {
                console.warn("`" + name + "` doesnt exist in", this.getBits());
                return byte;
            }
            
            return byte | this.getBits()[name];
        },
        disable: function (byte, name) {
            if (!this.exists(name)) {
                console.warn("`" + name + "` doesnt exist in", this.getBits());
                return byte;
            }
            return byte & ~this.getBits()[name];
        }
    });
    
    module.exports = ByteSet;
}).call(this);