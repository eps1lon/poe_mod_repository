(function (__undefined) {
    this.ValueRange = Class.extend({
        init: function (min, max) {
            this.min = min;
            this.max = max;
        },
        toArray: function () {
            return [this.min, this.max];
        },
        toFixed: function (precision) {
            // will turn 2.1 into 2.10 
            var min = this.min.toFixed(precision);
            if (!(min instanceof ValueRange)) {
                // but with leading + we will get a number again
                min = +min;
            }
            
            var max = this.max.toFixed(precision);
            if (!(max instanceof ValueRange)) {
                // but with leading + we will get a number again
                max = +max;
            }
            
            return new ValueRange(min, max);
        },
        toString: function (depth) {
            if (this.min.equals(this.max)) {
                return this.min.toString();
            }
            
            if (depth === __undefined) {
                depth = 0;
            }
            
            // signature of number.toString(radix) varies from this method sig 
            var min = this.min;
            if (min instanceof ValueRange) {
                min = min.toString(depth + 1);
            } 
            
            var max = this.max;
            if (max instanceof ValueRange) {
                max = max.toString(depth + 1);
            } 
            
            return (depth > 0 ? "(" : "")
                    + [min, max].join(depth % 2 ? ValueRange.sepEven : ValueRange.sepOdd)
                    + (depth > 0 ? ")" : "");
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
            return other_value_range instanceof ValueRange
                    && this.min.equals(other_value_range.min)
                    && this.max.equals(other_value_range.max);
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
        }
    });
    
    this.ValueRange.sepOdd = " to ";
    this.ValueRange.sepEven = "-";
})();