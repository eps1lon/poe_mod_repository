(function (__undefined) {
    Number.prototype.equals = function (other_number) {
        return typeof other_number === 'number' && 
                this.valueOf() === other_number;
    };
    
    /**
     * similar to toFixed but with rounddown
     * @param {type} precision
     * @returns {Number.prototype@call;valueOf@call;toString@call;match}
     */
    Number.prototype.toFixedPoe = function (precision) {
        // * 100 / 100 doesnt work due to floating point shenanigans
        return Number(this
                        .valueOf()
                        .toString()
                        .match(new RegExp("^\\d+(?:\\.\\d{0," + precision + "})?"))
                     ).toFixed(precision);
    };
})();