(function (__undefined) {
    Math.rand = function (min, max) {
        // math.random() = [0,1) => max - min  + 1 = [0,1]
        return Math.floor((Math.random() * (max - min + 1)) + min);
    };
})();