(function (__undefined) {
    this.ValueRange = Class.extend({
        init: function (min, max) {
            this.min = min;
            this.max = max;
        },
        avg: function () {
            return Math.floor((this.min + this.max) / 2);
        },
        max: function () {
            return Math.max.apply(Math, [this.min, this.max]);
        },
        min: function () {
            return Math.min.apply(Math, [this.min, this.max]);
        },
        add: function (value_range) {
            this.min += value_range.min;
            this.max += value_range.max;
        },
        multiply: function (lambda) {
            this.min = Math.floor(this.min * lambda);
            this.max = Math.floor(this.max * lambda);
        },
        toString: function () {
            if (this.min === this.max) {
                return '' + this.min;
            }
            return [this.min, this.max].join(" to ");
        },
        toArray: function () {
            return [this.min, this.max];
        }
    });
})();