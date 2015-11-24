(function (__undefined) {
    Number.prototype.equals = function (other_number) {
        return typeof other_number === 'number' 
                && this.valueOf() === other_number;
    };
})();