/* global Class, ValueRange */

(function (__undefined) {
    var Class = require("./Inheritance");
    
    /**
     * class ValueRange
     * 
     * a 2-dimensional array with operations for certain mathematical operations
     * can create recursive structures [(2-4)-(6-8)]
     */
    var ValueRange = Class.extend({
        init: function (min, max) {
            this.min = min;
            this.max = max;
        },
        toArray: function () {
            return [this.min, this.max];
        },
        toFixedPoe: function (precision) {
            // will turn 2.1 into 2.10 
            var min = this.min.toFixedPoe(precision);
            if (!(min instanceof ValueRange)) {
                // but with leading + we will get a number again
                min = +min;
            }
            
            var max = this.max.toFixedPoe(precision);
            if (!(max instanceof ValueRange)) {
                // but with leading + we will get a number again
                max = +max;
            }
            
            return new ValueRange(min, max);
        },
        /**
         * 
         * @param {int} depth aktuelle tiefe
         * @param {int} max_depth maximal tiefe
         * @param {int} max_depth_value wenn maximale tiefe überschritten ist minimale linke grenze(=any) oder maximale rechte grenze (=1)
         * @returns {ValueRange_L3.ValueRangeAnonym$0@pro;min@call;getMinDeep|ValueRange_L3.ValueRangeAnonym$0@pro;min@call;toString|Array|String|ValueRange_L3.ValueRangeAnonym$0@pro;max@call;getMaxDeep}
         */
        toString: function (depth, max_depth, max_depth_value) {
            if (this.min.equals(this.max)) {
                return this.min.toString();
            }
            
            if (max_depth === __undefined) {
                max_depth = Number.POSITIVE_INFINITY;
            }
            
            if (depth === __undefined) {
                depth = 0;
            }
            
            if (depth >= max_depth) {
                if (max_depth_value === 1) {
                    return this.getMaxDeep();
                } 
                return this.getMinDeep();
            }
            
            // signature of number.toString(radix) varies from this method sig 
            var min = this.min;
            if (min instanceof ValueRange) {
                min = min.toString(depth + 1, max_depth, 0);
            } 
            
            var max = this.max;
            if (max instanceof ValueRange) {
                max = max.toString(depth + 1, max_depth, 1);
            } 
            
            return [min, max].join(depth % 2 ? ValueRange.sepEven : ValueRange.sepOdd);
        },
        clone: function () {
            return new ValueRange(this.min, this.max);
        },
        add: function (value) {
            if (value instanceof ValueRange) {
                return this.addValueRange(value);
            }
            return this.addScalar(value);
        },
        addScalar: function (lambda) {
            return new ValueRange(this.min + lambda, this.max + lambda);
        },
        addValueRange: function (value_range) {
            return new ValueRange(value_range.add(this.min), 
                                  value_range.add(this.max));
        },
        equals: function (other_value_range) {
            return other_value_range instanceof ValueRange && 
                    this.min.equals(other_value_range.min) && 
                    this.max.equals(other_value_range.max);
        },
        multiply: function (value) {
            if (value instanceof ValueRange) {
                return this.multiplyValueRange(value);
            }
            return this.multiplyScalar(value);
        },
        multiplyScalar: function (lambda) {
            return new ValueRange(this.min * lambda, this.max * lambda);
        },
        multiplyValueRange: function (value_range) {
            return new ValueRange(value_range.multiply(this.min), 
                                  value_range.multiply(this.max));
        },
        isZero: function () {
            return this.toArray().isZero();
        },
        getMinDeep: function () {
            if (this.min instanceof ValueRange) {
                return this.min.getMinDeep();
            }
            return this.min;
        },
        getMaxDeep: function () {
            if (this.max instanceof ValueRange) {
                return this.max.getMaxDeep();
            }
            return this.max;
        }
    });
    
    ValueRange.sepOdd = " to ";
    ValueRange.sepEven = "-";
    
    module.exports = ValueRange;
})();